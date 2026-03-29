// src/pages/MatchSchedule/types.ts
// 日程管理画面の型定義

import type { MatchWithDetails, MatchStatus } from '@/types'

export type TabKey = 'day1' | 'day2' | 'day3'

export interface TabInfo {
  key: TabKey
  label: string
  dayOffset: number
  description: string
}

export interface EditFormState {
  matchDate: string
  matchTime: string
  venueId: number
  matchOrder: number
  homeTeamId?: number | null
  awayTeamId?: number | null
}

export interface TeamInfo {
  id: number
  name: string
  shortName?: string
  groupId?: string
  teamType?: 'local' | 'invited'
  region?: string
  leagueId?: string | number
}

export interface VenueInfo {
  id: number
  name: string
  groupId?: string
  group_id?: string
  maxMatchesPerDay?: number
  forPreliminary?: boolean
  for_preliminary?: boolean
  forFinalDay?: boolean
  for_final_day?: boolean
  isFinalsVenue?: boolean
}

export interface GenerateResult {
  created: number
  warnings: string[]
}

export interface DeleteResult {
  deleted: number
  stage: 'preliminary' | 'finals' | 'training' | 'all'
}

export type GenerateType = 'preliminary' | 'finals' | 'training' | null
export type DeleteType = 'preliminary' | 'finals' | 'training' | 'all' | null

export interface SelectedTeam {
  matchId: number
  teamId: number
  teamName: string
  position: 'home' | 'away'
}

// API Response types (snake_case from database)
export interface VenueApiResponse {
  id: number
  name: string
  group_id?: string
  max_matches_per_day?: number
  for_preliminary?: boolean
  for_final_day?: boolean
  is_finals_venue?: boolean
}

export interface TeamApiResponse {
  id: number
  name: string
  short_name?: string
  group_id?: string
  seed_number?: number
  team_type?: 'local' | 'invited'
  region?: string
  league_id?: string | number
}

export interface MatchApiResponse {
  id: number
  match_date: string
  match_time: string
  venue_id: number
  match_order?: number
  home_team_id: number
  away_team_id: number
  home_team?: { id: number; name: string; short_name?: string }
  away_team?: { id: number; name: string; short_name?: string }
  home_score_total?: number
  away_score_total?: number
  group_id?: string
  stage?: string
  status?: string
  is_b_match?: boolean
}

export interface TournamentWithConstraints {
  avoid_local_vs_local?: boolean
  avoid_same_region?: boolean
  avoid_same_league?: boolean
  avoid_consecutive?: boolean
  warn_daily_game_limit?: boolean
  warn_total_game_limit?: boolean
  use_group_system?: boolean
  preliminary_start_time?: string
  match_duration?: number
  interval_minutes?: number
  matches_per_team_per_day?: number
}

export interface MutationError {
  message?: string
}

export { type MatchWithDetails, type MatchStatus }
