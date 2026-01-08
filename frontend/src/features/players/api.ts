// src/features/players/api.ts
// 選手API呼び出し - Supabase版
import { playersApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import {
  normalizePlayerName,
  normalizeJerseyNumber,
  normalizeForSearch,
} from '@/utils/normalize';
import type {
  Player,
  CreatePlayerInput,
  UpdatePlayerInput,
  PlayerSuggestion,
  ImportPreviewResult,
  ImportResult,
} from './types';

interface PlayerListResponse {
  players: Player[];
  total: number;
}

export const playerApi = {
  // チームの選手一覧
  getByTeam: async (teamId: number): Promise<Player[]> => {
    const data = await playersApi.getByTeam(teamId);
    return data as Player[];
  },

  // 単一選手取得
  getById: async (id: number): Promise<Player> => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Player;
  },

  // 選手作成
  create: async (data: CreatePlayerInput): Promise<Player> => {
    const player = await playersApi.create({
      team_id: data.teamId,
      number: data.number,
      name: data.name,
      position: data.position,
    });
    return player as Player;
  },

  // 選手更新
  update: async (id: number, data: UpdatePlayerInput): Promise<Player> => {
    const updateData: Record<string, unknown> = {};
    if (data.number !== undefined) updateData.number = data.number;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.position !== undefined) updateData.position = data.position;

    const { data: player, error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return player as Player;
  },

  // 選手削除
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // 選手サジェスト（得点者入力用）
  suggest: async (teamId: number, query: string): Promise<PlayerSuggestion[]> => {
    // 検索クエリを正規化
    const normalizedQuery = normalizeForSearch(query);
    const { data, error } = await supabase
      .from('players')
      .select('id, number, name')
      .eq('team_id', teamId)
      .ilike('name', `%${normalizedQuery}%`)
      .limit(10);

    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      number: p.number,
      name: p.name,
    }));
  },

  // CSVインポート
  importCsv: async (
    teamId: number,
    file: File,
    replaceExisting: boolean = false
  ): Promise<PlayerListResponse> => {
    if (replaceExisting) {
      // 既存選手を削除
      await supabase.from('players').delete().eq('team_id', teamId);
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    const header = lines[0].toLowerCase();
    const dataLines = header.includes('name') || header.includes('番号') ? lines.slice(1) : lines;

    const players: Player[] = [];
    for (const line of dataLines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const [numberStr, name, position] = parts;
        // 全角半角正規化
        const normalizedNumber = parseInt(normalizeJerseyNumber(numberStr), 10);
        const normalizedName = normalizePlayerName(name);
        const normalizedPosition = position ? normalizePlayerName(position) : null;

        const { data, error } = await supabase
          .from('players')
          .insert({
            team_id: teamId,
            number: isNaN(normalizedNumber) ? 0 : normalizedNumber,
            name: normalizedName,
            position: normalizedPosition,
          })
          .select()
          .single();

        if (!error && data) {
          players.push(data as Player);
        }
      }
    }

    return { players, total: players.length };
  },

  // CSVエクスポート
  exportCsv: async (teamId: number): Promise<Blob> => {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('number');

    if (error) throw error;

    const csvRows = ['番号,氏名,ポジション'];
    for (const player of players || []) {
      csvRows.push(`${player.number},${player.name},${player.position || ''}`);
    }

    return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  },

  // Excelインポートプレビュー
  previewExcelImport: async (teamId: number, file: File): Promise<ImportPreviewResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const players: Array<{ number: number; name: string; position?: string }> = [];
    const staff: Array<{ role: string; name: string }> = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // 選手シートを探す（"選手", "players", 最初のシート）
    const playerSheetName = workbook.SheetNames.find(
      name => name.toLowerCase().includes('選手') || name.toLowerCase().includes('player')
    ) || workbook.SheetNames[0];

    if (playerSheetName) {
      const sheet = workbook.Sheets[playerSheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // カラム名の候補を探す
        const number = row['番号'] || row['背番号'] || row['No'] || row['number'] || 0;
        const name = row['氏名'] || row['名前'] || row['選手名'] || row['name'] || '';
        const position = row['ポジション'] || row['position'] || row['POS'] || '';

        if (name) {
          players.push({
            number: typeof number === 'number' ? number : parseInt(String(number)) || 0,
            name: String(name),
            position: position ? String(position) : undefined,
          });
        } else {
          warnings.push(`行 ${i + 2}: 名前が空のためスキップ`);
        }
      }
    }

    // スタッフシートを探す
    const staffSheetName = workbook.SheetNames.find(
      name => name.toLowerCase().includes('スタッフ') || name.toLowerCase().includes('staff')
    );

    if (staffSheetName) {
      const sheet = workbook.Sheets[staffSheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      for (const row of data) {
        const role = row['役職'] || row['role'] || '';
        const name = row['氏名'] || row['名前'] || row['name'] || '';

        if (name && role) {
          staff.push({
            role: String(role),
            name: String(name),
          });
        }
      }
    }

    return { players, staff, warnings, errors };
  },

  // Excelインポート実行
  importExcel: async (
    teamId: number,
    file: File,
    options: {
      replaceExisting?: boolean;
      importStaff?: boolean;
      importUniforms?: boolean;
      skipWarnings?: boolean;
    } = {}
  ): Promise<ImportResult> => {
    const preview = await playerApi.previewExcelImport(teamId, file);
    const warnings: string[] = [...preview.warnings];

    if (options.replaceExisting) {
      // 既存選手を削除
      await supabase.from('players').delete().eq('team_id', teamId);
    }

    let playersImported = 0;
    for (const player of preview.players) {
      // 全角半角正規化
      const normalizedName = normalizePlayerName(player.name);
      const normalizedPosition = player.position ? normalizePlayerName(player.position) : null;

      const { error } = await supabase
        .from('players')
        .insert({
          team_id: teamId,
          number: player.number,
          name: normalizedName,
          position: normalizedPosition,
        });

      if (!error) {
        playersImported++;
      } else {
        warnings.push(`選手 ${player.name} のインポートに失敗: ${error.message}`);
      }
    }

    let staffImported = 0;
    if (options.importStaff && preview.staff.length > 0) {
      for (const s of preview.staff) {
        const { error } = await supabase
          .from('staff')
          .insert({
            team_id: teamId,
            role: s.role,
            name: s.name,
          });

        if (!error) {
          staffImported++;
        }
      }
    }

    return { playersImported, staffImported, warnings };
  },

  // Excelエクスポート
  exportExcel: async (teamId: number, teamName: string): Promise<Blob> => {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('number');

    if (error) throw error;

    const wsData = [
      ['番号', '氏名', 'ポジション'],
      ...(players || []).map(p => [p.number, p.name, p.position || ''])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '選手');

    // カラム幅を設定
    ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 12 }];

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },
};
