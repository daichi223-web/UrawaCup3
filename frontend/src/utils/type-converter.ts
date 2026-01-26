/**
 * Type Conversion Utilities
 *
 * Convert between snake_case (Supabase/API responses) and
 * camelCase (frontend TypeScript interfaces).
 */

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamelString(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnakeString(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Convert an object's keys from snake_case to camelCase
 */
export function snakeToCamel<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? snakeToCamel(item as Record<string, unknown>)
        : item
    ) as unknown as Record<string, unknown>
  }

  if (typeof obj !== 'object') {
    return obj
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      const camelKey = snakeToCamelString(key)
      const convertedValue =
        typeof value === 'object' && value !== null
          ? snakeToCamel(value as Record<string, unknown>)
          : value
      return [camelKey, convertedValue]
    })
  )
}

/**
 * Convert an array of objects from snake_case to camelCase
 */
export function snakeToCamelArray<T extends Record<string, unknown>>(
  arr: T[]
): Record<string, unknown>[] {
  return arr.map((item) => snakeToCamel(item))
}

/**
 * Convert an object's keys from camelCase to snake_case
 */
export function camelToSnake<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? camelToSnake(item as Record<string, unknown>)
        : item
    ) as unknown as Record<string, unknown>
  }

  if (typeof obj !== 'object') {
    return obj
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      const snakeKey = camelToSnakeString(key)
      const convertedValue =
        typeof value === 'object' && value !== null
          ? camelToSnake(value as Record<string, unknown>)
          : value
      return [snakeKey, convertedValue]
    })
  )
}

/**
 * Convert an array of objects from camelCase to snake_case
 */
export function camelToSnakeArray<T extends Record<string, unknown>>(
  arr: T[]
): Record<string, unknown>[] {
  return arr.map((item) => camelToSnake(item))
}

/**
 * Type-safe match conversion from Supabase response
 */
import type { MatchWithRelations, TeamRow, VenueRow, GoalRow } from '@/lib/supabase-query'
import type { MatchWithDetails, Team, Venue, Goal } from '@shared/types'

/**
 * Convert a match row from Supabase to the frontend MatchWithDetails type
 */
export function convertMatch(match: MatchWithRelations): MatchWithDetails {
  const homeTeam = match.home_team ? convertTeam(match.home_team) : undefined
  const awayTeam = match.away_team ? convertTeam(match.away_team) : undefined
  const venue = match.venue ? convertVenue(match.venue) : undefined
  const goals = match.goals ? match.goals.map(convertGoal) : []

  return {
    id: match.id,
    tournamentId: match.tournament_id,
    groupId: match.group_id ?? undefined,
    venueId: match.venue_id,
    homeTeamId: match.home_team_id ?? 0,
    awayTeamId: match.away_team_id ?? 0,
    matchDate: match.match_date,
    matchTime: match.match_time,
    matchOrder: match.match_order,
    stage: match.stage,
    status: match.status,
    homeScoreHalf1: match.home_score_half1 ?? undefined,
    homeScoreHalf2: match.home_score_half2 ?? undefined,
    homeScoreTotal: match.home_score_total ?? undefined,
    awayScoreHalf1: match.away_score_half1 ?? undefined,
    awayScoreHalf2: match.away_score_half2 ?? undefined,
    awayScoreTotal: match.away_score_total ?? undefined,
    homePK: match.home_pk ?? undefined,
    awayPK: match.away_pk ?? undefined,
    hasPenaltyShootout: match.has_penalty_shootout,
    result: match.result ?? undefined,
    isLocked: match.is_locked,
    lockedBy: match.locked_by ? Number(match.locked_by) : undefined,
    lockedAt: match.locked_at ?? undefined,
    enteredBy: match.entered_by ? Number(match.entered_by) : undefined,
    enteredAt: match.entered_at ?? undefined,
    approvalStatus: match.approval_status ?? undefined,
    approvedBy: match.approved_by ? Number(match.approved_by) : undefined,
    approvedAt: match.approved_at ?? undefined,
    rejectionReason: match.rejection_reason ?? undefined,
    notes: match.notes ?? undefined,
    createdAt: match.created_at,
    updatedAt: match.updated_at,
    // Relations
    homeTeam: homeTeam as Team,
    awayTeam: awayTeam as Team,
    venue: venue as Venue,
    goals: goals as Goal[],
    // snake_case aliases for backward compatibility
    tournament_id: match.tournament_id,
    group_id: match.group_id ?? undefined,
    venue_id: match.venue_id,
    home_team_id: match.home_team_id ?? undefined,
    away_team_id: match.away_team_id ?? undefined,
    match_date: match.match_date,
    match_time: match.match_time,
    match_order: match.match_order,
    home_score_half1: match.home_score_half1 ?? undefined,
    home_score_half2: match.home_score_half2 ?? undefined,
    home_score_total: match.home_score_total ?? undefined,
    away_score_half1: match.away_score_half1 ?? undefined,
    away_score_half2: match.away_score_half2 ?? undefined,
    away_score_total: match.away_score_total ?? undefined,
    home_pk: match.home_pk ?? undefined,
    away_pk: match.away_pk ?? undefined,
    has_penalty_shootout: match.has_penalty_shootout,
    is_locked: match.is_locked,
    locked_by: match.locked_by ? Number(match.locked_by) : undefined,
    locked_at: match.locked_at ?? undefined,
    entered_by: match.entered_by ? Number(match.entered_by) : undefined,
    entered_at: match.entered_at ?? undefined,
    approval_status: match.approval_status ?? undefined,
    approved_by: match.approved_by ? Number(match.approved_by) : undefined,
    approved_at: match.approved_at ?? undefined,
    rejection_reason: match.rejection_reason ?? undefined,
    created_at: match.created_at,
    updated_at: match.updated_at,
    home_team: homeTeam as Team,
    away_team: awayTeam as Team,
  }
}

