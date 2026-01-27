// src/lib/scheduleGenerator/schedule/venue-based.ts
/**
 * 会場配置ベースの日程生成（1リーグ制・新方式）
 */

import type {
  Venue,
  VenueAssignmentInfo,
  GeneratedMatchWithBMatch,
  VenueBasedScheduleResult,
  ScheduleConfig,
  MatchPatternEntry,
} from '../types'
import {
  DEFAULT_START_TIME,
  DEFAULT_MATCH_DURATION,
  DEFAULT_INTERVAL,
  getMatchPattern,
} from '../constants'
import { generateKickoffTimes } from '../utils/kickoff'

/**
 * 会場のチーム構成に基づいて地元同士を完全回避する試合パターンを生成
 */
function generateMatchPatternForVenue(
  teams: { teamType?: string }[]
): MatchPatternEntry[] {
  if (teams.length !== 4) {
    return getMatchPattern('B')
  }

  const localIndices: number[] = []
  const invitedIndices: number[] = []

  teams.forEach((team, idx) => {
    if (team.teamType === 'local') {
      localIndices.push(idx + 1)
    } else {
      invitedIndices.push(idx + 1)
    }
  })

  // 地元2 + 招待2 の場合
  if (localIndices.length === 2 && invitedIndices.length === 2) {
    const [L1, L2] = localIndices
    const [I1, I2] = invitedIndices

    return [
      { slot: 1, home: L1, away: I1, isBMatch: false },
      { slot: 2, home: L2, away: I2, isBMatch: false },
      { slot: 3, home: L1, away: I1, isBMatch: true },
      { slot: 4, home: L1, away: I2, isBMatch: false },
      { slot: 5, home: L2, away: I1, isBMatch: false },
      { slot: 6, home: L2, away: I2, isBMatch: true },
    ]
  }

  // 地元3 + 招待1 の場合
  if (localIndices.length === 3 && invitedIndices.length === 1) {
    const [L1, L2, L3] = localIndices
    const [I1] = invitedIndices

    return [
      { slot: 1, home: L1, away: I1, isBMatch: false },
      { slot: 2, home: L2, away: L3, isBMatch: false },
      { slot: 3, home: L2, away: I1, isBMatch: true },
      { slot: 4, home: L1, away: L2, isBMatch: false },
      { slot: 5, home: L3, away: I1, isBMatch: false },
      { slot: 6, home: L1, away: I1, isBMatch: true },
    ]
  }

  // 地元1 + 招待3 の場合
  if (localIndices.length === 1 && invitedIndices.length === 3) {
    const [L1] = localIndices
    const [I1, I2, I3] = invitedIndices

    return [
      { slot: 1, home: L1, away: I1, isBMatch: false },
      { slot: 2, home: I2, away: I3, isBMatch: false },
      { slot: 3, home: L1, away: I2, isBMatch: true },
      { slot: 4, home: L1, away: I3, isBMatch: false },
      { slot: 5, home: I1, away: I2, isBMatch: false },
      { slot: 6, home: L1, away: I1, isBMatch: true },
    ]
  }

  return getMatchPattern('B')
}

/**
 * 会場配置ベースの日程生成
 */
