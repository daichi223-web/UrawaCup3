// src/pages/TeamManagement/types.ts

export interface Venue {
  id: number
  name: string
  short_name?: string
  shortName?: string
}

export interface Team {
  id: number
  name: string
  short_name?: string
  group_id?: string
  groupId?: string
  team_type?: string
  teamType?: string
  is_venue_host?: boolean
  isVenueHost?: boolean
  tournament_id: number
  group_order?: number
  region?: string
  league_id?: number
  leagueId?: number
}

export interface League {
  id: number
  name: string
}

export interface EditFormState {
  name: string
  groupId: string
  teamType: string
  isVenueHost: boolean
  region: string
  leagueId: string
}

export interface DeleteAllValidation {
  canDelete: boolean
  matchCount: number
  goalCount: number
}
