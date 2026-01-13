// src/features/final-day/api.ts
// 最終日組み合わせAPI呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type { MatchWithDetails } from '@shared/types';
import type { SwapTeamsRequest } from './types';
import {
  calculateMixedVenueSchedule,
  isMixedUseVenue,
  getFinalsMatchCount,
  type MixedVenueConfig,
} from '@/lib/mixedVenueScheduler';
import { standingApi } from '@/features/standings/api';

// バックエンドAPI URL
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:8001';

// 決勝進出チーム選出用のヘルパー関数
interface QualifyingTeam {
  teamId: number;
  teamName: string;
  groupId: string;
  rank: number;      // グループ内順位
  overallRank?: number; // 総合順位
}

/**
 * グループ順位ルール: 各グループ1位を取得
 */
async function getGroupWinners(tournamentId: number): Promise<QualifyingTeam[]> {
  const { data: standings, error } = await supabase
    .from('standings')
    .select(`
      *,
      team:teams(id, name, short_name)
    `)
    .eq('tournament_id', tournamentId)
    .eq('rank', 1)
    .order('group_id');

  if (error) throw error;

  return (standings || []).map(s => ({
    teamId: s.team?.id || s.team_id,
    teamName: s.team?.short_name || s.team?.name || '',
    groupId: s.group_id,
    rank: s.rank,
  }));
}

/**
 * 総合順位ルール: 上位4チームを取得
 */
async function getOverallTopTeams(tournamentId: number, count: number = 4): Promise<QualifyingTeam[]> {
  const overallStandings = await standingApi.getOverallStandings(tournamentId);

  return overallStandings.entries.slice(0, count).map(entry => ({
    teamId: entry.teamId,
    teamName: entry.shortName || entry.teamName,
    groupId: entry.groupId,
    rank: entry.groupRank,
    overallRank: entry.overallRank,
  }));
}

/**
 * 決勝進出チームを取得（ルールに応じて）
 */
