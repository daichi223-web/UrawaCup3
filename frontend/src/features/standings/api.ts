// src/features/standings/api.ts
// 順位表API呼び出し - Supabase版
import { standingsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { GroupStandings, TopScorer, ResolveTiebreakerInput } from './types';

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
};
