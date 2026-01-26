/**
 * Type-safe Supabase Query Helpers
 *
 * These helpers maintain type information when building conditional queries,
 * solving the issue where TypeScript loses type inference with `let query = ...`
 * followed by conditional `query = query.eq(...)` patterns.
 */

import { supabase } from './supabase'
import type { Database } from './database.types'

// Table names from the database schema
type TableName = keyof Database['public']['Tables']

// Row type for a given table (exported for use in other files)
export type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row']

// Generic query result type (exported for use in other files)
export type QueryResult<T> = {
  data: T[] | null
  error: Error | null
}

/**
 * Type-safe select query builder
 * Returns properly typed data from Supabase queries
 */
export function typedQuery<T extends TableName>(table: T) {
  return supabase.from(table)
}

/**
 * Type definition for match with joined relations
 */
export interface MatchWithRelations {
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
  // Joined relations
  home_team?: TeamRow | null
  away_team?: TeamRow | null
  venue?: VenueRow | null
  goals?: GoalRow[]
}

export interface TeamRow {
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

export interface VenueRow {
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

export interface GoalRow {
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

export interface StandingRow {
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

export interface StandingWithTeam extends StandingRow {
  team?: TeamRow | null
}

export interface GroupRow {
  tournament_id: number
  id: string
  name: string
  venue_id: number | null
  created_at: string
  updated_at: string
}

/**
 * Fetch matches with all related data
 */
export async function fetchMatchesWithRelations(
  tournamentId: number,
  options?: {
    matchDate?: string
    venueId?: number
    groupId?: string
    stage?: string | string[]
    status?: string
  }
): Promise<{ data: MatchWithRelations[] | null; error: Error | null }> {
  let query = supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      venue:venues(*),
      goals(*)
    `)
    .eq('tournament_id', tournamentId)

  if (options?.matchDate) {
    query = query.eq('match_date', options.matchDate)
  }
  if (options?.venueId) {
    query = query.eq('venue_id', options.venueId)
  }
  if (options?.groupId) {
    query = query.eq('group_id', options.groupId)
  }
  if (options?.stage) {
    if (Array.isArray(options.stage)) {
      query = query.in('stage', options.stage)
    } else {
      query = query.eq('stage', options.stage)
    }
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }

  query = query.order('match_time')

  const { data, error } = await query

  return {
    data: data as MatchWithRelations[] | null,
    error: error as Error | null,
  }
}

/**
 * Fetch standings with team data
 */
export async function fetchStandingsWithTeam(
  tournamentId: number,
  groupId: string
): Promise<{ data: StandingWithTeam[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('standings')
    .select('*, team:teams(*)')
    .eq('tournament_id', tournamentId)
    .eq('group_id', groupId)
    .order('rank')

  return {
    data: data as StandingWithTeam[] | null,
    error: error as Error | null,
  }
}

/**
 * Fetch groups for a tournament
 */
export async function fetchGroups(
  tournamentId: number
): Promise<{ data: GroupRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('id')

  return {
    data: data as GroupRow[] | null,
    error: error as Error | null,
  }
}

/**
 * Profile row type
 */
export interface ProfileRow {
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

/**
 * Fetch user profile
 */
export async function fetchProfile(
  userId: string
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return {
    data: data as ProfileRow | null,
    error: error as Error | null,
  }
}

/**
 * Tournament row type
 */
export interface TournamentRow {
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
  // Extended fields (may be added via DB migrations)
  preliminary_start_time?: string
  finals_start_time?: string
  finals_match_duration?: number
  finals_interval_minutes?: number
  training_match_duration?: number
  training_interval_minutes?: number
  training_matches_per_team?: number
  qualification_rule?: string
  bracket_method?: string
}

/**
 * Fetch tournament by ID
 */
export async function fetchTournament(
  tournamentId: number
): Promise<{ data: TournamentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  return {
    data: data as TournamentRow | null,
    error: error as Error | null,
  }
}

/**
 * Outstanding player row type
 */
export interface OutstandingPlayerRow {
  id: number
  tournament_id: number
  team_id: number | null
  player_id: number | null
  team_name: string | null
  player_name: string
  player_number: number | null
  award_type: 'mvp' | 'outstanding'
  display_order: number
  created_at: string
  updated_at: string
  // Joined team data
  team?: TeamRow | null
}

/**
 * Fetch outstanding players with team data
 */
export async function fetchOutstandingPlayers(
  tournamentId: number
): Promise<{ data: OutstandingPlayerRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('outstanding_players')
    .select(`
      *,
      team:teams(name, short_name)
    `)
    .eq('tournament_id', tournamentId)
    .order('award_type')
    .order('display_order')

  return {
    data: data as OutstandingPlayerRow[] | null,
    error: error as Error | null,
  }
}

/**
 * Sender settings row type
 */
export interface SenderSettingsRow {
  id?: number
  tournament_id: number
  recipient?: string
  sender_name?: string
  sender_title?: string
  sender_organization?: string
  contact?: string
  created_at?: string
  updated_at?: string
}

/**
 * Fetch sender settings
 */
export async function fetchSenderSettings(
  tournamentId: number
): Promise<{ data: SenderSettingsRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('sender_settings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .single()

  return {
    data: data as SenderSettingsRow | null,
    error: error as Error | null,
  }
}
