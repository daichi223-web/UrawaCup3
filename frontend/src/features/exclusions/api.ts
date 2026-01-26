// src/features/exclusions/api.ts
// 対戦除外設定API呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type {
  ExclusionPair,
  CreateExclusionInput,
  ExclusionSuggestion,
  BulkExclusionInput,
} from './types';

// 後方互換のため@shared/typesからの型もインポート
import type { GroupExclusions, ExclusionPairCreate } from '@shared/types';

// Supabase API response types
interface GroupRow {
  id: string;
  name: string;
}

interface TeamRow {
  id: number;
  name: string;
  region?: string | null;
}


export const exclusionApi = {
  // グループの除外ペア一覧
  getByGroup: async (tournamentId: number, groupId: string): Promise<ExclusionPair[]> => {
    const { data, error } = await supabase
      .from('exclusion_pairs')
      .select(`
        *,
        team1:teams!exclusion_pairs_team1_id_fkey(*),
        team2:teams!exclusion_pairs_team2_id_fkey(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId);

    if (error) throw error;
    return (data || []) as ExclusionPair[];
  },

  // 後方互換: グループ別除外設定一覧取得
  getExclusionsByGroup: async (tournamentId: number): Promise<GroupExclusions[]> => {
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('id');

    if (!groups) return [];

    const result: GroupExclusions[] = [];
    for (const group of (groups as unknown as GroupRow[])) {
      const exclusions = await exclusionApi.getByGroup(tournamentId, group.id);

      // Calculate team exclusion counts
      const teamExclusionCount: Record<number, number> = {};
      for (const e of exclusions) {
        const t1 = e.team1_id ?? e.team1Id ?? 0;
        const t2 = e.team2_id ?? e.team2Id ?? 0;
        teamExclusionCount[t1] = (teamExclusionCount[t1] || 0) + 1;
        teamExclusionCount[t2] = (teamExclusionCount[t2] || 0) + 1;
      }

      // Map exclusions to proper structure
      const mappedExclusions = exclusions.map(e => ({
        id: e.id,
        tournamentId: e.tournament_id ?? tournamentId,
        groupId: e.group_id ?? group.id,
        team1Id: e.team1_id ?? e.team1Id ?? 0,
        team2Id: e.team2_id ?? e.team2Id ?? 0,
        reason: e.reason ?? undefined,
        createdAt: e.created_at ?? new Date().toISOString(),
      }));

      result.push({
        groupId: group.id,
        exclusions: mappedExclusions,
        teamExclusionCount,
        isComplete: exclusions.length > 0,
      });
    }
    return result;
  },

  // 除外ペア作成
  create: async (data: CreateExclusionInput): Promise<ExclusionPair> => {
    const insertData = {
      tournament_id: data.tournamentId,
      group_id: data.groupId,
      team1_id: data.team1Id,
      team2_id: data.team2Id,
      reason: data.reason,
    };
    const { data: exclusion, error } = await supabase
      .from('exclusion_pairs')
      .insert(insertData as never)
      .select()
      .single();

    if (error) throw error;
    return exclusion as ExclusionPair;
  },

  // 後方互換: 除外設定追加
  createExclusion: async (data: ExclusionPairCreate): Promise<ExclusionPair> => {
    return exclusionApi.create({
      tournamentId: data.tournamentId,
      groupId: data.groupId,
      team1Id: data.team1Id,
      team2Id: data.team2Id,
      reason: data.reason,
    });
  },

  // 除外ペア削除
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('exclusion_pairs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // 後方互換: 除外設定削除
  deleteExclusion: async (id: number): Promise<void> => {
    return exclusionApi.delete(id);
  },

  // 一括登録
  bulkCreate: async (data: BulkExclusionInput): Promise<{ created: number }> => {
    let created = 0;
    for (const pair of data.pairs) {
      const insertData = {
        tournament_id: data.tournamentId,
        group_id: data.groupId,
        team1_id: pair.team1Id,
        team2_id: pair.team2Id,
        reason: pair.reason,
      };
      const { error } = await supabase
        .from('exclusion_pairs')
        .insert(insertData as never);

      if (!error) created++;
    }
    return { created };
  },

  // 自動提案取得（同一地域チームを提案）
  getSuggestions: async (tournamentId: number, groupId: string): Promise<ExclusionSuggestion[]> => {
    // 同じグループ内で同じ地域のチームペアを提案
    const { data: teamsData, error } = await supabase
      .from('teams')
      .select('id, name, region')
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .not('region', 'is', null);

    if (error || !teamsData) return [];
    const teams = teamsData as unknown as TeamRow[];

    // 既存の除外ペアを取得
    const existingPairs = await exclusionApi.getByGroup(tournamentId, groupId);
    const existingSet = new Set(
      existingPairs.map(p => [(p.team1_id ?? 0), (p.team2_id ?? 0)].sort((a, b) => a - b).join('-'))
    );

    const suggestions: ExclusionSuggestion[] = [];

    // 同じ地域のチームをグループ化
    const regionMap = new Map<string, TeamRow[]>();
    for (const team of teams) {
      if (team.region) {
        const existing = regionMap.get(team.region) || [];
        existing.push(team);
        regionMap.set(team.region, existing);
      }
    }

    // 同じ地域のチーム間でペアを作成
    for (const [region, regionTeams] of regionMap) {
      if (regionTeams.length < 2) continue;

      for (let i = 0; i < regionTeams.length; i++) {
        for (let j = i + 1; j < regionTeams.length; j++) {
          const pairKey = [regionTeams[i].id, regionTeams[j].id].sort((a, b) => a - b).join('-');
          if (!existingSet.has(pairKey)) {
            suggestions.push({
              team1Id: regionTeams[i].id,
              team1Name: regionTeams[i].name,
              team2Id: regionTeams[j].id,
              team2Name: regionTeams[j].name,
              reason: `同一地域: ${region}`,
              confidence: 0.9,
            });
          }
        }
      }
    }

    return suggestions;
  },

  // グループの除外ペアをクリア
  clearGroup: async (tournamentId: number, groupId: string): Promise<void> => {
    const { error } = await supabase
      .from('exclusion_pairs')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId);
    if (error) throw error;
  },
};
