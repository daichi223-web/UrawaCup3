// src/features/final-day/api.ts
// 最終日組み合わせAPI呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type { MatchWithDetails } from '@shared/types';
import type { SwapTeamsRequest } from './types';

interface MatchListResponse {
  matches: MatchWithDetails[];
  total: number;
}

export const finalDayApi = {
  /**
   * 決勝トーナメント試合一覧を取得
   */
  getFinalMatches: async (tournamentId: number): Promise<MatchWithDetails[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['semi_final', 'third_place', 'final'])
      .order('match_date')
      .order('match_time');

    if (error) throw error;
    return (data || []) as MatchWithDetails[];
  },

  /**
   * 研修試合一覧を取得
   */
  getTrainingMatches: async (tournamentId: number, matchDate?: string): Promise<MatchWithDetails[]> => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('stage', 'training');

    if (matchDate) {
      query = query.eq('match_date', matchDate);
    }

    const { data, error } = await query.order('match_time');
    if (error) throw error;
    return (data || []) as MatchWithDetails[];
  },

  /**
   * 最終日（Day3）の全試合を取得
   */
  getFinalDayMatches: async (tournamentId: number, matchDate: string): Promise<MatchWithDetails[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('match_date', matchDate)
      .order('match_time');

    if (error) throw error;
    return (data || []) as MatchWithDetails[];
  },

  /**
   * 最終日スケジュールを自動生成（Supabase Edge Functionが必要）
   */
  generateFinalDaySchedule: async (tournamentId: number): Promise<MatchWithDetails[]> => {
    console.warn('generateFinalDaySchedule: Supabase Edge Function not implemented yet');
    return [];
  },

  /**
   * 決勝トーナメントを自動生成（Supabase Edge Functionが必要）
   */
  generateFinals: async (
    tournamentId: number,
    matchDate: string,
    startTime: string = '09:00',
    venueId?: number
  ): Promise<MatchWithDetails[]> => {
    console.warn('generateFinals: Supabase Edge Function not implemented yet');
    return [];
  },

  /**
   * 準決勝結果に基づいて決勝・3位決定戦のチームを更新
   */
  updateFinalsBracket: async (tournamentId: number): Promise<void> => {
    // 準決勝の結果を取得
    const { data: semiFinals, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('stage', 'semi_final')
      .eq('status', 'completed');

    if (error) throw error;
    if (!semiFinals || semiFinals.length < 2) {
      console.warn('準決勝が完了していません');
      return;
    }

    // 勝者と敗者を決定
    const winners: number[] = [];
    const losers: number[] = [];

    for (const match of semiFinals) {
      if (match.result === 'home_win') {
        winners.push(match.home_team_id);
        losers.push(match.away_team_id);
      } else if (match.result === 'away_win') {
        winners.push(match.away_team_id);
        losers.push(match.home_team_id);
      }
    }

    // 決勝戦を更新
    if (winners.length === 2) {
      await supabase
        .from('matches')
        .update({
          home_team_id: winners[0],
          away_team_id: winners[1],
        })
        .eq('tournament_id', tournamentId)
        .eq('stage', 'final');
    }

    // 3位決定戦を更新
    if (losers.length === 2) {
      await supabase
        .from('matches')
        .update({
          home_team_id: losers[0],
          away_team_id: losers[1],
        })
        .eq('tournament_id', tournamentId)
        .eq('stage', 'third_place');
    }
  },

  /**
   * 試合のチームを変更（確定フラグも設定）
   */
  updateMatchTeams: async (
    matchId: number,
    homeTeamId: number,
    awayTeamId: number,
    isConfirmed: boolean = true
  ): Promise<MatchWithDetails> => {
    const { data, error } = await supabase
      .from('matches')
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        is_confirmed: isConfirmed,
      })
      .eq('id', matchId)
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .single();

    if (error) throw error;
    return data as MatchWithDetails;
  },

  /**
   * 2試合間でチームを入れ替える
   */
  swapTeams: async (request: SwapTeamsRequest): Promise<{
    match1: MatchWithDetails;
    match2: MatchWithDetails;
  }> => {
    // match1とmatch2の情報を取得
    const { data: matches, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .in('id', [request.match1Id, request.match2Id]);

    if (fetchError || !matches || matches.length !== 2) {
      throw new Error('試合が見つかりません');
    }

    const match1 = matches.find(m => m.id === request.match1Id)!;
    const match2 = matches.find(m => m.id === request.match2Id)!;

    // チームを入れ替え
    const team1ToSwap = request.match1Side === 'home' ? match1.home_team_id : match1.away_team_id;
    const team2ToSwap = request.match2Side === 'home' ? match2.home_team_id : match2.away_team_id;

    // match1を更新（入れ替えにより未確定状態に）
    const update1: Record<string, number | boolean> = { is_confirmed: false };
    if (request.match1Side === 'home') {
      update1.home_team_id = team2ToSwap;
    } else {
      update1.away_team_id = team2ToSwap;
    }

    const { error: update1Error } = await supabase
      .from('matches')
      .update(update1)
      .eq('id', request.match1Id);

    if (update1Error) throw update1Error;

    // match2を更新（入れ替えにより未確定状態に）
    const update2: Record<string, number | boolean> = { is_confirmed: false };
    if (request.match2Side === 'home') {
      update2.home_team_id = team1ToSwap;
    } else {
      update2.away_team_id = team1ToSwap;
    }

    const { error: update2Error } = await supabase
      .from('matches')
      .update(update2)
      .eq('id', request.match2Id);

    if (update2Error) throw update2Error;

    // 更新後のデータを取得
    const { data: updatedMatches, error: refetchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .in('id', [request.match1Id, request.match2Id]);

    if (refetchError || !updatedMatches) {
      throw new Error('更新後のデータ取得に失敗しました');
    }

    return {
      match1: updatedMatches.find(m => m.id === request.match1Id) as MatchWithDetails,
      match2: updatedMatches.find(m => m.id === request.match2Id) as MatchWithDetails,
    };
  },

  /**
   * 試合を削除
   */
  deleteMatch: async (matchId: number): Promise<void> => {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);
    if (error) throw error;
  },

  /**
   * 2チームが予選で対戦済みかチェック
   */
  checkPlayed: async (
    tournamentId: number,
    team1Id: number,
    team2Id: number
  ): Promise<{
    played: boolean;
    matchId: number | null;
    matchDate: string | null;
    homeScore: number | null;
    awayScore: number | null;
    message: string;
  }> => {
    // team1がホーム、team2がアウェイの試合を検索
    const { data: match1 } = await supabase
      .from('matches')
      .select('id, match_date, home_score_total, away_score_total')
      .eq('tournament_id', tournamentId)
      .eq('home_team_id', team1Id)
      .eq('away_team_id', team2Id)
      .eq('stage', 'preliminary')
      .single();

    if (match1) {
      return {
        played: true,
        matchId: match1.id,
        matchDate: match1.match_date,
        homeScore: match1.home_score_total,
        awayScore: match1.away_score_total,
        message: '予選で対戦済みです',
      };
    }

    // team2がホーム、team1がアウェイの試合を検索
    const { data: match2 } = await supabase
      .from('matches')
      .select('id, match_date, home_score_total, away_score_total')
      .eq('tournament_id', tournamentId)
      .eq('home_team_id', team2Id)
      .eq('away_team_id', team1Id)
      .eq('stage', 'preliminary')
      .single();

    if (match2) {
      return {
        played: true,
        matchId: match2.id,
        matchDate: match2.match_date,
        homeScore: match2.away_score_total, // チームの立場を入れ替え
        awayScore: match2.home_score_total,
        message: '予選で対戦済みです',
      };
    }

    return {
      played: false,
      matchId: null,
      matchDate: null,
      homeScore: null,
      awayScore: null,
      message: '予選では対戦していません',
    };
  },
};
