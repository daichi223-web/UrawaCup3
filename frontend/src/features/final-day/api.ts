// src/features/final-day/api.ts
// 最終日組み合わせAPI呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type { MatchWithDetails } from '@shared/types';
import type { SwapTeamsRequest } from './types';
import {
  calculateMixedVenueSchedule,
  type MixedVenueConfig,
} from '@/lib/mixedVenueScheduler';
import { standingApi } from '@/features/standings/api';

// Supabase API response types
interface StandingWithTeam {
  team_id: number;
  group_id: string;
  rank: number;
  team?: {
    id: number;
    name: string;
    short_name?: string;
  } | null;
}

interface TournamentSettings {
  qualification_rule?: string;
  bracket_method?: string;
  end_date?: string;
  finals_start_time?: string;
  finals_match_duration?: number;
  finals_interval_minutes?: number;
  preliminary_start_time?: string;
  preliminary_match_duration?: number;
  preliminary_interval_minutes?: number;
  training_match_duration?: number;
  training_interval_minutes?: number;
  training_matches_per_team?: number;
}

// Supabase query result types
interface VenueQueryResult {
  id: number;
  name?: string;
  short_name?: string;
  for_finals?: boolean;
  is_finals_venue?: boolean;
}

interface MatchQueryResult {
  id: number;
  tournament_id?: number;
  venue_id?: number;
  home_team_id?: number | null;
  away_team_id?: number | null;
  match_date?: string;
  match_time?: string;
  match_order?: number;
  stage?: string;
  status?: string;
  result?: string | null;
  home_score_total?: number | null;
  away_score_total?: number | null;
  has_penalty_shootout?: boolean;
  home_pk?: number | null;
  away_pk?: number | null;
  notes?: string;
}

type QualificationRule = 'overall_ranking' | 'group_based';

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

  return ((standings || []) as StandingWithTeam[]).map(s => ({
    teamId: s.team?.id || s.team_id,
    teamName: s.team?.short_name || s.team?.name || '',
    groupId: s.group_id,
    rank: s.rank,
  }));
}

/**
 * 総合順位ルール: 上位4チームを取得
 * standingsテーブルが空の場合は試合データから直接計算
 */
async function getOverallTopTeams(tournamentId: number, count: number = 4): Promise<QualifyingTeam[]> {
  const overallStandings = await standingApi.getOverallStandings(tournamentId);
  console.log(`[Finals] getOverallTopTeams: entries=${overallStandings.entries.length}, qualifyingCount=${overallStandings.qualifyingCount}`);

  if (overallStandings.entries.length >= count) {
    console.log('[Finals] Top entries (from standings):', overallStandings.entries.slice(0, count).map(e => `${e.teamName}(pts:${e.points},played:${e.played})`));
    return overallStandings.entries.slice(0, count).map(entry => ({
      teamId: entry.teamId,
      teamName: entry.shortName || entry.teamName,
      groupId: entry.groupId,
      rank: entry.groupRank,
      overallRank: entry.overallRank,
    }));
  }

  // standingsが空または不足 → 試合データから直接計算
  console.log('[Finals] standings不足、試合データから直接順位を計算');
  return calculateTopTeamsFromMatches(tournamentId, count);
}

/**
 * 試合データから直接順位を計算（standingsテーブルに依存しない）
 */