/**
 * Convert a team row from Supabase to the frontend Team type
 */
export function convertTeam(team: TeamRow): Team {
  return {
    id: team.id,
    tournamentId: team.tournament_id,
    name: team.name,
    shortName: team.short_name ?? undefined,
    teamType: team.team_type,
    isVenueHost: team.is_venue_host,
    groupId: team.group_id ?? undefined,
    groupOrder: team.group_order ?? undefined,
    prefecture: team.prefecture ?? undefined,
    region: team.region ?? undefined,
    notes: team.notes ?? undefined,
    createdAt: team.created_at,
    updatedAt: team.updated_at,
    // snake_case aliases
    tournament_id: team.tournament_id,
    short_name: team.short_name ?? undefined,
    team_type: team.team_type,
    is_venue_host: team.is_venue_host,
    group_id: team.group_id ?? undefined,
    group_order: team.group_order ?? undefined,
    created_at: team.created_at,
    updated_at: team.updated_at,
  }
}

/**
 * Convert a venue row from Supabase to the frontend Venue type
 */
export function convertVenue(venue: VenueRow): Venue {
  return {
    id: venue.id,
    tournamentId: venue.tournament_id,
    name: venue.name,
    address: venue.address ?? undefined,
    groupId: venue.group_id ?? undefined,
    maxMatchesPerDay: venue.max_matches_per_day,
    forPreliminary: venue.for_preliminary,
    forFinalDay: venue.for_final_day,
    isFinalsVenue: venue.is_finals_venue,
    isMixedUse: false,
    finalsMatchCount: 1,
    notes: venue.notes ?? undefined,
    createdAt: venue.created_at,
    updatedAt: venue.updated_at,
    // snake_case aliases
    tournament_id: venue.tournament_id,
    group_id: venue.group_id ?? undefined,
    max_matches_per_day: venue.max_matches_per_day,
    for_preliminary: venue.for_preliminary,
    for_final_day: venue.for_final_day,
    is_finals_venue: venue.is_finals_venue,
    created_at: venue.created_at,
    updated_at: venue.updated_at,
  }
}

/**
 * Convert a goal row from Supabase to the frontend Goal type
 */
export function convertGoal(goal: GoalRow): Goal {
  return {
    id: goal.id,
    matchId: goal.match_id,
    teamId: goal.team_id,
    playerId: goal.player_id ?? undefined,
    playerName: goal.player_name,
    minute: goal.minute,
    half: goal.half as 1 | 2,
    isOwnGoal: goal.is_own_goal,
    isPenalty: goal.is_penalty,
    notes: goal.notes ?? undefined,
    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
  }
}

/**
 * Convert matches array to MatchWithDetails array
 */
export function convertMatches(matches: MatchWithRelations[]): MatchWithDetails[] {
  return matches.map(convertMatch)
}
