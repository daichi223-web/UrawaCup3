// src/features/standings/api.ts
// 順位表API呼び出し - Supabase版
import { standingsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { GroupStandings, TopScorer, ResolveTiebreakerInput, OverallStandings, OverallStandingEntry } from './types';

export const standingApi = {
  // グループ別順位表取得
  getByGroup: async (tournamentId: number, groupId: string): Promise<GroupStandings> => {
    const allGroups = await standingsApi.getByGroup(tournamentId);
    const found = allGroups.find(g => g.groupId === groupId);
    if (!found) {
      return { groupId, standings: [], needsTiebreaker: false };
    }
    return {
      groupId: found.groupId,
      standings: found.standings.map(s => ({
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
    return allGroups.map(g => ({
      groupId: g.groupId,
      standings: g.standings.map(s => ({
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
    }));
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
      const { data: groups } = await supabase
        .from('groups')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (groups) {
        for (const group of groups) {
          await standingsApi.recalculate(tournamentId, group.id);
        }
      }
    }
  },

  // 抽選結果を登録（タイブレーカー解決）
  resolveTiebreaker: async (data: ResolveTiebreakerInput): Promise<void> => {
    // タイブレーカーの解決（順位を直接更新）
    for (let i = 0; i < data.teamOrder.length; i++) {
      const { error } = await supabase
        .from('standings')
        .update({ rank: i + 1, tiebreaker_resolved: true })
        .eq('tournament_id', data.tournamentId)
        .eq('group_id', data.groupId)
        .eq('team_id', data.teamOrder[i]);

      if (error) throw error;
    }
  },

  // 得点ランキング取得
  getTopScorers: async (tournamentId: number, limit = 10): Promise<TopScorer[]> => {
    const scorers = await standingsApi.getTopScorers(tournamentId, limit);
    return scorers.map(s => ({
      rank: s.rank,
      playerId: 0, // SupabaseではplayerIdがない場合がある
      playerName: s.scorerName,
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
    const { data: standings, error } = await supabase
      .from('standings')
      .select(`
        *,
        team:teams(id, name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true });

    if (error) throw error;

    // 大会設定を取得（決勝進出チーム数）
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('advancing_teams, qualification_rule')
      .eq('id', tournamentId)
      .single();

    const qualifyingCount = tournament?.qualification_rule === 'overall_ranking'
      ? 4 // 総合順位ルールでは上位4チーム
      : (tournament?.advancing_teams || 1) * 4; // グループルールではグループ数 × 進出数

    // エントリに変換
    const entries: OverallStandingEntry[] = (standings || []).map(s => ({
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

    // 総合順位でソート: グループ内順位 → 勝点 → 得失点差 → 総得点
    entries.sort((a, b) => {
      // 1. グループ内順位
      if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
      // 2. 勝点
      if (a.points !== b.points) return b.points - a.points;
      // 3. 得失点差
      if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
      // 4. 総得点
      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      // 同点の場合はグループID順（安定ソート）
      return a.groupId.localeCompare(b.groupId);
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
        .update({ overall_rank: entry.overallRank })
        .eq('tournament_id', tournamentId)
        .eq('team_id', entry.teamId);

      if (error) {
        console.error('Failed to update overall_rank:', error);
      }
    }
  },
};
