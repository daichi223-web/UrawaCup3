// src/features/staff/api.ts
// スタッフAPI呼び出し - Supabase版
import { supabase } from '@/lib/supabase';
import type { Staff, CreateStaffInput, UpdateStaffInput } from './types';

interface StaffListResponse {
  staff: Staff[];
  total: number;
}

export const staffApi = {
  // チームのスタッフ一覧
  getByTeam: async (teamId: number): Promise<Staff[]> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('team_id', teamId)
      .order('role')
      .order('name');
    if (error) throw error;
    return (data || []) as Staff[];
  },

  // スタッフ一覧（フィルタ付き）
  getList: async (params?: {
    teamId?: number;
    tournamentId?: number;
    role?: string;
  }): Promise<Staff[]> => {
    let query = supabase.from('staff').select('*');

    if (params?.teamId) {
      query = query.eq('team_id', params.teamId);
    }
    if (params?.role) {
      query = query.eq('role', params.role);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    return (data || []) as Staff[];
  },

  // 単一スタッフ取得
  getById: async (id: number): Promise<Staff> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Staff;
  },

  // スタッフ作成
  create: async (data: CreateStaffInput): Promise<Staff> => {
    const { data: staff, error } = await supabase
      .from('staff')
      .insert({
        team_id: data.teamId,
        name: data.name,
        role: data.role,
        phone: data.phone,
        email: data.email,
      })
      .select()
      .single();
    if (error) throw error;
    return staff as Staff;
  },

  // スタッフ更新
  update: async (id: number, data: UpdateStaffInput): Promise<Staff> => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;

    const { data: staff, error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return staff as Staff;
  },

  // スタッフ削除
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
