// src/features/matches/api.ts
// 試合API呼び出し - Supabase版
import { matchesApi, standingsApi } from '@/lib/api';
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

// Supabase APIレスポンス型（snake_case）
interface MatchApiResponse {
  id: number;
  match_date?: string;
  match_time?: string;
  match_order?: number;
  venue_id?: number;
  home_team_id?: number;
  away_team_id?: number;
  home_team?: Record<string, unknown>;
  away_team?: Record<string, unknown>;
  home_score_total?: number;
  away_score_total?: number;
  home_score_half1?: number;
  home_score_half2?: number;
  away_score_half1?: number;
  away_score_half2?: number;
  home_pk?: number;
  away_pk?: number;
  has_penalty_shootout?: boolean;
  locked_by?: string | null;
  locked_at?: string | null;
  goals?: GoalApiResponse[];
  [key: string]: unknown;
}

interface GoalApiResponse {
  id: number;
  match_id?: number;
  team_id?: number;
  player_id?: number;
  player_name?: string;
  jersey_number?: number;
  minute?: number;
  half?: number;
  is_own_goal?: boolean;
  is_penalty?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const matchApi = {
  // 試合一覧取得
  getAll: async (params?: {
    tournamentId?: number;
    groupId?: string;
    venueId?: number;
    matchDate?: string;
    stage?: MatchStage;
    isBMatch?: boolean; // 新フォーマット: B戦フィルタ
    matchDay?: number; // 新フォーマット: 試合日フィルタ
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
    // 新フォーマット対応: B戦フィルタ
    if (params?.isBMatch !== undefined) {
      query = query.eq('is_b_match', params.isBMatch);
    }
    // 新フォーマット対応: 試合日フィルタ
    if (params?.matchDay !== undefined) {
      query = query.eq('match_day', params.matchDay);
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
      query = query.eq('group_id', String(params.groupId || params.group_id));
    }
    if (params?.venueId || params?.venue_id) {
      query = query.eq('venue_id', Number(params.venueId || params.venue_id));
    }
    if (params?.matchDate || params?.match_date) {
      query = query.eq('match_date', String(params.matchDate || params.match_date));
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
    const matches = ((data || []) as MatchApiResponse[]).map((m) => ({
      ...m,
      // Required fields
      tournamentId: m.tournament_id || tournamentId,
      stage: m.stage || 'preliminary',
      status: m.status || 'scheduled',
      venue: m.venue || {},
      homeTeam: m.home_team || {},
      awayTeam: m.away_team || {},
      createdAt: m.created_at || '',
      updatedAt: m.updated_at || '',
      isLocked: Boolean(m.locked_by),
      // Optional camelCase conversions
      matchDate: m.match_date,
      matchTime: m.match_time,
      matchOrder: m.match_order,
      venueId: m.venue_id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeScoreTotal: m.home_score_total,
      awayScoreTotal: m.away_score_total,
      homeScoreHalf1: m.home_score_half1,
      homeScoreHalf2: m.home_score_half2,
      awayScoreHalf1: m.away_score_half1,
      awayScoreHalf2: m.away_score_half2,
      homePK: m.home_pk,
      awayPK: m.away_pk,
      hasPenaltyShootout: m.has_penalty_shootout,
      // goals も snake_case → camelCase 変換
      goals: (m.goals || []).map((g: GoalApiResponse) => ({
        id: g.id,
        matchId: g.match_id,
        teamId: g.team_id,
        playerId: g.player_id,
        playerName: g.player_name,
        jerseyNumber: g.jersey_number,
        minute: g.minute,
        half: g.half,
        isOwnGoal: g.is_own_goal || false,
        isPenalty: g.is_penalty || false,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
    })) as unknown as MatchWithDetails[];

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
        match_order: data.matchOrder,
        stage: data.stage || 'preliminary',
        status: 'scheduled',
      } as never)
      .select()
      .single();
    if (error) throw error;
    return match as Match;
  },

  // スコア入力
  updateScore: async (id: number, data: MatchScoreInput): Promise<Match> => {
    // スコアが実際に入力されているかチェック
    // null/undefinedはスコア未入力、0は正当なスコア（0点）として扱う
    const hasScoreInput =
      data.homeScoreHalf1 !== null && data.homeScoreHalf1 !== undefined ||
      data.homeScoreHalf2 !== null && data.homeScoreHalf2 !== undefined ||
      data.awayScoreHalf1 !== null && data.awayScoreHalf1 !== undefined ||
      data.awayScoreHalf2 !== null && data.awayScoreHalf2 !== undefined;

    // スコア入力がある場合のみ'completed'に設定
    // スコア未入力の場合は'scheduled'のまま（または既存のstatus維持）
    const status = data.status || (hasScoreInput ? 'completed' : 'scheduled');

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
          jersey_number: g.jerseyNumber || null,
          minute: g.minute,
          half: g.half,
          is_own_goal: g.isOwnGoal || false,
        }));

        const { error: goalsError } = await supabase
          .from('goals')
          .insert(goalsToInsert as never);

        if (goalsError) {
          console.error('[Goals] Failed to save goals:', goalsError);
          throw new Error(`得点者の保存に失敗しました: ${goalsError.message}`);
        }
      } catch (err) {
        console.error('[Goals] Error saving goals:', err);
        throw err;
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
      const { data: matchDataRaw } = await supabase
        .from('matches')
        .select('tournament_id, group_id, stage')
        .eq('id', id)
        .single();

      const matchData = matchDataRaw as { tournament_id: number; group_id: string | null; stage: string } | null;
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
    const { data: matchRaw } = await supabase
      .from('matches')
      .select('tournament_id, group_id, stage')
      .eq('id', id)
      .single();

    const match = matchRaw as { tournament_id: number; group_id: string | null; stage: string } | null;

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
  generateSchedule: async (_data: { tournamentId: number; groupId?: string }): Promise<{ created: number }> => {
    // 今後実装: Supabase Edge Functionで処理
    console.warn('generateSchedule: Supabase Edge Function not implemented yet');
    return { created: 0 };
  },

  // 研修試合生成
  generateTrainingMatches: async (_tournamentId: number): Promise<{ created: number }> => {
    console.warn('generateTrainingMatches: Supabase Edge Function not implemented yet');
    return { created: 0 };
  },

  // 決勝トーナメント生成
  generateFinals: async (_tournamentId: number): Promise<{ created: number }> => {
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
      } as never)
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
      } as never)
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
      .update({ locked_by: user.id, locked_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const matchData = data as { locked_by?: string; locked_at?: string };
    return {
      matchId: id,
      isLocked: true,
      lockedBy: matchData.locked_by ? Number(matchData.locked_by) : undefined,
      lockedAt: matchData.locked_at,
    };
  },

  // ロック解除
  unlock: async (id: number, _force?: boolean): Promise<MatchLock> => {
    const { error } = await supabase
      .from('matches')
      .update({ locked_by: null, locked_at: null } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return {
      matchId: id,
      isLocked: false,
      lockedBy: undefined,
      lockedAt: undefined,
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

  /**
   * ステージ別試合一括削除
   * @param tournamentId 大会ID
   * @param stage ステージ（preliminary, finals, training, all）
   */
  deleteByStage: async (
    tournamentId: number,
    stage: 'preliminary' | 'finals' | 'training' | 'all'
  ): Promise<{ deleted: number }> => {
    let deleteQuery = supabase.from('matches').delete().eq('tournament_id', tournamentId);

    if (stage === 'preliminary') {
      deleteQuery = deleteQuery.eq('stage', 'preliminary');
    } else if (stage === 'finals') {
      deleteQuery = deleteQuery.in('stage', ['semifinal', 'third_place', 'final']);
    } else if (stage === 'training') {
      deleteQuery = deleteQuery.eq('stage', 'training');
    }
    // 'all' の場合は tournament_id フィルタのみ

    const { error, count } = await deleteQuery;
    if (error) throw error;
    return { deleted: count || 0 };
  },

  /**
   * 試合一括作成
   * @param matches 作成する試合データ配列
   */
  bulkInsert: async (
    matches: Array<{
      tournament_id: number;
      group_id?: string | null;
      home_team_id?: number | null;
      away_team_id?: number | null;
      venue_id?: number | null;
      match_date: string;
      match_time: string;
      match_order?: number;
      stage: string;
      status?: string;
      is_b_match?: boolean;
    }>
  ): Promise<{ created: number }> => {
    if (matches.length === 0) return { created: 0 };

    const { error, count } = await supabase
      .from('matches')
      .insert(matches as never);

    if (error) throw error;
    return { created: count || matches.length };
  },
};
