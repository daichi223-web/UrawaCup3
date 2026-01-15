// src/features/venue-assignments/api.ts
// 会場割り当てAPI呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type {
  VenueAssignment,
  CreateVenueAssignmentInput,
  UpdateVenueAssignmentInput,
  AutoGenerateVenueAssignmentsInput,
  AutoGenerateResult,
} from './types';

// snake_case to camelCase 変換ヘルパー
const transformAssignment = (data: Record<string, unknown>): VenueAssignment => ({
  id: data.id as number,
  tournamentId: (data.tournament_id ?? data.tournamentId) as number,
  venueId: (data.venue_id ?? data.venueId) as number,
  teamId: (data.team_id ?? data.teamId) as number,
  matchDay: (data.match_day ?? data.matchDay) as number,
  slotOrder: (data.slot_order ?? data.slotOrder) as number,
  createdAt: (data.created_at ?? data.createdAt) as string,
  updatedAt: (data.updated_at ?? data.updatedAt) as string,
  venue: data.venue as VenueAssignment['venue'],
  team: data.team as VenueAssignment['team'],
});

export const venueAssignmentApi = {
  /**
   * 会場割り当て一覧取得
   * @param tournamentId 大会ID
   * @param matchDay 試合日（オプション）
   */
  getByTournament: async (
    tournamentId: number,
    matchDay?: number
  ): Promise<VenueAssignment[]> => {
    let query = supabase
      .from('venue_assignments')
      .select(`
        *,
        venue:venues(id, name, short_name),
        team:teams(id, name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('match_day')
      .order('venue_id')
      .order('slot_order');

    if (matchDay !== undefined) {
      query = query.eq('match_day', matchDay);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(transformAssignment);
  },

  /**
   * 会場割り当て取得（ID指定）
   * @param id 会場割り当てID
   */
  getById: async (id: number): Promise<VenueAssignment> => {
    const { data, error } = await supabase
      .from('venue_assignments')
      .select(`
        *,
        venue:venues(id, name, short_name),
        team:teams(id, name, short_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return transformAssignment(data);
  },

  /**
   * 会場割り当て作成
   * @param input 作成データ
   */
  create: async (input: CreateVenueAssignmentInput): Promise<VenueAssignment> => {
    const { data, error } = await supabase
      .from('venue_assignments')
      .insert({
        tournament_id: input.tournamentId,
        venue_id: input.venueId,
        team_id: input.teamId,
        match_day: input.matchDay,
        slot_order: input.slotOrder,
      })
      .select(`
        *,
        venue:venues(id, name, short_name),
        team:teams(id, name, short_name)
      `)
      .single();

    if (error) throw error;
    return transformAssignment(data);
  },

  /**
   * 会場割り当て更新
   * @param input 更新データ
   */
  update: async (input: UpdateVenueAssignmentInput): Promise<VenueAssignment> => {
    const { id, ...rest } = input;
    const updateData: Record<string, unknown> = {};

    if (rest.venueId !== undefined) updateData.venue_id = rest.venueId;
    if (rest.teamId !== undefined) updateData.team_id = rest.teamId;
    if (rest.matchDay !== undefined) updateData.match_day = rest.matchDay;
    if (rest.slotOrder !== undefined) updateData.slot_order = rest.slotOrder;

    const { data, error } = await supabase
      .from('venue_assignments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        venue:venues(id, name, short_name),
        team:teams(id, name, short_name)
      `)
      .single();

    if (error) throw error;
    return transformAssignment(data);
  },

  /**
   * 会場割り当て削除
   * @param id 会場割り当てID
   */
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('venue_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * 会場割り当て一括削除（試合日指定）
   * @param tournamentId 大会ID
   * @param matchDay 試合日
   */
  deleteByMatchDay: async (tournamentId: number, matchDay: number): Promise<void> => {
    const { error } = await supabase
      .from('venue_assignments')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('match_day', matchDay);

    if (error) throw error;
  },

  /**
   * 会場割り当て自動生成
   * チームと会場を基にバランスよく割り当てを生成
   * @param input 自動生成パラメータ
   */
  autoGenerate: async (
    input: AutoGenerateVenueAssignmentsInput
  ): Promise<AutoGenerateResult> => {
    const { tournamentId, matchDay, strategy = 'balanced' } = input;

    // 既存の割り当てを取得
    const { data: existingAssignments } = await supabase
      .from('venue_assignments')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('match_day', matchDay);

    // 会場一覧を取得
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .eq('for_preliminary', true);

    if (venueError) throw venueError;

    // チーム一覧を取得
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('id');

    if (teamError) throw teamError;

    // 既存割り当てを削除
    if (existingAssignments && existingAssignments.length > 0) {
      await supabase
        .from('venue_assignments')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('match_day', matchDay);
    }

    // 割り当て生成
    const assignments: Array<{
      tournament_id: number;
      venue_id: number;
      team_id: number;
      match_day: number;
      slot_order: number;
    }> = [];

    if (!venues || !teams || venues.length === 0 || teams.length === 0) {
      return {
        created: 0,
        updated: 0,
        assignments: [],
      };
    }

    // 1会場あたりのチーム数を計算
    const teamsPerVenue = Math.ceil(teams.length / venues.length);

    if (strategy === 'random') {
      // ランダム割り当て: シャッフルしてから順番に配置
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      let teamIndex = 0;

      venues.forEach((venue) => {
        for (let slot = 1; slot <= teamsPerVenue && teamIndex < shuffledTeams.length; slot++) {
          assignments.push({
            tournament_id: tournamentId,
            venue_id: venue.id,
            team_id: shuffledTeams[teamIndex].id,
            match_day: matchDay,
            slot_order: slot,
          });
          teamIndex++;
        }
      });
    } else {
      // balanced/group_based: 順番にチームを割り当て
      let teamIndex = 0;

      venues.forEach((venue) => {
        for (let slot = 1; slot <= teamsPerVenue && teamIndex < teams.length; slot++) {
          assignments.push({
            tournament_id: tournamentId,
            venue_id: venue.id,
            team_id: teams[teamIndex].id,
            match_day: matchDay,
            slot_order: slot,
          });
          teamIndex++;
        }
      });
    }

    // 一括挿入
    if (assignments.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('venue_assignments')
        .insert(assignments)
        .select(`
          *,
          venue:venues(id, name, short_name),
          team:teams(id, name, short_name)
        `);

      if (insertError) throw insertError;

      return {
        created: insertedData?.length || 0,
        updated: 0,
        assignments: (insertedData || []).map(transformAssignment),
      };
    }

    return {
      created: 0,
      updated: 0,
      assignments: [],
    };
  },
};