export function generateVenueBasedSchedule(
  day1Assignments: VenueAssignmentInfo[],
  day2Assignments: VenueAssignmentInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string,
  config?: ScheduleConfig
): VenueBasedScheduleResult {
  const warnings: string[] = []
  const matches: GeneratedMatchWithBMatch[] = []
  let matchOrder = 1

  const startTime = config?.startTime || DEFAULT_START_TIME
  const matchDuration = config?.matchDuration || DEFAULT_MATCH_DURATION
  const interval = config?.intervalMinutes || DEFAULT_INTERVAL

  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, 6)

  console.log('[VenueBased] 設定:', { startTime, matchDuration, interval })
  console.log('[VenueBased] キックオフ時刻:', kickoffTimes)

  const generateDayMatches = (
    assignments: VenueAssignmentInfo[],
    day: 1 | 2,
    matchDate: string
  ): GeneratedMatchWithBMatch[] => {
    const dayMatches: GeneratedMatchWithBMatch[] = []

    const venueGroups = new Map<number, VenueAssignmentInfo[]>()
    for (const assignment of assignments) {
      if (!venueGroups.has(assignment.venueId)) {
        venueGroups.set(assignment.venueId, [])
      }
      venueGroups.get(assignment.venueId)!.push(assignment)
    }

    for (const [venueId, venueTeams] of venueGroups) {
      venueTeams.sort((a, b) => a.slotOrder - b.slotOrder)

      const venue = venues.find(v => v.id === venueId)
      const venueName = venue?.name || venueTeams[0]?.venueName || `会場${venueId}`

      if (venueTeams.length !== 4) {
        warnings.push(`Day${day} 会場${venueName}: チーム数が${venueTeams.length}です（4チーム必要）`)
        if (venueTeams.length < 2) continue
      }

      const teamsForPattern = venueTeams.map(t => ({ teamType: t.teamType }))
      const matchPattern = generateMatchPatternForVenue(teamsForPattern)

      for (const pattern of matchPattern) {
        const homeTeam = venueTeams[pattern.home - 1]
        const awayTeam = venueTeams[pattern.away - 1]

        if (!homeTeam || !awayTeam) {
          warnings.push(`Day${day} 会場${venueName} 枠${pattern.slot}: チームが不足`)
          continue
        }

        dayMatches.push({
          homeTeamId: homeTeam.teamId,
          awayTeamId: awayTeam.teamId,
          homeTeamName: homeTeam.teamShortName || homeTeam.teamName,
          awayTeamName: awayTeam.teamShortName || awayTeam.teamName,
          groupId: null as unknown as string,
          venueId: venueId,
          venueName: venueName,
          matchDate,
          matchTime: kickoffTimes[pattern.slot - 1] || kickoffTimes[kickoffTimes.length - 1],
          matchOrder: matchOrder++,
          day,
          slot: pattern.slot,
          isBMatch: pattern.isBMatch,
        })
      }
    }

    return dayMatches
  }

  if (day1Assignments.length === 0) {
    warnings.push('Day1の会場配置がありません')
  } else {
    const day1Matches = generateDayMatches(day1Assignments, 1, day1Date)
    matches.push(...day1Matches)
  }

  if (day2Assignments.length === 0) {
    warnings.push('Day2の会場配置がありません')
  } else {
    const day2Matches = generateDayMatches(day2Assignments, 2, day2Date)
    matches.push(...day2Matches)
  }

  const aMatches = matches.filter(m => !m.isBMatch).length
  const bMatches = matches.filter(m => m.isBMatch).length

  // 各チームの試合数を確認
  const matchCountByTeam: Record<number, { a: number; b: number }> = {}
  matches.forEach(m => {
    if (!matchCountByTeam[m.homeTeamId]) matchCountByTeam[m.homeTeamId] = { a: 0, b: 0 }
    if (!matchCountByTeam[m.awayTeamId]) matchCountByTeam[m.awayTeamId] = { a: 0, b: 0 }
    if (m.isBMatch) {
      matchCountByTeam[m.homeTeamId].b++
      matchCountByTeam[m.awayTeamId].b++
    } else {
      matchCountByTeam[m.homeTeamId].a++
      matchCountByTeam[m.awayTeamId].a++
    }
  })

  for (const [teamId, counts] of Object.entries(matchCountByTeam)) {
    if (counts.a < 4) {
      const team = [...day1Assignments, ...day2Assignments].find(a => a.teamId === Number(teamId))
      const teamName = team?.teamShortName || team?.teamName || `チーム${teamId}`
      warnings.push(`${teamName}: A戦が${counts.a}試合（4試合必要）`)
    }
  }

  const day1Matches = matches.filter(m => m.day === 1)
  const day2Matches = matches.filter(m => m.day === 2)

  return {
    success: matches.length > 0,
    matches,
    day1Matches,
    day2Matches,
    warnings,
    stats: {
      totalMatches: matches.length,
      aMatches,
      bMatches,
      matchesPerTeam: 6,
    },
  }
}
