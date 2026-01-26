// src/features/tournaments/api.ts
// 大会管理API呼び出し - Supabase版
import { tournamentsApi, groupsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  Tournament,
  CreateTournamentInput,
  UpdateTournamentInput,
  TournamentGroup,
  TournamentSettings,
  GenerateScheduleInput,
  GenerateFinalScheduleInput,
} from './types';

export const tournamentApi = {
  // 大会一覧取得
  getAll: async (): Promise<Tournament[]> => {
    const data = await tournamentsApi.getAll();
    return data as unknown as Tournament[];
  },

  // 大会詳細取得
  getById: async (id: number): Promise<Tournament> => {
    const data = await tournamentsApi.getById(id);
    return data as unknown as Tournament;
  },

  // 大会作成
  create: async (data: CreateTournamentInput): Promise<Tournament> => {
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: data.name,
        short_name: data.shortName,
        year: data.year,
        start_date: data.startDate,
        end_date: data.endDate,
        status: 'draft',
      } as never)
      .select()
      .single();
    if (error) throw error;
    return tournament as Tournament;
  },

  // 大会更新
  update: async (data: UpdateTournamentInput): Promise<Tournament> => {
    const { id, ...rest } = data;
    const updateData: Record<string, unknown> = {};
    if (rest.name !== undefined) updateData.name = rest.name;
    if (rest.startDate !== undefined) updateData.start_date = rest.startDate;
    if (rest.endDate !== undefined) updateData.end_date = rest.endDate;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.matchDuration !== undefined) updateData.match_duration = rest.matchDuration;
    if (rest.intervalMinutes !== undefined) updateData.interval_minutes = rest.intervalMinutes;
    if (rest.description !== undefined) updateData.description = rest.description;

    const tournament = await tournamentsApi.update(id, updateData);
    return tournament as Tournament;
  },

  // 大会削除
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // グループ一覧取得
  getGroups: async (tournamentId: number): Promise<TournamentGroup[]> => {
    const data = await groupsApi.getAll(tournamentId);
    interface GroupData {
      id: string;
      name: string;
      tournament_id: number;
      venue_id?: number | null;
      team_count?: number;
    }
    const groups = data as GroupData[];
    return groups.map(g => ({
      id: g.id,
      name: g.name,
      tournamentId: g.tournament_id,
      venueId: g.venue_id ?? null,
      teamCount: g.team_count ?? 0,
    }));
  },

  // 設定取得
  getSettings: async (tournamentId: number): Promise<TournamentSettings> => {
    const { data, error } = await supabase
      .from('tournament_settings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .single();

    if (error) {
      // デフォルト設定を返す
      return {
        tournamentId,
        matchDuration: 20,
        intervalMinutes: 5,
        halfTimeMinutes: 10,
        preliminaryRounds: 2,
        tiebreaker: ['points', 'goal_difference', 'goals_scored'],
      };
    }
    return data as TournamentSettings;
  },

  // 設定更新
  updateSettings: async (
    tournamentId: number,
    settings: Partial<TournamentSettings>
  ): Promise<TournamentSettings> => {
    const { data, error } = await supabase
      .from('tournament_settings')
      .upsert({
        tournament_id: tournamentId,
        ...settings,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data as TournamentSettings;
  },

  // 予選日程生成（Supabase Edge Functionが必要）
  generateSchedule: async (_data: GenerateScheduleInput): Promise<{ matchCount: number }> => {
    console.warn('generateSchedule: Supabase Edge Function not implemented yet');
    return { matchCount: 0 };
  },

  // 決勝日程生成（Supabase Edge Functionが必要）
  generateFinalSchedule: async (_data: GenerateFinalScheduleInput): Promise<{ matchCount: number }> => {
    console.warn('generateFinalSchedule: Supabase Edge Function not implemented yet');
    return { matchCount: 0 };
  },

  // 大会ステータス変更
  changeStatus: async (id: number, status: Tournament['status']): Promise<Tournament> => {
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Tournament;
  },
};
