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
    for (const group of groups) {
      const exclusions = await exclusionApi.getByGroup(tournamentId, group.id);
      result.push({
        groupId: group.id,
        groupName: group.name,
        exclusions: exclusions.map(e => ({
          id: e.id,
          team1Id: e.team1_id,
          team1Name: (e as any).team1?.name || '',
          team2Id: e.team2_id,
          team2Name: (e as any).team2?.name || '',
          reason: e.reason,
        })),
      });
    }
    return result;
  },

  // 除外ペア作成
  create: async (data: CreateExclusionInput): Promise<ExclusionPair> => {
    const { data: exclusion, error } = await supabase
      .from('exclusion_pairs')
      .insert({
        tournament_id: data.tournamentId,
        group_id: data.groupId,
        team1_id: data.team1Id,
        team2_id: data.team2Id,
        reason: data.reason,
      })
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
      const { error } = await supabase
        .from('exclusion_pairs')
        .insert({
          tournament_id: data.tournamentId,
          group_id: data.groupId,
          team1_id: pair.team1Id,
          team2_id: pair.team2Id,
          reason: pair.reason,
        });

      if (!error) created++;
    }
    return { created };
  },

  // 自動提案取得（同一地域チームを提案）
  getSuggestions: async (tournamentId: number, groupId: string): Promise<ExclusionSuggestion[]> => {
    // 同じグループ内で同じ地域のチームペアを提案
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, region')
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .not('region', 'is', null);

    if (error || !teams) return [];

    // 既存の除外ペアを取得
    const existingPairs = await exclusionApi.getByGroup(tournamentId, groupId);
    const existingSet = new Set(
      existingPairs.map(p => [p.team1_id, p.team2_id].sort().join('-'))
    );

    const suggestions: ExclusionSuggestion[] = [];

    // 同じ地域のチームをグループ化
    const regionMap = new Map<string, typeof teams>();
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
          const pairKey = [regionTeams[i].id, regionTeams[j].id].sort().join('-');
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
