// src/features/venues/api.ts
// 会場管理API呼び出し - Supabase版
import { venuesApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  Venue,
  CreateVenueInput,
  UpdateVenueInput,
  VenueStaff,
  AssignVenueStaffInput,
  VenueSchedule,
} from './types';

export const venueApi = {
  // 会場一覧取得
  getByTournament: async (tournamentId: number): Promise<Venue[]> => {
    const data = await venuesApi.getAll(tournamentId);
    return data as Venue[];
  },

  // 会場詳細取得
  getById: async (id: number): Promise<Venue> => {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Venue;
  },

  // 会場作成
  create: async (data: CreateVenueInput): Promise<Venue> => {
    const venue = await venuesApi.create({
      tournament_id: data.tournamentId,
      name: data.name,
      address: data.address,
      map_url: data.mapUrl,
    });
    return venue as Venue;
  },

  // 会場更新
  update: async (data: UpdateVenueInput): Promise<Venue> => {
    const { id, ...rest } = data;
    const updateData: Record<string, unknown> = {};
    if (rest.name !== undefined) updateData.name = rest.name;
    if (rest.address !== undefined) updateData.address = rest.address;
    if (rest.mapUrl !== undefined) updateData.map_url = rest.mapUrl;

    const { data: venue, error } = await supabase
      .from('venues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return venue as Venue;
  },

  // 会場削除
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('venues')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // 会場スタッフ一覧
  getStaff: async (venueId: number): Promise<VenueStaff[]> => {
    const { data, error } = await supabase
      .from('venue_staff')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('venue_id', venueId);
    if (error) throw error;
    return (data || []) as VenueStaff[];
  },

  // スタッフ割り当て
  assignStaff: async (data: AssignVenueStaffInput): Promise<VenueStaff> => {
    const { data: staff, error } = await supabase
      .from('venue_staff')
      .insert({
        venue_id: data.venueId,
        user_id: data.userId,
        role: data.role || 'manager',
      })
      .select()
      .single();
    if (error) throw error;
    return staff as VenueStaff;
  },

  // スタッフ削除
  removeStaff: async (venueId: number, userId: number): Promise<void> => {
    const { error } = await supabase
      .from('venue_staff')
      .delete()
      .eq('venue_id', venueId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // 会場スケジュール取得
  getSchedule: async (venueId: number, date: string): Promise<VenueSchedule> => {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .eq('venue_id', venueId)
      .eq('match_date', date)
      .order('match_time');

    if (error) throw error;

    return {
      venueId,
      date,
      matches: matches || [],
    } as VenueSchedule;
  },

  // グループに会場を紐付け
  assignToGroup: async (venueId: number, groupId: string): Promise<Venue> => {
    const { data, error } = await supabase
      .from('venues')
      .update({ group_id: groupId })
      .eq('id', venueId)
      .select()
      .single();
    if (error) throw error;
    return data as Venue;
  },
};
