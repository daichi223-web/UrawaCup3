// src/features/matches/api.ts
// 試合API呼び出し - Supabase版
import { matchesApi, goalsApi, standingsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  Match,
  MatchScoreInput,
  CreateMatchInput,
  MatchStage,
  MatchLock,
} from './types';

// 後方互換のため@shared/typesからもインポート
import type { MatchWithDetails } from '@shared/types';

export const matchApi = {
  // 試合一覧取得
  getAll: async (params?: {
    tournamentId?: number;
    groupId?: string;
    venueId?: number;
    matchDate?: string;
    stage?: MatchStage;
  }): Promise<Match[]> => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .order('match_date')
      .order('match_time');

    if (params?.tournamentId) {
      query = query.eq('tournament_id', params.tournamentId);
    }
    if (params?.groupId) {
      query = query.eq('group_id', params.groupId);
    }
    if (params?.venueId) {
      query = query.eq('venue_id', params.venueId);
    }
    if (params?.matchDate) {
      query = query.eq('match_date', params.matchDate);
    }
    if (params?.stage) {
      query = query.eq('stage', params.stage);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Match[];
  },

  // 後方互換: 試合一覧取得（フィルター対応）
  getMatches: async (params?: Record<string, unknown>): Promise<{ matches: MatchWithDetails[], total: number }> => {
    const tournamentId = params?.tournamentId as number || params?.tournament_id as number || 1;

    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*),
        goals(*)
      `)
      .eq('tournament_id', tournamentId)
      .order('match_date')
      .order('match_time');

    // フィルターを適用
    if (params?.groupId || params?.group_id) {
      query = query.eq('group_id', params.groupId || params.group_id);
    }
    if (params?.venueId || params?.venue_id) {
      query = query.eq('venue_id', params.venueId || params.venue_id);
    }
    if (params?.matchDate || params?.match_date) {
      query = query.eq('match_date', params.matchDate || params.match_date);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.stage) {
      query = query.eq('stage', params.stage);
    }

    const { data, error } = await query;
    if (error) throw error;

    // snake_case to camelCase 変換
    const matches: MatchWithDetails[] = (data || []).map((m: any) => ({
      ...m,
      matchDate: m.match_date,
      matchTime: m.match_time,
      matchOrder: m.match_number,
      venueId: m.venue_id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeScoreTotal: m.home_score_total,
      awayScoreTotal: m.away_score_total,
      homeScoreHalf1: m.home_score_half1,
      homeScoreHalf2: m.home_score_half2,
      awayScoreHalf1: m.away_score_half1,
      awayScoreHalf2: m.away_score_half2,
      homePK: m.home_pk,
      awayPK: m.away_pk,
      hasPenaltyShootout: m.has_penalty_shootout,
      goals: m.goals || [],
    }));

    return { matches, total: matches.length };
  },

  // 単一試合取得
  getById: async (id: number): Promise<Match> => {
    const data = await matchesApi.getById(id);
    return data as Match;
  },

  // 後方互換: 単一試合取得
  getMatch: async (id: number): Promise<MatchWithDetails> => {
    const data = await matchesApi.getById(id);
    return data as MatchWithDetails;
  },

  // 試合作成
  create: async (data: CreateMatchInput): Promise<Match> => {
    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        tournament_id: data.tournamentId,
        group_id: data.groupId,
        home_team_id: data.homeTeamId,
        away_team_id: data.awayTeamId,
        venue_id: data.venueId,
        match_date: data.matchDate,
        match_time: data.matchTime,
        stage: data.stage || 'preliminary',
        round: data.round,
        status: 'scheduled',
      })
      .select()
      .single();
    if (error) throw error;
    return match as Match;
  },

  // スコア入力
  updateScore: async (id: number, data: MatchScoreInput): Promise<Match> => {
    // スコアを入力したら自動的に'completed'に設定
    const status = data.status || 'completed';

    const match = await matchesApi.updateScore(id, {
      home_score_half1: data.homeScoreHalf1,
      home_score_half2: data.homeScoreHalf2,
      away_score_half1: data.awayScoreHalf1,
      away_score_half2: data.awayScoreHalf2,
      status: status,
    });

    // 得点者を保存（既存の得点を削除して再登録）
    if (data.goals && data.goals.length > 0) {
      try {
        // 既存の得点を削除
        await supabase
          .from('goals')
          .delete()
          .eq('match_id', id);

        // 新しい得点を登録
        const goalsToInsert = data.goals.map(g => ({
          match_id: id,
          team_id: g.teamId,
          player_id: g.playerId,
          player_name: g.scorerName,
          minute: g.minute,
          half: g.half,
          is_own_goal: g.isOwnGoal || false,
        }));

        const { error: goalsError } = await supabase
          .from('goals')
          .insert(goalsToInsert);

        if (goalsError) {
          console.error('[Goals] Failed to save goals:', goalsError);
        }
      } catch (err) {
        console.error('[Goals] Error saving goals:', err);
      }
    } else {
      // 得点者が空の場合は既存の得点を削除
      await supabase
        .from('goals')
        .delete()
        .eq('match_id', id);
    }

    // スコア更新後に順位表を再計算（group_idがあれば常に実行）
    try {
      const { data: matchData } = await supabase
        .from('matches')
        .select('tournament_id, group_id, stage')
        .eq('id', id)
        .single();

      if (matchData?.group_id) {
        console.log('[Standings] Recalculating standings for group:', matchData.group_id);
        await standingsApi.recalculate(matchData.tournament_id, matchData.group_id);
        console.log('[Standings] Standings recalculated successfully');
      } else {
        console.log('[Standings] No group_id, skipping recalculation');
      }
    } catch (err) {
      console.error('[Standings] Failed to recalculate standings:', err);
      // 順位表の再計算に失敗しても試合結果は保存済みなのでエラーは投げない
    }

    return match as Match;
  },

  // 試合削除
  delete: async (id: number): Promise<void> => {
    // 削除前に試合情報を取得（順位表再計算のため）
    const { data: match } = await supabase
      .from('matches')
      .select('tournament_id, group_id, stage')
      .eq('id', id)
      .single();

    // 試合削除（goals は CASCADE で自動削除）
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id);
    if (error) throw error;

    // 予選リーグの試合なら順位表を再計算
    if (match?.stage === 'preliminary' && match.group_id) {
      try {
        console.log('[Standings] Recalculating after match deletion for group:', match.group_id);
        await standingsApi.recalculate(match.tournament_id, match.group_id);
      } catch (err) {
        console.error('[Standings] Failed to recalculate after match deletion:', err);
      }
    }
  },

  // 日程自動生成（予選リーグ）- Supabase Edge Functionが必要
  generateSchedule: async (data: { tournamentId: number; groupId?: string }): Promise<{ created: number }> => {
    // 今後実装: Supabase Edge Functionで処理
    console.warn('generateSchedule: Supabase Edge Function not implemented yet');
    return { created: 0 };
  },

  // 研修試合生成
  generateTrainingMatches: async (tournamentId: number): Promise<{ created: number }> => {
    console.warn('generateTrainingMatches: Supabase Edge Function not implemented yet');
    return { created: 0 };
  },

  // 決勝トーナメント生成
  generateFinals: async (tournamentId: number): Promise<{ created: number }> => {
    console.warn('generateFinals: Supabase Edge Function not implemented yet');
    return { created: 0 };
  },

  // 承認
  approve: async (id: number): Promise<Match> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('matches')
      .update({
        approval_status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Match;
  },

  // 後方互換: 承認
  approveMatch: async (id: number): Promise<Match> => {
    return matchApi.approve(id);
  },

  // 却下
  reject: async (id: number, reason: string): Promise<Match> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('matches')
      .update({
        approval_status: 'rejected',
        approved_by: user?.id,
        rejection_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Match;
  },

  // 後方互換: 却下
  rejectMatch: async (id: number, reason: string): Promise<Match> => {
    return matchApi.reject(id, reason);
  },

  // ロック取得
  lock: async (id: number): Promise<MatchLock> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('matches')
      .update({ locked_by: user.id, locked_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return {
      matchId: id,
      lockedBy: data.locked_by,
      lockedAt: data.locked_at,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  },

  // ロック解除
  unlock: async (id: number, force?: boolean): Promise<MatchLock> => {
    const { data, error } = await supabase
      .from('matches')
      .update({ locked_by: null, locked_at: null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return {
      matchId: id,
      lockedBy: null,
      lockedAt: null,
      expiresAt: null,
    };
  },

  // 承認待ち一覧
  getPendingApproval: async (tournamentId: number): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed')
      .order('match_date')
      .order('match_time');
    if (error) throw error;
    return data as Match[];
  },
};
