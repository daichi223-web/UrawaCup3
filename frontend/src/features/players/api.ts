// src/features/players/api.ts
// 選手API呼び出し - Supabase版
import { playersApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';
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
      number: data.number ?? null,
      name: data.name,
      position: data.position ?? null,
      name_kana: null,
      grade: null,
      is_captain: false,
      notes: null,
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
      .update(updateData as never)
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
  // 名前または背番号で検索可能
  suggest: async (teamId: number, query: string): Promise<PlayerSuggestion[]> => {
    // 検索クエリを正規化
    const normalizedQuery = normalizeForSearch(query);

    // 数字のみの場合は背番号で検索
    const isNumberQuery = /^\d+$/.test(normalizedQuery);

    let data;
    let error;

    if (isNumberQuery) {
      // 背番号検索（入力値以上の番号を表示）
      const numberValue = parseInt(normalizedQuery, 10);
      const result = await supabase
        .from('players')
        .select('id, number, name')
        .eq('team_id', teamId)
        .gte('number', numberValue)
        .order('number')
        .limit(10);
      data = result.data;
      error = result.error;
    } else {
      // 名前検索
      const result = await supabase
        .from('players')
        .select('id, number, name')
        .eq('team_id', teamId)
        .ilike('name', `%${normalizedQuery}%`)
        .order('number')
        .limit(10);
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    interface PlayerQueryResult {
      id: number;
      number: number;
      name: string;
    }
    const players = (data || []) as PlayerQueryResult[];
    return players.map(p => ({
      id: p.id,
      teamId: teamId,
      number: p.number,
      name: p.name,
      nameKana: '',
      position: null,
      grade: null,
      displayText: `${p.number} ${p.name}`,
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
          } as never)
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

    const typedPlayers = (players || []) as Array<{ number: number; name: string; position: string | null }>;
    const csvRows = ['番号,氏名,ポジション'];
    for (const player of typedPlayers) {
      csvRows.push(`${player.number},${player.name},${player.position || ''}`);
    }

    return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  },

  // Excelインポートプレビュー
  previewExcelImport: async (_teamId: number, file: File): Promise<ImportPreviewResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const players: Array<{
      rowNumber: number;
      number: number | null;
      name: string;
      nameKana: string | null;
      grade: number | null;
      position: string | null;
      height: number | null;
      previousTeam: string | null;
      status: 'new' | 'update' | 'error' | 'warning';
      errors: string[];
    }> = [];
    const staff: Array<{ role: string; name: string; phone: string | null; email: string | null }> = [];
    const errors: Array<{ row: number; field: string; type: 'error' | 'warning'; message: string }> = [];

    // 選手シートを探す（"選手", "players", 最初のシート）
    const sheetNames = workbook.worksheets.map(ws => ws.name);
    const playerSheetName = sheetNames.find(
      name => name.toLowerCase().includes('選手') || name.toLowerCase().includes('player')
    ) || sheetNames[0];

    if (playerSheetName) {
      const sheet = workbook.getWorksheet(playerSheetName);
      if (sheet) {
        // ヘッダー行を取得
        const headerRow = sheet.getRow(1);
        const headers: Record<number, string> = {};
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').toLowerCase();
        });

        // データ行を処理
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // ヘッダー行をスキップ

          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const headerName = headers[colNumber];
            if (headerName) {
              rowData[headerName] = cell.value;
            }
          });

          // カラム名の候補を探す
          const number = rowData['番号'] || rowData['背番号'] || rowData['no'] || rowData['number'] || 0;
          const name = rowData['氏名'] || rowData['名前'] || rowData['選手名'] || rowData['name'] || '';
          const position = rowData['ポジション'] || rowData['position'] || rowData['pos'] || '';

          if (name) {
            players.push({
              rowNumber,
              number: typeof number === 'number' ? number : parseInt(String(number)) || null,
              name: String(name),
              nameKana: null,
              grade: null,
              position: position ? String(position) : null,
              height: null,
              previousTeam: null,
              status: 'new',
              errors: [],
            });
          } else {
            errors.push({ row: rowNumber, field: 'name', type: 'warning', message: '名前が空のためスキップ' });
          }
        });
      }
    }

    // スタッフシートを探す
    const staffSheetName = sheetNames.find(
      name => name.toLowerCase().includes('スタッフ') || name.toLowerCase().includes('staff')
    );

    if (staffSheetName) {
      const sheet = workbook.getWorksheet(staffSheetName);
      if (sheet) {
        const headerRow = sheet.getRow(1);
        const headers: Record<number, string> = {};
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').toLowerCase();
        });

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;

          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const headerName = headers[colNumber];
            if (headerName) {
              rowData[headerName] = cell.value;
            }
          });

          const role = rowData['役職'] || rowData['role'] || '';
          const name = rowData['氏名'] || rowData['名前'] || rowData['name'] || '';

          if (name && role) {
            staff.push({
              role: String(role),
              name: String(name),
              phone: null,
              email: null,
            });
          }
        });
      }
    }

    return {
      format: 'excel',
      teamInfo: null,
      players,
      staff,
      uniforms: [],
      errors,
    };
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
    const importErrors: Array<{ row: number; field: string; type: 'error' | 'warning'; message: string }> = [...preview.errors];

    if (options.replaceExisting) {
      // 既存選手を削除
      await supabase.from('players').delete().eq('team_id', teamId);
    }

    let imported = 0;
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
        } as never);

      if (!error) {
        imported++;
      } else {
        importErrors.push({ row: player.rowNumber, field: 'name', type: 'error', message: `選手 ${player.name} のインポートに失敗: ${error.message}` });
      }
    }

    if (options.importStaff && preview.staff.length > 0) {
      for (const s of preview.staff) {
        const { error } = await supabase
          .from('staff')
          .insert({
            team_id: teamId,
            role: s.role,
            name: s.name,
          } as never);

        if (error) {
          importErrors.push({ row: 0, field: 'staff', type: 'error', message: `スタッフ ${s.name} のインポートに失敗: ${error.message}` });
        }
      }
    }

    return { imported, updated: 0, skipped: 0, errors: importErrors };
  },

  // Excelエクスポート
  exportExcel: async (teamId: number, _teamName: string): Promise<Blob> => {
    const { data: playersData, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('number');

    if (error) throw error;

    const players = (playersData || []) as Array<{ number: number; name: string; position: string | null }>;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('選手');

    // ヘッダー行
    worksheet.addRow(['番号', '氏名', 'ポジション']);

    // データ行
    for (const p of players) {
      worksheet.addRow([p.number, p.name, p.position || '']);
    }

    // カラム幅を設定
    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },
};
