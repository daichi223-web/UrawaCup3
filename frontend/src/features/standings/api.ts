// src/features/standings/api.ts
// 順位表API呼び出し - Supabase版
import { standingsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { GroupStandings, TopScorer, ResolveTiebreakerInput, OverallStandings, OverallStandingEntry } from './types';

// Type for group query result
interface GroupQueryResult {
  id: string;
}

// Type for standings with team query result
interface StandingsWithTeamResult {
  id: number;
  tournament_id: number;
  group_id: string;
  team_id: number;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  overall_rank?: number | null;
  team?: {
    id: number;
    name: string;
    short_name?: string | null;
  } | null;
}

// Type for tournament qualification settings
interface TournamentQualificationResult {
  advancing_teams?: number | null;
  qualification_rule?: string | null;
}


export const standingApi = {
  // グループ別順位表取得
  getByGroup: async (tournamentId: number, groupId: string): Promise<GroupStandings> => {
    const allGroups = await standingsApi.getByGroup(tournamentId);
    const found = allGroups.find(g => g.groupId === groupId);
    if (!found) {
      return { groupId, standings: [], needsTiebreaker: false };
    }
    const standingsData = (found.standings || []) as StandingsWithTeamResult[];
    return {
      groupId: found.groupId,
      standings: standingsData.map(s => ({
        teamId: s.team?.id || 0,
        teamName: s.team?.name || '',
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goals_for,
        goalsAgainst: s.goals_against,
        goalDifference: s.goal_difference,
        points: s.points,
        rank: s.rank,
      })),
      needsTiebreaker: false,
    };
  },

  // 後方互換: グループ別順位表取得
  getStandingsByGroup: async (tournamentId: number): Promise<GroupStandings[]> => {
    const allGroups = await standingsApi.getByGroup(tournamentId);
    return allGroups.map(g => {
      const standingsData = (g.standings || []) as StandingsWithTeamResult[];
      return {
        groupId: g.groupId,
        standings: standingsData.map(s => ({
          teamId: s.team?.id || 0,
          teamName: s.team?.name || '',
          played: s.played,
          won: s.won,
          drawn: s.drawn,
          lost: s.lost,
          goalsFor: s.goals_for,
          goalsAgainst: s.goals_against,
          goalDifference: s.goal_difference,
          points: s.points,
          rank: s.rank,
        })),
        needsTiebreaker: false,
      };
    });
  },

  // 全グループ順位表取得
  getAll: async (tournamentId: number): Promise<GroupStandings[]> => {
    return standingApi.getStandingsByGroup(tournamentId);
  },

  // 順位再計算
  recalculate: async (tournamentId: number, groupId?: string): Promise<void> => {
    if (groupId) {
      await standingsApi.recalculate(tournamentId, groupId);
    } else {
      // 全グループを再計算
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('tournament_id', tournamentId);

      const groups = data as GroupQueryResult[] | null;
      if (groups && groups.length > 0) {
        for (const group of groups) {
          await standingsApi.recalculate(tournamentId, group.id);
        }
      } else {
        // 一グループ制: group_id なしで再計算
        await standingsApi.recalculate(tournamentId);
      }
    }
  },

  // 抽選結果を登録（タイブレーカー解決）
  resolveTiebreaker: async (data: ResolveTiebreakerInput): Promise<void> => {
    // タイブレーカーの解決（順位を直接更新）
    for (const ranking of data.rankings) {
      const { error } = await supabase
        .from('standings')
        .update({ rank: ranking.rank } as never)
        .eq('tournament_id', data.tournamentId)
        .eq('group_id', data.groupId)
        .eq('team_id', ranking.teamId);

      if (error) throw error;
    }
  },

  // 得点ランキング取得
  getTopScorers: async (tournamentId: number, limit = 10): Promise<TopScorer[]> => {
    const scorers = await standingsApi.getTopScorers(tournamentId, limit);
    return scorers.map(s => ({
      rank: s.rank,
      playerId: 0, // SupabaseではplayerIdがない場合がある
      scorerName: s.scorerName,
      teamId: s.teamId,
      teamName: s.teamName,
      goals: s.goals,
    }));
  },

  /**
   * 総合順位表を取得
   * 全グループの順位を統合し、総合順位を計算
   * ソート順: グループ内順位 → 勝点 → 得失点差 → 総得点
   */
  getOverallStandings: async (tournamentId: number): Promise<OverallStandings> => {
    // 全順位データをチーム情報付きで取得
    const { data: standingsData, error } = await supabase
      .from('standings')
      .select(`
        *,
        team:teams(id, name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true });

    if (error) {
      console.error('[Standings] getOverallStandings error:', error);
      throw error;
    }

    console.log(`[Standings] getOverallStandings: raw rows=${standingsData?.length || 0}`);
    if (standingsData && standingsData.length > 0) {
      const first = standingsData[0] as Record<string, unknown>;
      console.log('[Standings] First row sample:', { team_id: first.team_id, group_id: first.group_id, played: first.played, points: first.points, rank: first.rank, team: first.team });
    }

    const standings = standingsData as StandingsWithTeamResult[] | null;

    // 大会設定を取得（決勝進出チーム数）
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('advancing_teams, qualification_rule')
      .eq('id', tournamentId)
      .single();

    const tournament = tournamentData as TournamentQualificationResult | null;
    const qualifyingCount = tournament?.qualification_rule === 'overall_ranking'
      ? 4 // 総合順位ルールでは上位4チーム
      : (tournament?.advancing_teams || 1) * 4; // グループルールではグループ数 × 進出数

    // タイブレーカー設定（デフォルト値を使用）
    const tiebreakerRules: string[] = ['points', 'goal_difference', 'goals_scored'];

    // エントリに変換（試合数 > 0 のチームのみ対象）
    const entries: OverallStandingEntry[] = (standings || [])
      .filter(s => s.played > 0) // 試合入力前のチームは除外
      .map(s => ({
        overallRank: 0, // 後で計算
        groupId: s.group_id,
        groupRank: s.rank,
        teamId: s.team?.id || s.team_id,
        teamName: s.team?.name || '',
        shortName: s.team?.short_name || s.team?.name || '',
        points: s.points,
        goalDifference: s.goal_difference,
        goalsFor: s.goals_for,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
      }));

    // タイブレーカー設定に基づいて総合順位をソート
    entries.sort((a, b) => {
      for (const rule of tiebreakerRules) {
        switch (rule) {
          case 'points':
            if (a.points !== b.points) return b.points - a.points;
            break;
          case 'goal_difference':
            if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
            break;
          case 'goals_scored':
            if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
            break;
        }
      }
      // 同点の場合はグループID順（安定ソート）
      const groupA = a.groupId || '';
      const groupB = b.groupId || '';
      return groupA.localeCompare(groupB);
    });

    // 総合順位を付与
    entries.forEach((entry, index) => {
      entry.overallRank = index + 1;
    });

    return {
      tournamentId,
      entries,
      qualifyingCount,
    };
  },

  /**
   * 総合順位をDBに保存
   */
  saveOverallRanks: async (tournamentId: number): Promise<void> => {
    const overall = await standingApi.getOverallStandings(tournamentId);

    // 各チームのoverall_rankを更新
    for (const entry of overall.entries) {
      const { error } = await supabase
        .from('standings')
        .update({ overall_rank: entry.overallRank } as never)
        .eq('tournament_id', tournamentId)
        .eq('team_id', entry.teamId);

      if (error) {
        console.error('Failed to update overall_rank:', error);
      }
    }
  },

  /**
   * 順位表をクリア（全チーム0勝0敗0分にリセット）
   * 予選試合削除時に呼び出す
   */
  clearStandings: async (tournamentId: number): Promise<void> => {
    const { error } = await supabase
      .from('standings')
      .update({
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        rank: 0,
        overall_rank: null,
      } as never)
      .eq('tournament_id', tournamentId);

    if (error) {
      console.error('Failed to clear standings:', error);
      throw error;
    }
  },

  /**
   * 全グループの順位を一括再計算
   * 不整合データの修復や、一括削除後の再計算に使用
   */
  recalculateAll: async (tournamentId: number): Promise<{ groups: number; success: boolean }> => {
    try {
      // グループ一覧を取得
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (groupsError) throw groupsError;
      const groups = groupsData as GroupQueryResult[] | null;

      let calculatedGroups = 0;
      if (groups && groups.length > 0) {
        // グループ制: 各グループを再計算（試合group_id=nullでもチームIDフォールバックあり）
        for (const group of groups) {
          await standingsApi.recalculate(tournamentId, group.id);
          calculatedGroups++;
          console.log(`[Standings] Recalculated group ${group.id}`);
        }
      } else {
        // 一グループ制: group_id なしで再計算
        console.log('[Standings] No groups found, recalculating as single league');
        await standingsApi.recalculate(tournamentId);
        calculatedGroups = 1;
      }

      console.log(`[Standings] All ${calculatedGroups} groups recalculated for tournament ${tournamentId}`);
      return { groups: calculatedGroups, success: true };
    } catch (error) {
      console.error('[Standings] Failed to recalculate all groups:', error);
      return { groups: 0, success: false };
    }
  },
};
