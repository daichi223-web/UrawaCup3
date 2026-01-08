// src/features/teams/api.ts
// チームAPI呼び出し - Supabase版
import { teamsApi, playersApi, standingsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Team, CreateTeamInput, UpdateTeamInput, TeamWithPlayers } from './types';

interface TeamListResponse {
  teams: Team[];
  total: number;
}

export const teamApi = {
  // 全チーム取得
  getAll: async (tournamentId?: number): Promise<Team[]> => {
    const result = await teamsApi.getAll(tournamentId || 1);
    return result.teams as Team[];
  },

  // グループ別チーム取得
  getByGroup: async (tournamentId: number, groupId: string): Promise<Team[]> => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .order('group_order');
    if (error) throw error;
    return data as Team[];
  },

  // 単一チーム取得
  getById: async (id: number): Promise<TeamWithPlayers> => {
    const team = await teamsApi.getById(id);
    const players = await playersApi.getByTeam(id);
    return { ...team, players } as TeamWithPlayers;
  },

  // チーム作成
  create: async (data: CreateTeamInput): Promise<Team> => {
    const team = await teamsApi.create({
      tournament_id: data.tournamentId,
      group_id: data.groupId,
      name: data.name,
      short_name: data.shortName || data.name.slice(0, 4),
      region: data.region,
      group_order: data.groupOrder,
    });
    return team as Team;
  },

  // チーム更新
  update: async (id: number, data: UpdateTeamInput): Promise<Team> => {
    // グループ変更がある場合は旧グループ情報を取得
    let oldTeam: { tournament_id: number; group_id: string | null } | null = null;
    if (data.groupId !== undefined) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('tournament_id, group_id')
        .eq('id', id)
        .single();
      oldTeam = teamData;
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.shortName !== undefined) updateData.short_name = data.shortName;
    if (data.groupId !== undefined) updateData.group_id = data.groupId;
    if (data.groupOrder !== undefined) updateData.group_order = data.groupOrder;
    if (data.region !== undefined) updateData.region = data.region;

    const team = await teamsApi.update(id, updateData);

    // グループ変更があった場合は両グループの順位表を再計算
    if (oldTeam && data.groupId !== undefined && oldTeam.group_id !== data.groupId) {
      try {
        // 旧グループの順位表を再計算
        if (oldTeam.group_id) {
          console.log('[Standings] Recalculating old group:', oldTeam.group_id);
          await standingsApi.recalculate(oldTeam.tournament_id, oldTeam.group_id);
        }
        // 新グループの順位表を再計算
        if (data.groupId) {
          console.log('[Standings] Recalculating new group:', data.groupId);
          await standingsApi.recalculate(oldTeam.tournament_id, data.groupId);
        }
      } catch (err) {
        console.error('[Standings] Failed to recalculate after group change:', err);
      }
    }

    return team as Team;
  },

  // チーム削除
  delete: async (id: number): Promise<void> => {
    // 削除前に関連する試合があるかチェック
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`);

    if (matchError) throw matchError;

    if (matches && matches.length > 0) {
      throw new Error(
        `このチームは ${matches.length} 件の試合に関連しています。` +
        '先に関連する試合を削除してください。'
      );
    }

    // チーム削除前に順位表から削除（CASCADE で自動削除されるが念のため）
    const { data: team } = await supabase
      .from('teams')
      .select('tournament_id, group_id')
      .eq('id', id)
      .single();

    await teamsApi.delete(id);

    // 順位表を再計算
    if (team?.group_id) {
      try {
        await standingsApi.recalculate(team.tournament_id, team.group_id);
      } catch (err) {
        console.error('[Standings] Failed to recalculate after team deletion:', err);
      }
    }
  },

  // CSVインポート（Supabaseでは直接実装）
  importCsv: async (tournamentId: number, file: File): Promise<{ imported: number }> => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    const header = lines[0].toLowerCase();

    // ヘッダー行をスキップ
    const dataLines = header.includes('name') || header.includes('チーム') ? lines.slice(1) : lines;

    let imported = 0;
    for (const line of dataLines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const [groupId, name, shortName, region] = parts;

        const { error } = await supabase.from('teams').insert({
          tournament_id: tournamentId,
          group_id: groupId,
          name: name,
          short_name: shortName || name.slice(0, 4),
          region: region || null,
        });

        if (!error) imported++;
      }
    }

    return { imported };
  },

  // Excelインポート（選手用 - Supabaseでは直接実装）
  importExcel: async (teamId: number, file: File): Promise<{ imported: number }> => {
    // Excel処理にはxlsxライブラリが必要
    console.warn('Excel import requires xlsx library');
    return { imported: 0 };
  },

  // CSVエクスポート
  exportCsv: async (tournamentId: number): Promise<Blob> => {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('group_id')
      .order('group_order');

    if (error) throw error;

    const csvRows = ['グループ,チーム名,略称,地域'];
    for (const team of teams) {
      csvRows.push(`${team.group_id},${team.name},${team.short_name || ''},${team.region || ''}`);
    }

    return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  },
};
