// src/pages/Standings/types.ts
export type ViewMode = 'star' | 'overall'

export interface TeamData {
  id: number
  name: string
  short_name?: string
  shortName?: string
  group_id?: string
  groupId?: string
}

export interface MatchData {
  id: number
  stage?: string
  status?: string
  homeTeamId?: number
  home_team_id?: number
  awayTeamId?: number
  away_team_id?: number
  homeScoreTotal?: number
  home_score_total?: number
  awayScoreTotal?: number
  away_score_total?: number
  group_id?: string
  groupId?: string
  is_b_match?: boolean
  isBMatch?: boolean
}

export interface TeamsResponse {
  teams: TeamData[]
}

export interface MatchesResponse {
  matches: MatchData[]
}

export interface StandingsEntry {
  overallRank: number
  groupId: string
  groupRank: number
  teamId: number
  teamName: string
  shortName: string
  points: number
  goalDifference: number
  goalsFor: number
  goalsAgainst?: number
  played: number
  won: number
  drawn: number
  lost: number
}

export interface TeamStats {
  teamId: number
  teamName: string
  shortName: string
  groupId: string
  points: number
  goalDiff: number
  goalsFor: number
  goalsAgainst: number
  played: number
  won: number
  drawn: number
  lost: number
}