async function calculateTopTeamsFromMatches(tournamentId: number, count: number): Promise<QualifyingTeam[]> {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, group_id')
    .eq('tournament_id', tournamentId);

  const { data: matches } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score_total, away_score_total')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .or('is_b_match.is.null,is_b_match.eq.false');

  if (!teams || !matches) return [];

  const stats = new Map<number, { pts: number; gd: number; gf: number; played: number }>();
  for (const t of teams) {
    stats.set(t.id, { pts: 0, gd: 0, gf: 0, played: 0 });
  }

  for (const m of matches) {
    const h = m.home_team_id, a = m.away_team_id;
    const hs = m.home_score_total ?? 0, as_ = m.away_score_total ?? 0;
    const hStats = stats.get(h), aStats = stats.get(a);
    if (!hStats || !aStats) continue;

    hStats.played++; aStats.played++;
    hStats.gf += hs; hStats.gd += (hs - as_);
    aStats.gf += as_; aStats.gd += (as_ - hs);

    if (hs > as_) { hStats.pts += 3; }
    else if (hs < as_) { aStats.pts += 3; }
    else { hStats.pts += 1; aStats.pts += 1; }
  }

  const sorted = Array.from(stats.entries())
    .filter(([, s]) => s.played > 0)
    .sort(([, a], [, b]) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

  console.log('[Finals] Calculated top teams from matches:', sorted.slice(0, count).map(([tid, s]) => {
    const team = teams.find(t => t.id === tid);
    return `${team?.short_name || team?.name}(pts:${s.pts},gd:${s.gd})`;
  }));

  return sorted.slice(0, count).map(([tid, s], idx) => {
    const team = teams.find(t => t.id === tid);
    return {
      teamId: tid,
      teamName: team?.short_name || team?.name || '',
      groupId: team?.group_id || '',
      rank: 1,
      overallRank: idx + 1,
    };
  });
}

/**
 * 決勝進出チームを取得（ルールに応じて）
 * グループ数が4未満の場合は自動的に総合順位ルールにフォールバック
 */
async function getQualifyingTeams(
  tournamentId: number,
  qualificationRule: 'group_based' | 'overall_ranking'
): Promise<QualifyingTeam[]> {
  if (qualificationRule === 'overall_ranking') {
    return getOverallTopTeams(tournamentId, 4);
  }

  // グループ数を確認
  const winners = await getGroupWinners(tournamentId);
  if (winners.length >= 4) {
    return winners;
  }

  // グループ数不足の場合、総合順位で上位4チームを取得
  console.log(`[Finals] グループ1位が${winners.length}チームのみ。総合順位ルールにフォールバック`);
  return getOverallTopTeams(tournamentId, 4);
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
  generateFinalDaySchedule: async (
    tournamentId: number,
    options?: { qualificationRule?: 'group_based' | 'overall_ranking' },
  ): Promise<MatchWithDetails[]> => {
    // 1. 大会設定を取得
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new Error('大会設定が見つかりません');
    }

    const t = tournament as TournamentSettings;
    const qualificationRule = (options?.qualificationRule || t.qualification_rule || 'group_based') as QualificationRule;
    const bracketMethod = t.bracket_method || 'seed_order'; // 'diagonal' or 'seed_order'
    const finalDate = t.end_date;
    if (!finalDate) {
      throw new Error('大会終了日が設定されていません');
    }
    const finalsStartTime = t.finals_start_time || '09:00';
    const finalsMatchDuration = t.finals_match_duration || 60;
    const finalsIntervalMinutes = t.finals_interval_minutes || 20;

    console.log(`[Finals] 組み合わせ方式: ${bracketMethod}, 進出ルール: ${qualificationRule}`);

    // 1.5. 順位表を再計算（最新の試合結果を反映）
    console.log('[Finals] 順位表を再計算中...');
    await standingApi.recalculateAll(tournamentId);
    console.log('[Finals] 順位表の再計算完了');

    // 2. 決勝進出チームを取得
    let qualifyingTeams = await getQualifyingTeams(tournamentId, qualificationRule);

    // 試合結果が不足している場合、チーム一覧から暫定的に補完
    if (qualifyingTeams.length < 4) {
      console.log(`[Finals] 決勝進出チーム ${qualifyingTeams.length}/4 - チーム一覧から暫定補完`);
      const existingIds = new Set(qualifyingTeams.map(t => t.teamId));
      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, name, short_name, group_id')
        .eq('tournament_id', tournamentId)
        .order('group_id')
        .order('id');
      if (allTeams) {
        for (const team of allTeams as Array<{ id: number; name: string; short_name?: string; group_id?: string }>) {
          if (qualifyingTeams.length >= 4) break;
          if (existingIds.has(team.id)) continue;
          qualifyingTeams.push({
            teamId: team.id,
            teamName: team.short_name || team.name,
            groupId: team.group_id || '',
            rank: 1,
          });
          existingIds.add(team.id);
        }
      }
      if (qualifyingTeams.length < 4) {
        throw new Error(`チームが不足しています（${qualifyingTeams.length}/4チーム）。チームを登録してください。`);
      }
    }

    // 3. 決勝会場を取得（複数会場対応）
    const { data: finalsVenuesData, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('is_finals_venue', true)
      .order('id');

    if (venueError || !finalsVenuesData || finalsVenuesData.length === 0) {
      throw new Error('決勝会場が設定されていません');
    }

    const finalsVenues = finalsVenuesData as VenueQueryResult[];
    const mainVenue = finalsVenues[0]; // メイン会場（3位決定戦・決勝）
    const hasMultipleVenues = finalsVenues.length >= 2;

    // 4. 既存の最終日試合を削除
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('match_date', finalDate);

    // 5. 準決勝の組み合わせを決定
    // bracket_method:
    //   'diagonal': A1 vs C1, B1 vs D1 (対角線)
    //   'seed_order': 1位 vs 4位, 2位 vs 3位 (シード順)
    let semifinalPairs: [QualifyingTeam, QualifyingTeam][];

    if (qualificationRule === 'overall_ranking') {
      // 総合順位からの進出の場合
      if (bracketMethod === 'diagonal') {
        // 対角線方式: 1位vsC順位相当(3番目), 2位vsD順位相当(4番目)
        // 総合順位では対角線は意味がないので、1vs3, 2vs4 にする
        semifinalPairs = [
          [qualifyingTeams[0], qualifyingTeams[2]], // 1位 vs 3位
          [qualifyingTeams[1], qualifyingTeams[3]], // 2位 vs 4位
        ];
        console.log('[Finals] 総合順位+対角線: 1vs3, 2vs4');
      } else {
        // シード順: 1位vs4位, 2位vs3位
        semifinalPairs = [
          [qualifyingTeams[0], qualifyingTeams[3]], // 1位 vs 4位
          [qualifyingTeams[1], qualifyingTeams[2]], // 2位 vs 3位
        ];
        console.log('[Finals] 総合順位+シード順: 1vs4, 2vs3');
      }
    } else {
      // グループ順位からの進出の場合
      const sorted = [...qualifyingTeams].sort((a, b) => a.groupId.localeCompare(b.groupId));

      if (bracketMethod === 'diagonal') {
        // 対角線方式: A1 vs C1, B1 vs D1
        semifinalPairs = [
          [sorted[0], sorted[2]], // A1 vs C1
          [sorted[1], sorted[3]], // B1 vs D1
        ];
        console.log(`[Finals] グループ順位+対角線: ${sorted[0].groupId}1 vs ${sorted[2].groupId}1, ${sorted[1].groupId}1 vs ${sorted[3].groupId}1`);
      } else {
        // シード順方式: A1 vs D1, B1 vs C1 (上位グループが下位グループと対戦)
        semifinalPairs = [
          [sorted[0], sorted[3]], // A1 vs D1
          [sorted[1], sorted[2]], // B1 vs C1
        ];
        console.log(`[Finals] グループ順位+シード順: ${sorted[0].groupId}1 vs ${sorted[3].groupId}1, ${sorted[1].groupId}1 vs ${sorted[2].groupId}1`);
      }
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

    // 準決勝のノートを作成
    const getSemifinalNote = (pairIndex: number, pair: [QualifyingTeam, QualifyingTeam]): string => {
      if (qualificationRule === 'overall_ranking') {
        const rank1 = pair[0].overallRank || 1;
        const rank2 = pair[1].overallRank || 4;
        return `準決勝${pairIndex + 1}（総合${rank1}位 vs 総合${rank2}位）`;
      } else {
        return `準決勝${pairIndex + 1}（${pair[0].groupId}1位 vs ${pair[1].groupId}1位）`;
      }
    };

    // 準決勝1（メイン会場）
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: mainVenue.id,
      home_team_id: semifinalPairs[0][0].teamId,
      away_team_id: semifinalPairs[0][1].teamId,
      match_date: finalDate,
      match_time: currentTime,
      match_order: matchOrder++,
      stage: 'semifinal',
      status: 'scheduled',
      notes: getSemifinalNote(0, semifinalPairs[0]),
    });

    // 準決勝2（複数会場ならサブ会場で同時刻、1会場なら順次）
    const sf2Venue = hasMultipleVenues ? finalsVenues[1] : mainVenue;
    const sf2Time = hasMultipleVenues ? currentTime : addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);
    if (!hasMultipleVenues) {
      currentTime = addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);
    }

    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: sf2Venue.id,
      home_team_id: semifinalPairs[1][0].teamId,
      away_team_id: semifinalPairs[1][1].teamId,
      match_date: finalDate,
      match_time: sf2Time,
      match_order: matchOrder++,
      stage: 'semifinal',
      status: 'scheduled',
      notes: getSemifinalNote(1, semifinalPairs[1]),
    });
    currentTime = addMinutes(currentTime, finalsMatchDuration + finalsIntervalMinutes);

    // 3位決定戦（メイン会場、チームはTBD - 準決勝後に決定）
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: mainVenue.id,
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

    // 決勝（メイン会場、チームはTBD - 準決勝後に決定）
    matchesToInsert.push({
      tournament_id: tournamentId,
      venue_id: mainVenue.id,
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
      .insert(matchesToInsert as never);

    if (insertError) {
      console.error('Failed to insert matches:', insertError);
      throw new Error('試合の作成に失敗しました');
    }

    // 9. 研修試合（順位リーグ）も同時に生成
    console.log('[Finals] 研修試合を同時生成中...');
    try {
      await finalDayApi.generateTrainingMatches(tournamentId);
      console.log('[Finals] 研修試合の生成完了');
    } catch (trainingError) {
      console.error('[Finals] 研修試合の生成に失敗（決勝トーナメントは生成済み）:', trainingError);
    }

    // 10. 作成した全試合を取得して返す
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
    _matchDate: string,
    _startTime: string = '09:00',
    _venueId?: number
  ): Promise<MatchWithDetails[]> => {
    // generateFinalDayScheduleを呼び出す
    return finalDayApi.generateFinalDaySchedule(tournamentId);
  },

  /**
   * 準決勝結果に基づいて決勝・3位決定戦のチームを更新
   */
  updateFinalsBracket: async (tournamentId: number): Promise<void> => {
    // 準決勝の結果を取得
    const { data: semiFinalsData, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('stage', 'semifinal')
      .eq('status', 'completed');

    if (error) throw error;

    const semiFinals = semiFinalsData as MatchQueryResult[] | null;
    if (!semiFinals || semiFinals.length < 2) {
      console.warn('準決勝が完了していません');
      return;
    }

    // 勝者と敗者を決定
    const winners: number[] = [];
    const losers: number[] = [];

    for (const match of semiFinals) {
      if (!match.home_team_id || !match.away_team_id) continue;

      if (match.result === 'home_win') {
        winners.push(match.home_team_id);
        losers.push(match.away_team_id);
      } else if (match.result === 'away_win') {
        winners.push(match.away_team_id);
        losers.push(match.home_team_id);
      } else if (match.result === 'draw' && match.has_penalty_shootout) {
        // PK戦で決着
        if ((match.home_pk ?? 0) > (match.away_pk ?? 0)) {
          winners.push(match.home_team_id);
          losers.push(match.away_team_id);
        } else {
          winners.push(match.away_team_id);
          losers.push(match.home_team_id);
        }
      }
    }

    if (winners.length < 2 || losers.length < 2) {
      const incomplete = semiFinals.filter(
        (m) => m.result === 'draw' && !m.has_penalty_shootout
      );
      if (incomplete.length > 0) {
        throw new Error(
          `準決勝${incomplete.length}試合が引き分けのままです。PK戦の結果を入力してください。`
        );
      }
      throw new Error(
        `準決勝の結果が不完全です（勝者: ${winners.length}/2, 敗者: ${losers.length}/2）`
      );
    }

    // 決勝戦を更新
    if (winners.length === 2) {
      await supabase
        .from('matches')
        .update({
          home_team_id: winners[0],
          away_team_id: winners[1],
        } as never)
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
        } as never)
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
      } as never)
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
    const { data: matchesData, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .in('id', [request.match1Id, request.match2Id]);

    const matches = matchesData as MatchQueryResult[] | null;

    if (fetchError || !matches || matches.length !== 2) {
      throw new Error('試合が見つかりません');
    }

    const match1 = matches.find(m => m.id === request.match1Id)!;
    const match2 = matches.find(m => m.id === request.match2Id)!;

    // チームを入れ替え (side1, side2 are the property names in SwapTeamsRequest)
    const team1ToSwap = request.side1 === 'home' ? match1.home_team_id : match1.away_team_id;
    const team2ToSwap = request.side2 === 'home' ? match2.home_team_id : match2.away_team_id;

    // match1を更新
    const update1: Record<string, number | null | undefined> = {};
    if (request.side1 === 'home') {
      update1.home_team_id = team2ToSwap;
    } else {
      update1.away_team_id = team2ToSwap;
    }

    const { error: update1Error } = await supabase
      .from('matches')
      .update(update1 as never)
      .eq('id', request.match1Id);

    if (update1Error) throw update1Error;

    // match2を更新
    const update2: Record<string, number | null | undefined> = {};
    if (request.side2 === 'home') {
      update2.home_team_id = team1ToSwap;
    } else {
      update2.away_team_id = team1ToSwap;
    }

    const { error: update2Error } = await supabase
      .from('matches')
      .update(update2 as never)
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

    const typedMatches = updatedMatches as MatchWithDetails[];
    return {
      match1: typedMatches.find(m => m.id === request.match1Id) as MatchWithDetails,
      match2: typedMatches.find(m => m.id === request.match2Id) as MatchWithDetails,
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
    const { data: match1Data } = await supabase
      .from('matches')
      .select('id, match_date, home_score_total, away_score_total')
      .eq('tournament_id', tournamentId)
      .eq('home_team_id', team1Id)
      .eq('away_team_id', team2Id)
      .eq('stage', 'preliminary')
      .single();

    interface MatchCheckResult {
      id: number;
      match_date: string | null;
      home_score_total: number | null;
      away_score_total: number | null;
    }
    const match1 = match1Data as MatchCheckResult | null;

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
    const { data: match2Data } = await supabase
      .from('matches')
      .select('id, match_date, home_score_total, away_score_total')
      .eq('tournament_id', tournamentId)
      .eq('home_team_id', team2Id)
      .eq('away_team_id', team1Id)
      .eq('stage', 'preliminary')
      .single();

    const match2 = match2Data as MatchCheckResult | null;

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

    interface MixedVenueMatch {
      id: number;
      stage: string;
    }
    const typedMatches = matches as MixedVenueMatch[];

    // 混合会場の試合時間を計算
    const timeSlots = calculateMixedVenueSchedule(config, typedMatches.length);

    // 各試合の時間と試合時間を更新
    let updated = 0;
    for (let i = 0; i < typedMatches.length; i++) {
      const match = typedMatches[i];
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
        } as never)
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

    const t2 = tournament as TournamentSettings;
    const qualificationRule = t2.qualification_rule || 'group_based';
    const finalDate = t2.end_date;
    if (!finalDate) {
      throw new Error('大会終了日が設定されていません');
    }
    const startTime = t2.preliminary_start_time || '09:00';
    // 研修試合専用の設定を使用（なければ予選設定にフォールバック）
    const matchDuration = t2.training_match_duration || t2.preliminary_match_duration || 40;
    const intervalMinutes = t2.training_interval_minutes || t2.preliminary_interval_minutes || 5;
    const matchesPerTeam = t2.training_matches_per_team || 2; // チームあたり試合数

    console.log(`[Training] 設定 - 試合時間: ${matchDuration}分, 間隔: ${intervalMinutes}分, 試合数/チーム: ${matchesPerTeam}`);

    // 時間計算用ヘルパー
    const addMinutes = (time: string, minutes: number): string => {
      const [h, m] = time.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const newH = Math.floor(totalMinutes / 60);
      const newM = totalMinutes % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    };

    // 2. 決勝進出チームを取得（既に生成済みの準決勝試合から確実に取得）
    let qualifyingTeamIds: number[] = [];
    const { data: sfMatches } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('tournament_id', tournamentId)
      .in('stage', ['semifinal', 'third_place', 'final']);

    if (sfMatches && sfMatches.length > 0) {
      const ids = new Set<number>();
      for (const m of sfMatches as Array<{ home_team_id: number | null; away_team_id: number | null }>) {
        if (m.home_team_id) ids.add(m.home_team_id);
        if (m.away_team_id) ids.add(m.away_team_id);
      }
      qualifyingTeamIds = Array.from(ids);
      console.log(`[Training] 決勝進出チーム(SF試合から): ${qualifyingTeamIds.join(',')}`);
    }

    // SFが未生成の場合のフォールバック
    if (qualifyingTeamIds.length < 4) {
      console.log('[Training] SF試合未検出、試合データから順位計算');
      const topTeams = await calculateTopTeamsFromMatches(tournamentId, 4);
      qualifyingTeamIds = topTeams.map(t => t.teamId);
      console.log(`[Training] 決勝進出チーム(計算): ${qualifyingTeamIds.join(',')}`);
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
    let allTeams;
    const { data: standingsTeams, error: standingsError } = await supabase
      .from('standings')
      .select(`
        *,
        team:teams(id, name, short_name, group_id, region, league_id, team_type)
      `)
      .eq('tournament_id', tournamentId)
      .not('team_id', 'in', `(${qualifyingTeamIds.join(',')})`)
      .order('rank')
      .order('group_id');

    if (standingsError) throw standingsError;

    if (standingsTeams && standingsTeams.length > 0) {
      allTeams = standingsTeams;
    } else {
      // standingsが空の場合、teamsテーブルから直接取得（決勝進出チーム除外）
      console.log('[Training] standingsが空のため、teamsテーブルからチームを取得');
      let teamsQuery = supabase
        .from('teams')
        .select('id, name, short_name, group_id, region, league_id, team_type')
        .eq('tournament_id', tournamentId)
        .order('id');

      if (qualifyingTeamIds.length > 0) {
        teamsQuery = teamsQuery.not('id', 'in', `(${qualifyingTeamIds.join(',')})`);
      }

      const { data: directTeams, error: teamsError } = await teamsQuery;
      if (teamsError) throw teamsError;

      // standingsと同じ形式に変換
      allTeams = (directTeams || []).map((t: { id: number; name: string; short_name?: string; group_id?: string; region?: string; league_id?: number; team_type?: string }, i: number) => ({
        rank: i + 1,
        team_id: t.id,
        group_id: t.group_id || '',
        team: t,
      }));
    }

    // 5. 過去の対戦履歴を取得
    const { data: pastMatchesData } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('tournament_id', tournamentId)
      .neq('stage', 'training');

    const pastMatches = (pastMatchesData || []) as Array<{ home_team_id: number; away_team_id: number }>;
    const playedPairs = new Set<string>();
    pastMatches.forEach(m => {
      const key = [m.home_team_id, m.away_team_id].sort((a, b) => a - b).join('-');
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

    // Type assertion for standings with team info
    interface StandingWithTeamInfo {
      rank: number;
      team_id: number;
      group_id: string;
      team?: {
        id: number;
        name: string;
        short_name?: string;
        group_id?: string;
        region?: string;
        league_id?: number;
        team_type?: string;
      } | null;
    }
    const typedAllTeams = (allTeams || []) as StandingWithTeamInfo[];

    const teamsByRank: Record<number, TeamInfo[]> = {};
    for (const s of typedAllTeams) {
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

    // 8. ボーナススコアを計算（高スコア = 良い対戦、最大スコアのパターンを採用）
    const calculatePairBonus = (teamA: TeamInfo, teamB: TeamInfo): number => {
      let score = 0;

      // 初対戦（予選未対戦） → +100
      const pairKey = [teamA.teamId, teamB.teamId].sort((a, b) => a - b).join('-');
      if (!playedPairs.has(pairKey)) score += 100;

      // 別地域 → +30
      if (!teamA.region || !teamB.region || teamA.region !== teamB.region) score += 30;

      // 別リーグ → +20
      if (!teamA.leagueId || !teamB.leagueId || teamA.leagueId !== teamB.leagueId) score += 20;

      return score;
    };

    // 9. 会場設定
    interface VenueInfo { id: number; name?: string; manager_team_id?: number | null; }
    const typedVenues = (venues || []) as VenueInfo[];
    const totalTrainingTeams = typedAllTeams.length;
    console.log(`[Training] 研修参加: ${totalTrainingTeams}チーム, 会場: ${typedVenues.length}`);

    // 10. 各会場に地元1チーム + 招待3チーム = 4チームを配置
    // Step A: 全チームを順位順にソート
    const allTeamsSorted: TeamInfo[] = [];
    const ranks = Object.keys(teamsByRank).map(Number).sort((a, b) => a - b);
    ranks.forEach(rank => {
      allTeamsSorted.push(...(teamsByRank[rank] || []));
    });

    // Step B: 各会場の地元チームを決定
    // - ホストチーム（manager_team_id）が研修参加 → そのまま配置
    // - ホストチームが決勝進出 → 会場を持たない地元チームから補充
    const localTeamType = 'local';
    const managerTeamIds = new Set(typedVenues.map(v => v.manager_team_id).filter(Boolean) as number[]);
    const allLocalTeams = allTeamsSorted.filter(t => t.teamType === localTeamType);
    const nonHostLocals = allLocalTeams.filter(t => !managerTeamIds.has(t.teamId));
    // 補充候補を順位順にソート（上位から使う）
    nonHostLocals.sort((a, b) => a.rank - b.rank);
    let replacementIdx = 0;

    const venueLocalTeam: Map<number, TeamInfo> = new Map(); // 会場ID → 配置される地元チーム
    for (const venue of typedVenues) {
      const hostTeamId = venue.manager_team_id;
      const hostTeam = hostTeamId ? allTeamsSorted.find(t => t.teamId === hostTeamId) : null;
      if (hostTeam) {
        // ホストチームが研修参加 → 自校会場に配置
        venueLocalTeam.set(venue.id, hostTeam);
      } else {
        // ホストチームが決勝進出 → 補充
        if (replacementIdx < nonHostLocals.length) {
          venueLocalTeam.set(venue.id, nonHostLocals[replacementIdx++]);
          console.log(`[Training] 会場${venue.name}: ホスト決勝進出 → ${nonHostLocals[replacementIdx - 1].teamName}を配置`);
        }
      }
    }

    // Step C: 地元チームの順位で会場のブロック順を決定
    const venueOrder = [...typedVenues].sort((a, b) => {
      const localA = venueLocalTeam.get(a.id);
      const localB = venueLocalTeam.get(b.id);
      const rankA = localA ? localA.rank : 9999;
      const rankB = localB ? localB.rank : 9999;
      return rankA - rankB;
    });

    console.log(`[Training] 会場ブロック順: ${venueOrder.map((v, i) => {
      const local = venueLocalTeam.get(v.id);
      return `${i + 1}. ${v.name || v.id}(${local ? local.rank + '位:' + local.teamName : '地元なし'})`;
    }).join(', ')}`);

    // Step D: 招待チーム（地元以外）を順位順に各会場へ振り分け
    // 20チーム÷6会場 → 4チーム会場と3チーム会場が混在
    // 上位ブロック（地元チームの順位が高い会場）から優先的に4チームにする
    const assignedTeamIds = new Set(Array.from(venueLocalTeam.values()).map(t => t.teamId));
    const invitedTeams = allTeamsSorted.filter(t => !assignedTeamIds.has(t.teamId));
    const numVenues = venueOrder.length;
    const totalWithLocal = invitedTeams.length + assignedTeamIds.size;
    const basePerVenue = Math.floor(totalWithLocal / numVenues);
    let remainder = totalWithLocal % numVenues;

    const venueAssignments: Map<number, TeamInfo[]> = new Map();
    venueOrder.forEach(v => {
      const local = venueLocalTeam.get(v.id);
      venueAssignments.set(v.id, local ? [local] : []);
    });

    let invIdx = 0;
    for (const venue of venueOrder) {
      const current = venueAssignments.get(venue.id)!;
      // 余りがある会場は+1チーム（上位ブロック優先）
      const targetSize = remainder > 0 ? basePerVenue + 1 : basePerVenue;
      if (remainder > 0) remainder--;
      while (current.length < targetSize && invIdx < invitedTeams.length) {
        current.push(invitedTeams[invIdx++]);
      }
    }
    // 余りチームがあれば最後の会場に追加
    while (invIdx < invitedTeams.length) {
      venueAssignments.get(venueOrder[venueOrder.length - 1].id)!.push(invitedTeams[invIdx++]);
    }

    // 各会場のチーム数をログ出力
    venueOrder.forEach((v, i) => {
      const teams = venueAssignments.get(v.id)!;
      const local = venueLocalTeam.get(v.id);
      console.log(`[Training] ブロック${i + 1} ${v.name || v.id}: ${teams.length}チーム [地元:${local?.teamName || 'なし'}] (${teams.map(t => `${t.rank}位:${t.teamName}`).join(', ')})`);
    });

    // 11. 各会場で最適な対戦パターンを選択
    // 4チームの場合、2試合ずつの組み合わせパターンは3通り:
    //   パターン1: (0v1, 2v3)  パターン2: (0v2, 1v3)  パターン3: (0v3, 1v2)
    interface MatchInsertPayload {
      tournament_id: number;
      venue_id: number;
      home_team_id: number;
      away_team_id: number;
      match_date: string;
      match_time: string;
      match_order: number;
      stage: string;
      status: string;
      notes: string;
      is_b_match: boolean;
    }
    const matchesToInsert: MatchInsertPayload[] = [];

    // is_finals_venue情報を取得するため型を拡張
    interface VenueWithFinals extends VenueInfo { is_finals_venue?: boolean; }
    const typedVenuesWithFinals = (venues || []) as VenueWithFinals[];
    const finalsVenueIds = new Set(typedVenuesWithFinals.filter(v => v.is_finals_venue).map(v => v.id));

    for (const venue of typedVenues) {
      const teamsInVenue = venueAssignments.get(venue.id) || [];
      if (teamsInVenue.length < 2) {
        console.warn(`[Training] 会場${venue.id}: チーム数不足（${teamsInVenue.length}チーム）`);
        continue;
      }

      const avgRank = Math.round(teamsInVenue.reduce((sum, t) => sum + t.rank, 0) / teamsInVenue.length);

      // 4チームの全2試合パターンを列挙し、合計ボーナスが最大のパターンを採用
      type PairSet = [number, number][];
      const pairingPatterns: PairSet[] = [];

      if (teamsInVenue.length === 4) {
        // 4チーム: フルラウンドロビン（6試合 = A戦4 + B戦2）
        // R1: 0v1, 2v3 (A戦) → R2: 0v2, 1v3 (A戦) → R3: 0v3, 1v2 (B戦)
        // 各チーム: A戦2試合 + B戦1試合
        pairingPatterns.push([[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]);
      } else if (teamsInVenue.length === 3) {
        // 3チーム: フルラウンドロビン（3試合）
        pairingPatterns.push([[0, 1], [0, 2], [1, 2]]);
      } else if (teamsInVenue.length === 2) {
        pairingPatterns.push([[0, 1]]);
      } else {
        // 5チーム以上: 全ペアからmatchesPerTeam試合ずつ貪欲に選択
        const allPairs: { i: number; j: number; bonus: number }[] = [];
        for (let i = 0; i < teamsInVenue.length; i++) {
          for (let j = i + 1; j < teamsInVenue.length; j++) {
            allPairs.push({ i, j, bonus: calculatePairBonus(teamsInVenue[i], teamsInVenue[j]) });
          }
        }
        allPairs.sort((a, b) => b.bonus - a.bonus);
        const counts: Record<number, number> = {};
        teamsInVenue.forEach((_, idx) => { counts[idx] = 0; });
        const selected: [number, number][] = [];
        for (const p of allPairs) {
          if (counts[p.i] < matchesPerTeam && counts[p.j] < matchesPerTeam) {
            selected.push([p.i, p.j]);
            counts[p.i]++;
            counts[p.j]++;
          }
        }
        pairingPatterns.push(selected);
      }

      // 最大ボーナスのパターンを選択
      let bestPattern = pairingPatterns[0];
      let bestScore = -1;
      for (const pattern of pairingPatterns) {
        const totalBonus = pattern.reduce((sum, [i, j]) =>
          sum + calculatePairBonus(teamsInVenue[i], teamsInVenue[j]), 0);
        console.log(`[Training] 会場${venue.id} パターン ${JSON.stringify(pattern.map(([i,j]) => `${teamsInVenue[i].teamName} vs ${teamsInVenue[j].teamName}`))}: ボーナス=${totalBonus}`);
        if (totalBonus > bestScore) {
          bestScore = totalBonus;
          bestPattern = pattern;
        }
      }

      // 選択されたパターンから試合を生成
      const isFinalsVenue = finalsVenueIds.has(venue.id);
      let currentTime: string;
      let maxTrainingMatches: number = bestPattern.length;

      if (isFinalsVenue) {
        // 決勝会場: その会場の準決勝終了後から研修試合を開始
        const { data: finalsAtVenue } = await supabase
          .from('matches')
          .select('match_time')
          .eq('tournament_id', tournamentId)
          .eq('venue_id', venue.id)
          .in('stage', ['semifinal', 'third_place', 'final'])
          .order('match_time', { ascending: false })
          .limit(1);

        if (finalsAtVenue && finalsAtVenue.length > 0) {
          const lastFinalsTime = (finalsAtVenue[0] as { match_time: string }).match_time;
          // HH:MM:SS → HH:MM
          const timeParts = lastFinalsTime.split(':');
          const lastTimeStr = `${timeParts[0]}:${timeParts[1]}`;
          // 決勝T試合の時間は通常長い（60分+20分インターバル）ので、finalsMatchDuration を使用
          const finalsMatchDuration = (t2 as TournamentSettings).finals_match_duration || 60;
          const finalsInterval = (t2 as TournamentSettings).finals_interval_minutes || 20;
          currentTime = addMinutes(lastTimeStr, finalsMatchDuration + finalsInterval);
          console.log(`[Training] 決勝会場${venue.id}: SF終了後 ${lastTimeStr} → 研修開始 ${currentTime}`);
        } else {
          currentTime = addMinutes(startTime, matchDuration + intervalMinutes);
        }
        // 決勝会場は1枠分をSFに使うので研修試合を1試合減らす（6→5）
        maxTrainingMatches = Math.min(bestPattern.length, bestPattern.length - 1);
        if (maxTrainingMatches < 1) maxTrainingMatches = bestPattern.length;
      } else {
        currentTime = startTime;
      }
      let matchOrder = 1;

      // 実際に生成する試合数（決勝会場は1試合減）
      const effectivePattern = bestPattern.slice(0, maxTrainingMatches);

      // A戦の試合数 = 各チーム matchesPerTeam 試合分
      const aMatchCount = teamsInVenue.length === 4
        ? matchesPerTeam * teamsInVenue.length / 2  // 4
        : effectivePattern.length;

      for (let pIdx = 0; pIdx < effectivePattern.length; pIdx++) {
        const [i, j] = effectivePattern[pIdx];
        const isBMatch = pIdx >= aMatchCount;
        matchesToInsert.push({
          tournament_id: tournamentId,
          venue_id: venue.id,
          home_team_id: teamsInVenue[i].teamId,
          away_team_id: teamsInVenue[j].teamId,
          match_date: finalDate,
          match_time: currentTime,
          match_order: matchOrder++,
          stage: 'training',
          status: 'scheduled',
          notes: `${avgRank}位リーグ${isBMatch ? '(B)' : ''}`,
          is_b_match: isBMatch,
        });
        currentTime = addMinutes(currentTime, matchDuration + intervalMinutes);
      }

      console.log(`[Training] 会場${venue.id}: ${teamsInVenue.length}チーム, ${effectivePattern.length}試合${isFinalsVenue ? '(決勝会場)' : ''} (${avgRank}位リーグ, ボーナス=${bestScore})`);
    }

    // 10. 試合をDBに挿入
    if (matchesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchesToInsert as never);

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
      .order('match_time');

    if (fetchError) throw fetchError;
    return (createdMatches || []) as MatchWithDetails[];
  },
};
