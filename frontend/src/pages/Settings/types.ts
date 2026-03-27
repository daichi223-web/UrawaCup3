// src/pages/Settings/types.ts
/**
 * Settings ページの型定義
 */

export interface TournamentForm {
  name: string
  year: number
  startDate: string
  endDate: string
  gameMinutes: number
  intervalMinutes: number
  useGroupSystem: boolean
  teamsPerGroup: number
  matchesPerTeam: number
  pointsForWin: number
  pointsForDraw: number
  pointsForLoss: number
  description: string
  isSingleLeague: boolean
  singleLeagueTeamCount: number
  singleLeagueMatchesPerTeam: number
  finalsStartTime: string
  finalsDay: number
  preliminaryStartTime: string
  finalsMatchDuration: number
  finalsIntervalMinutes: number
  dayEndTime: string
  day2StartTime: string
  day2EndTime: string
  lunchBreakStart: string
  lunchBreakEnd: string
  enableLunchBreak: boolean
  venue_per_group: boolean
}

export interface VenueForm {
  name: string
  address: string
  capacity: number | null
  groundName: string
  groundNameDay2: string
  notes: string
  assigned_group: string
  forPreliminary: boolean
  forFinalDay: boolean
  isFinalsVenue: boolean
  isMixedUse: boolean
  finalsMatchCount: number
}

export interface AddVenueForm {
  name: string
  address: string
  notes: string
  capacity: number | null
}

export interface NewTournamentForm {
  name: string
  year: number
  startDate: string
  endDate: string
  description: string
}

export interface Venue {
  id: number
  name: string
  address: string
  capacity: number | null
  ground_name: string | null
  ground_name_day2: string | null
  notes: string
  assigned_group: string | null
  for_preliminary?: boolean
  for_final_day?: boolean
  is_finals_venue?: boolean
  is_mixed_use?: boolean
  finals_match_count?: number
}

export interface Team {
  id: number
  name: string
  short_name: string | null
  group_id: string | null
  seed_number: number | null
  is_local: boolean
  region_id: number | null
  league_id: number | null
  region_name?: string
}

export interface League {
  id: number
  name: string
}

export interface Region {
  id: number
  name: string
}

export interface Tournament {
  id: number
  name: string
  year: number
  start_date: string
  end_date: string
  game_minutes: number
  interval_minutes: number
  use_group_system: boolean
  teams_per_group: number
  matches_per_team: number
  points_for_win: number
  points_for_draw: number
  points_for_loss: number
  description: string
  is_single_league: boolean
  single_league_team_count: number
  single_league_matches_per_team: number
  finals_start_time: string
  finals_day: number
  preliminary_start_time: string
  finals_match_duration: number
  finals_interval_minutes: number
  day_end_time: string
  day2_start_time: string
  day2_end_time: string
  lunch_break_start: string
  lunch_break_end: string
  enable_lunch_break: boolean
  venue_per_group: boolean
}