async function getQualifyingTeams(
  tournamentId: number,
  qualificationRule: 'group_based' | 'overall_ranking'
): Promise<QualifyingTeam[]> {
  if (qualificationRule === 'overall_ranking') {
    return getOverallTopTeams(tournamentId, 4);
  } else {
    return getGroupWinners(tournamentId);
  }
}

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
      .in('stage', ['semifinal', 'third_place', 'final'])
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
   * 最終日スケジュールを自動生成
   * - 決勝トーナメント（準決勝、3位決定戦、決勝）
   * - 研修試合（決勝進出チーム以外）
   */
  generateFinalDaySchedule: async (tournamentId: number): Promise<MatchWithDetails[]> => {
    // 1. 大会設定を取得
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new Error('大会設定が見つかりません');
    }

    const qualificationRule = tournament.qualification_rule || 'group_based';
    const finalDate = tournament.end_date;
    const finalsStartTime = tournament.finals_start_time || '09:00';
    const finalsMatchDuration = tournament.finals_match_duration || 60;
    const finalsIntervalMinutes = tournament.finals_interval_minutes || 20;

    // 2. 決勝進出チームを取得
    const qualifyingTeams = await getQualifyingTeams(tournamentId, qualificationRule);

    if (qualifyingTeams.length < 4) {
      throw new Error(`決勝進出チームが不足しています（${qualifyingTeams.length}/4チーム）`);
    }

    // 3. 決勝会場を取得
    const { data: finalsVenue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('is_finals_venue', true)
      .single();

    if (venueError || !finalsVenue) {
      throw new Error('決勝会場が設定されていません');
    }

    // 4. 既存の最終日試合を削除
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('match_date', finalDate);

    // 5. 準決勝の組み合わせを決定
    // グループ順位ルール: A1 vs C1, B1 vs D1
    // 総合順位ルール: 1位 vs 4位, 2位 vs 3位
    let semifinalPairs: [QualifyingTeam, QualifyingTeam][];

    if (qualificationRule === 'overall_ranking') {
      // 総合順位: 1位vs4位, 2位vs3位
      semifinalPairs = [
        [qualifyingTeams[0], qualifyingTeams[3]], // 1位 vs 4位
        [qualifyingTeams[1], qualifyingTeams[2]], // 2位 vs 3位
      ];
    } else {
      // グループ順位: A1 vs C1, B1 vs D1
      const sorted = [...qualifyingTeams].sort((a, b) => a.groupId.localeCompare(b.groupId));
      semifinalPairs = [
        [sorted[0], sorted[2]], // A1 vs C1
        [sorted[1], sorted[3]], // B1 vs D1
      ];
    }

    // 6. 時間計算用ヘルパー
    const addMinutes = (time: string, minutes: number): string => {
      const [h, m] = time.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const newH = Math.floor(totalMinutes / 60);
      const newM = totalMinutes % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    };

    // 7. 試合レコードを作成
    const matchesToInsert = [];
    let currentTime = finalsStartTime;
    let matchOrder = 1;

    // 準決勝1
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: finalsVenue.id,
      home_team_id: semifinalPairs[0][0].teamId,
      away_team_id: semifinalPairs[0][1].teamId,
      match_date: finalDate,
      match_time: currentTime,
      match_order: matchOrder++,
      stage: 'semifinal',
      status: 'scheduled',
      notes: qualificationRule === 'overall_ranking'
        ? `準決勝1（総合1位 vs 総合4位）`
        : `準決勝1（${semifinalPairs[0][0].groupId}1位 vs ${semifinalPairs[0][1].groupId}1位）`,
    });
    currentTime = addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);

    // 準決勝2
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: finalsVenue.id,
      home_team_id: semifinalPairs[1][0].teamId,
      away_team_id: semifinalPairs[1][1].teamId,
      match_date: finalDate,
      match_time: currentTime,
      match_order: matchOrder++,
      stage: 'semifinal',
      status: 'scheduled',
      notes: qualificationRule === 'overall_ranking'
        ? `準決勝2（総合2位 vs 総合3位）`
        : `準決勝2（${semifinalPairs[1][0].groupId}1位 vs ${semifinalPairs[1][1].groupId}1位）`,
    });
    currentTime = addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);

    // 3位決定戦（チームはTBD - 準決勝後に決定）
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: finalsVenue.id,
      home_team_id: null,
      away_team_id: null,
      match_date: finalDate,
      match_time: currentTime,
      match_order: matchOrder++,
      stage: 'third_place',
      status: 'scheduled',
      notes: '3位決定戦（準決勝敗者同士）',
      home_seed: 'SF1敗者',
      away_seed: 'SF2敗者',
    });
    currentTime = addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);

    // 決勝（チームはTBD - 準決勝後に決定）
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: finalsVenue.id,
      home_team_id: null,
      away_team_id: null,
      match_date: finalDate,
      match_time: currentTime,
      match_order: matchOrder++,
      stage: 'final',
      status: 'scheduled',
      notes: '決勝（準決勝勝者同士）',
      home_seed: 'SF1勝者',
      away_seed: 'SF2勝者',
    });

    // 8. 試合をDBに挿入
    const { error: insertError } = await supabase
      .from('matches')
      .insert(matchesToInsert);

    if (insertError) {
      console.error('Failed to insert matches:', insertError);
      throw new Error('試合の作成に失敗しました');
    }

    // 9. 作成した試合を取得して返す
    const { data: createdMatches, error: fetchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('match_date', finalDate)
      .order('match_time');

    if (fetchError) throw fetchError;
    return (createdMatches || []) as MatchWithDetails[];
  },

  /**
   * 決勝トーナメントを自動生成（互換性のため残す）
   */
  generateFinals: async (
    tournamentId: number,
    matchDate: string,
    startTime: string = '09:00',
    venueId?: number
  ): Promise<MatchWithDetails[]> => {
    // generateFinalDayScheduleを呼び出す
    return finalDayApi.generateFinalDaySchedule(tournamentId);
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
      .eq('stage', 'semifinal')
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
   * 試合のチームを変更
   */
  updateMatchTeams: async (
    matchId: number,
    homeTeamId: number,
    awayTeamId: number
  ): Promise<MatchWithDetails> => {
    const { data, error } = await supabase
      .from('matches')
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
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

    // match1を更新
    const update1: Record<string, number> = {};
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

    // match2を更新
    const update2: Record<string, number> = {};
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

  /**
   * 混合会場の試合時間を再計算して更新
   * @param tournamentId 大会ID
   * @param venueId 会場ID
   * @param config 混合会場設定
   */
  recalculateMixedVenueMatchTimes: async (
    tournamentId: number,
    venueId: number,
    config: MixedVenueConfig
  ): Promise<{ updated: number; matches: MatchWithDetails[] }> => {
    // 該当会場の最終日試合を取得（時間順）
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('venue_id', venueId)
      .in('stage', ['semifinal', 'third_place', 'final', 'training'])
      .order('match_order');

    if (error) throw error;
    if (!matches || matches.length === 0) {
      return { updated: 0, matches: [] };
    }

    // 混合会場の試合時間を計算
    const timeSlots = calculateMixedVenueSchedule(config, matches.length);

    // 各試合の時間と試合時間を更新
    let updated = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const slot = timeSlots[i];

      // ステージを確認して適切に設定
      const isFinalMatch = slot.matchType === 'finals';
      const newStage = isFinalMatch
        ? (match.stage === 'training' ? 'semifinal' : match.stage) // 研修から決勝に変更の場合はsemifinalに
        : 'training';

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          match_time: slot.kickoffTime,
          match_duration_minutes: slot.matchDuration,
          stage: newStage,
        })
        .eq('id', match.id);

      if (!updateError) {
        updated++;
      }
    }

    // 更新後のデータを取得
    const { data: updatedMatches } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('venue_id', venueId)
      .in('stage', ['semifinal', 'third_place', 'final', 'training'])
      .order('match_time');

    return {
      updated,
      matches: (updatedMatches || []) as MatchWithDetails[],
    };
  },

  /**
   * 研修試合（順位リーグ）を生成
   * 決勝進出チーム以外を順位ごとに会場割り当てして対戦
   * 制約（同地域、同リーグ、地元同士）を考慮して最適な組み合わせを生成
   */
  generateTrainingMatches: async (tournamentId: number): Promise<MatchWithDetails[]> => {
    // 1. 大会設定を取得
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new Error('大会設定が見つかりません');
    }

    const qualificationRule = tournament.qualification_rule || 'group_based';
    const finalDate = tournament.end_date;
    const startTime = tournament.preliminary_start_time || '09:00';

    // 2. 決勝進出チームを取得
    let qualifyingTeamIds: number[] = [];
    if (qualificationRule === 'overall_ranking') {
      const overallStandings = await standingApi.getOverallStandings(tournamentId);
      qualifyingTeamIds = overallStandings.entries.slice(0, 4).map(e => e.teamId);
    } else {
      const { data: groupWinners } = await supabase
        .from('standings')
        .select('team_id')
        .eq('tournament_id', tournamentId)
        .eq('rank', 1);
      qualifyingTeamIds = (groupWinners || []).map(s => s.team_id);
    }

    // 3. 会場を取得（forFinalDay = true の会場のみ）
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('for_final_day', true)
      .order('id');

    if (venuesError || !venues || venues.length === 0) {
      throw new Error('最終日用の会場がありません');
    }

    // 4. 研修試合用のチームを取得（決勝進出チーム以外、制約情報も含む）
    const { data: allTeams, error: teamsError } = await supabase
      .from('standings')
      .select(`
        *,
        team:teams(id, name, short_name, group_id, region, league_id, team_type)
      `)
      .eq('tournament_id', tournamentId)
      .not('team_id', 'in', `(${qualifyingTeamIds.join(',')})`)
      .order('rank')
      .order('group_id');

    if (teamsError) throw teamsError;

    // 5. 過去の対戦履歴を取得
    const { data: pastMatches } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('tournament_id', tournamentId)
      .neq('stage', 'training');

    const playedPairs = new Set<string>();
    (pastMatches || []).forEach(m => {
      const key = [m.home_team_id, m.away_team_id].sort().join('-');
      playedPairs.add(key);
    });

    // 6. 既存の研修試合を削除
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('stage', 'training');

    // 7. チームを順位ごとにグループ化
    interface TeamInfo {
      teamId: number;
      teamName: string;
      groupId: string;
      rank: number;
      region?: string;
      leagueId?: number;
      teamType?: string;
    }
    const teamsByRank: Record<number, TeamInfo[]> = {};
    for (const s of (allTeams || [])) {
      if (!teamsByRank[s.rank]) teamsByRank[s.rank] = [];
      teamsByRank[s.rank].push({
        teamId: s.team_id,
        teamName: s.team?.short_name || s.team?.name || '',
        groupId: s.team?.group_id || s.group_id,
        rank: s.rank,
        region: s.team?.region,
        leagueId: s.team?.league_id,
        teamType: s.team?.team_type,
      });
    }

    // 8. 対戦ペアのスコアを計算（警告が少ないほど低スコア）
    const calculatePairScore = (teamA: TeamInfo, teamB: TeamInfo): number => {
      let score = 0;

      // 同グループ（予選で対戦済み）→ 除外
      if (teamA.groupId === teamB.groupId) return Infinity;

      // 過去に対戦済み → +100
      const pairKey = [teamA.teamId, teamB.teamId].sort().join('-');
      if (playedPairs.has(pairKey)) score += 100;

      // 地元同士 → +50
      if (teamA.teamType === 'local' && teamB.teamType === 'local') score += 50;

      // 同地域 → +30
      if (teamA.region && teamB.region && teamA.region === teamB.region) score += 30;

      // 同リーグ → +20
      if (teamA.leagueId && teamB.leagueId && teamA.leagueId === teamB.leagueId) score += 20;

      return score;
    };

    // 9. 会場ごとの試合数を計算: (参加校数 - 4) / 会場数
    const totalTrainingTeams = (allTeams || []).length;
    const teamsPerVenue = Math.ceil(totalTrainingTeams / venues.length);
    const matchesPerVenue = Math.floor(teamsPerVenue / 2);
    console.log(`[Training] 研修参加: ${totalTrainingTeams}チーム, 会場: ${venues.length}, 会場あたり: ${teamsPerVenue}チーム, ${matchesPerVenue}試合`);

    // 10. 全チームを順位順にソートして会場に振り分け
    const allTrainingTeams: TeamInfo[] = [];
    for (let rank = 2; rank <= 10; rank++) {
      const teams = teamsByRank[rank] || [];
      allTrainingTeams.push(...teams);
    }

    // 会場ごとにチームを割り当て（順位順で均等に）
    const venueAssignments: Map<number, TeamInfo[]> = new Map();
    venues.forEach(v => venueAssignments.set(v.id, []));

    allTrainingTeams.forEach((team, index) => {
      const venueIndex = index % venues.length;
      const venue = venues[venueIndex];
      venueAssignments.get(venue.id)!.push(team);
    });

    // 11. 各会場でリーグ戦（総当たり）を生成
    const matchesToInsert: any[] = [];
    let matchOrder = 200;

    for (const venue of venues) {
      const teamsInVenue = venueAssignments.get(venue.id) || [];
      if (teamsInVenue.length < 2) continue;

      // 会場内の平均順位（リーグ名用）
      const avgRank = Math.round(teamsInVenue.reduce((sum, t) => sum + t.rank, 0) / teamsInVenue.length);

      // 全ペアを生成（リーグ戦 = 総当たり）
      const pairs: { teamA: TeamInfo; teamB: TeamInfo; score: number }[] = [];
      for (let i = 0; i < teamsInVenue.length; i++) {
        for (let j = i + 1; j < teamsInVenue.length; j++) {
          const score = calculatePairScore(teamsInVenue[i], teamsInVenue[j]);
          // 同グループ以外は全て対戦（リーグ戦）
          if (score < Infinity) {
            pairs.push({ teamA: teamsInVenue[i], teamB: teamsInVenue[j], score });
          }
        }
      }

      // スコア順にソート（警告が少ない試合を先に配置）
      pairs.sort((a, b) => a.score - b.score);

      // 全ペアを試合として生成
      for (const pair of pairs) {
        matchesToInsert.push({
          tournament_id: tournamentId,
          venue_id: venue.id,
          home_team_id: pair.teamA.teamId,
          away_team_id: pair.teamB.teamId,
          match_date: finalDate,
          start_time: startTime,
          match_order: matchOrder++,
          stage: 'training',
          status: 'scheduled',
          notes: `${avgRank}位リーグ`,
        });
      }

      console.log(`[Training] 会場${venue.id}: ${teamsInVenue.length}チーム, ${pairs.length}試合 (${avgRank}位リーグ)`);
    }

    // 10. 試合をDBに挿入
    if (matchesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchesToInsert);

      if (insertError) {
        console.error('Failed to insert training matches:', insertError);
        throw new Error('研修試合の作成に失敗しました');
      }
    }

    // 11. 作成した試合を取得して返す
    const { data: createdMatches, error: fetchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('stage', 'training')
      .order('start_time');

    if (fetchError) throw fetchError;
    return (createdMatches || []) as MatchWithDetails[];
  },
};
