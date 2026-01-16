// Supabase Database Types
// Generated based on schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: number
          name: string
          short_name: string | null
          edition: number
          year: number
          start_date: string
          end_date: string
          match_duration: number
          half_duration: number
          interval_minutes: number
          group_count: number | null
          teams_per_group: number | null
          advancing_teams: number | null
          sender_organization: string | null
          sender_name: string | null
          sender_contact: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          short_name?: string | null
          edition?: number
          year: number
          start_date: string
          end_date: string
          match_duration?: number
          half_duration?: number
          interval_minutes?: number
          group_count?: number | null
          teams_per_group?: number | null
          advancing_teams?: number | null
          sender_organization?: string | null
          sender_name?: string | null
          sender_contact?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          short_name?: string | null
          edition?: number
          year?: number
          start_date?: string
          end_date?: string
          match_duration?: number
          half_duration?: number
          interval_minutes?: number
          group_count?: number | null
          teams_per_group?: number | null
          advancing_teams?: number | null
          sender_organization?: string | null
          sender_name?: string | null
          sender_contact?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          tournament_id: number
          id: string
          name: string
          venue_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          tournament_id: number
          id: string
          name: string
          venue_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          tournament_id?: number
          id?: string
          name?: string
          venue_id?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: number
          tournament_id: number
          name: string
          short_name: string | null
          team_type: 'local' | 'invited'
          is_venue_host: boolean
          group_id: string | null
          group_order: number | null
          prefecture: string | null
          region: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tournament_id: number
          name: string
          short_name?: string | null
          team_type?: 'local' | 'invited'
          is_venue_host?: boolean
          group_id?: string | null
          group_order?: number | null
          prefecture?: string | null
          region?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tournament_id?: number
          name?: string
          short_name?: string | null
          team_type?: 'local' | 'invited'
          is_venue_host?: boolean
          group_id?: string | null
          group_order?: number | null
          prefecture?: string | null
          region?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      venues: {
        Row: {
          id: number
          tournament_id: number
          name: string
          address: string | null
          group_id: string | null
          max_matches_per_day: number
          for_preliminary: boolean
          for_final_day: boolean
          is_finals_venue: boolean
          manager_team_id: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tournament_id: number
          name: string
          address?: string | null
          group_id?: string | null
          max_matches_per_day?: number
          for_preliminary?: boolean
          for_final_day?: boolean
          is_finals_venue?: boolean
          manager_team_id?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tournament_id?: number
          name?: string
          address?: string | null
          group_id?: string | null
          max_matches_per_day?: number
          for_preliminary?: boolean
          for_final_day?: boolean
          is_finals_venue?: boolean
          manager_team_id?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: number
          tournament_id: number
          group_id: string | null
          venue_id: number
          home_team_id: number | null
          away_team_id: number | null
          match_date: string
          match_time: string
          match_order: number
          stage: 'preliminary' | 'semifinal' | 'third_place' | 'final' | 'training'
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          home_score_half1: number | null
          home_score_half2: number | null
          home_score_total: number | null
          away_score_half1: number | null
          away_score_half2: number | null
          away_score_total: number | null
          home_pk: number | null
          away_pk: number | null
          has_penalty_shootout: boolean
          result: 'home_win' | 'away_win' | 'draw' | null
          is_locked: boolean
          locked_by: string | null
          locked_at: string | null
          entered_by: string | null
          entered_at: string | null
          approval_status: 'pending' | 'approved' | 'rejected' | null
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          notes: string | null
          home_seed: string | null
          away_seed: string | null
          referee_main: string | null
          referee_assistant: string | null
          venue_manager: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tournament_id: number
          group_id?: string | null
          venue_id: number
          home_team_id?: number | null
          away_team_id?: number | null
          match_date: string
          match_time: string
          match_order: number
          stage?: 'preliminary' | 'semifinal' | 'third_place' | 'final' | 'training'
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          home_score_half1?: number | null
          home_score_half2?: number | null
          home_score_total?: number | null
          away_score_half1?: number | null
          away_score_half2?: number | null
          away_score_total?: number | null
          home_pk?: number | null
          away_pk?: number | null
          has_penalty_shootout?: boolean
          result?: 'home_win' | 'away_win' | 'draw' | null
          is_locked?: boolean
          locked_by?: string | null
          locked_at?: string | null
          entered_by?: string | null
          entered_at?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          notes?: string | null
          home_seed?: string | null
          away_seed?: string | null
          referee_main?: string | null
          referee_assistant?: string | null
          venue_manager?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tournament_id?: number
          group_id?: string | null
          venue_id?: number
          home_team_id?: number | null
          away_team_id?: number | null
          match_date?: string
          match_time?: string
          match_order?: number
          stage?: 'preliminary' | 'semifinal' | 'third_place' | 'final' | 'training'
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          home_score_half1?: number | null
          home_score_half2?: number | null
          home_score_total?: number | null
          away_score_half1?: number | null
          away_score_half2?: number | null
          away_score_total?: number | null
          home_pk?: number | null
          away_pk?: number | null
          has_penalty_shootout?: boolean
          result?: 'home_win' | 'away_win' | 'draw' | null
          is_locked?: boolean
          locked_by?: string | null
          locked_at?: string | null
          entered_by?: string | null
          entered_at?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          notes?: string | null
          home_seed?: string | null
          away_seed?: string | null
          referee_main?: string | null
          referee_assistant?: string | null
          venue_manager?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: number
          match_id: number
          team_id: number
          player_id: number | null
          player_name: string
          minute: number
          half: number
          is_own_goal: boolean
          is_penalty: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          match_id: number
          team_id: number
          player_id?: number | null
          player_name: string
          minute: number
          half: number
          is_own_goal?: boolean
          is_penalty?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          match_id?: number
          team_id?: number
          player_id?: number | null
          player_name?: string
          minute?: number
          half?: number
          is_own_goal?: boolean
          is_penalty?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      standings: {
        Row: {
          id: number
          tournament_id: number
          group_id: string
          team_id: number
          rank: number
          played: number
          won: number
          drawn: number
          lost: number
          goals_for: number
          goals_against: number
          goal_difference: number
          points: number
          rank_reason: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          tournament_id: number
          group_id: string
          team_id: number
          rank?: number
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          goal_difference?: number
          points?: number
          rank_reason?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          tournament_id?: number
          group_id?: string
          team_id?: number
          rank?: number
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          goal_difference?: number
          points?: number
          rank_reason?: string | null
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: number
          team_id: number
          number: number | null
          name: string
          name_kana: string | null
          grade: number | null
          position: string | null
          is_captain: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          team_id: number
          number?: number | null
          name: string
          name_kana?: string | null
          grade?: number | null
          position?: string | null
          is_captain?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          team_id?: number
          number?: number | null
          name?: string
          name_kana?: string | null
          grade?: number | null
          position?: string | null
          is_captain?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string
          name: string | null
          email: string | null
          role: 'admin' | 'venue_staff' | 'viewer'
          venue_id: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name: string
          name?: string | null
          email?: string | null
          role?: 'admin' | 'venue_staff' | 'viewer'
          venue_id?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string
          name?: string | null
          email?: string | null
          role?: 'admin' | 'venue_staff' | 'viewer'
          venue_id?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      exclusion_pairs: {
        Row: {
          id: number
          tournament_id: number
          group_id: string
          team1_id: number
          team2_id: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: number
          tournament_id: number
          group_id: string
          team1_id: number
          team2_id: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          tournament_id?: number
          group_id?: string
          team1_id?: number
          team2_id?: number
          reason?: string | null
          created_at?: string
        }
      }
      staff: {
        Row: {
          id: number
          team_id: number
          name: string
          role: string | null
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          team_id: number
          name: string
          role?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          team_id?: number
          name?: string
          role?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Enums: {
      team_type: 'local' | 'invited'
      match_stage: 'preliminary' | 'semifinal' | 'third_place' | 'final' | 'training'
      match_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
      match_result: 'home_win' | 'away_win' | 'draw'
      approval_status: 'pending' | 'approved' | 'rejected'
      user_role: 'admin' | 'venue_staff' | 'viewer'
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenient type aliases
export type Tournament = Tables<'tournaments'>
export type Group = Tables<'groups'>
export type Team = Tables<'teams'>
export type Venue = Tables<'venues'>
export type Match = Tables<'matches'>
export type Goal = Tables<'goals'>
export type Standing = Tables<'standings'>
export type Player = Tables<'players'>
export type Profile = Tables<'profiles'>
