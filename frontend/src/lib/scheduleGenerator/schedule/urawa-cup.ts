// src/lib/scheduleGenerator/schedule/urawa-cup.ts
/**
 * 浦和カップの日程生成
 */

import type {
  TeamInfo,
  Venue,
  GeneratedMatch,
  ScheduleGenerationResult,
  ScheduleConfig,
} from '../types'
import {
  GROUPS,
  DAY1_MATCHES,
  DAY2_MATCHES,
  DEFAULT_START_TIME,
  DEFAULT_MATCH_DURATION,
  DEFAULT_INTERVAL,
} from '../constants'
import { generateKickoffTimes } from '../utils/kickoff'
import { getTeamsByGroup } from '../utils/team'
import { getVenueForGroup, getRefereeTeams } from '../utils/venue'

/**
 * 浦和カップの日程を生成
 * @param teams チーム一覧
 * @param venues 会場一覧
 * @param day1Date 初日の日付
 * @param day2Date 二日目の日付
 * @param config 設定（試合時間、間隔など）
 */
export function generateUrawaCupSchedule(
  teams: TeamInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string,
  config?: ScheduleConfig
): ScheduleGenerationResult {
  const warnings: string[] = []
  const matches: GeneratedMatch[] = []
  let matchOrder = 1

  const startTime = config?.startTime || DEFAULT_START_TIME
  const matchDuration = config?.matchDuration || DEFAULT_MATCH_DURATION
  const interval = config?.intervalMinutes || DEFAULT_INTERVAL

  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, 6)

  console.log('[Schedule] 設定:', { startTime, matchDuration, interval })
  console.log('[Schedule] キックオフ時刻:', kickoffTimes)

  for (const groupId of GROUPS) {
    const groupTeams = getTeamsByGroup(teams, groupId)

    if (groupTeams.length !== 6) {
      warnings.push(`グループ${groupId}のチーム数が${groupTeams.length}です（6チーム必要）`)
      if (groupTeams.length < 2) continue
    }

    const venue = getVenueForGroup(venues, groupId)
    if (!venue) {
      warnings.push(`グループ${groupId}の会場が見つかりません`)
      continue
    }

    // 初日の試合を生成
    for (let slot = 0; slot < DAY1_MATCHES.length; slot++) {
      const [homeSeed, awaySeed] = DAY1_MATCHES[slot]
      const homeTeam = groupTeams.find(t => t.seedNumber === homeSeed)
      const awayTeam = groupTeams.find(t => t.seedNumber === awaySeed)

      if (!homeTeam || !awayTeam) {
        warnings.push(`グループ${groupId}の初日枠${slot + 1}: チームが見つかりません`)
        continue
      }

      const refereeTeamIds = getRefereeTeams(groupTeams, homeSeed, awaySeed)

      matches.push({
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeTeamName: homeTeam.shortName || homeTeam.name,
        awayTeamName: awayTeam.shortName || awayTeam.name,
        groupId,
        venueId: venue.id,
        venueName: venue.name,
        matchDate: day1Date,
        matchTime: kickoffTimes[slot],
        matchOrder: matchOrder++,
        day: 1,
        slot: slot + 1,
        refereeTeamIds,
      })
    }

    // 二日目の試合を生成
    for (let slot = 0; slot < DAY2_MATCHES.length; slot++) {
      const [homeSeed, awaySeed] = DAY2_MATCHES[slot]
      const homeTeam = groupTeams.find(t => t.seedNumber === homeSeed)
      const awayTeam = groupTeams.find(t => t.seedNumber === awaySeed)

      if (!homeTeam || !awayTeam) {
        warnings.push(`グループ${groupId}の二日目枠${slot + 1}: チームが見つかりません`)
        continue
      }

      const refereeTeamIds = getRefereeTeams(groupTeams, homeSeed, awaySeed)

      matches.push({
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeTeamName: homeTeam.shortName || homeTeam.name,
        awayTeamName: awayTeam.shortName || awayTeam.name,
        groupId,
        venueId: venue.id,
        venueName: venue.name,
        matchDate: day2Date,
        matchTime: kickoffTimes[slot],
        matchOrder: matchOrder++,
        day: 2,
        slot: slot + 1,
        refereeTeamIds,
      })
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
      matchesPerGroup: 12,
      matchesPerTeam: 4,
    },
  }
}
