// src/lib/scheduleGenerator/schedule/single-league.ts
/**
 * 1リーグ制の日程生成
 */

import type {
  TeamInfo,
  Venue,
  GeneratedMatch,
  ScheduleGenerationResult,
  ScheduleConfig,
} from '../types'
import {
  DEFAULT_START_TIME,
  DEFAULT_MATCH_DURATION,
  DEFAULT_INTERVAL,
} from '../constants'
import { generateKickoffTimes } from '../utils/kickoff'
import { calculatePairScore, makePairKey } from '../utils/pairs'

/**
 * 1リーグ制の連戦チェック（全会場横断）
 */
function checkConsecutiveMatchesInSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  const warnings: string[] = []

  for (const day of [1, 2] as const) {
    const dayMatches = matches.filter(m => m.day === day)
    const slotsByTeam: Record<number, number[]> = {}

    for (const match of dayMatches) {
      if (!slotsByTeam[match.homeTeamId]) slotsByTeam[match.homeTeamId] = []
      if (!slotsByTeam[match.awayTeamId]) slotsByTeam[match.awayTeamId] = []
      slotsByTeam[match.homeTeamId].push(match.slot)
      slotsByTeam[match.awayTeamId].push(match.slot)
    }

    for (const [teamId, slots] of Object.entries(slotsByTeam)) {
      slots.sort((a, b) => a - b)
      for (let i = 0; i < slots.length - 1; i++) {
        if (slots[i + 1] - slots[i] === 1) {
          const team = teams.find(t => t.id === Number(teamId))
          const teamName = team?.shortName || team?.name || `チーム${teamId}`
          warnings.push(`Day${day}: ${teamName}が枠${slots[i]}と${slots[i + 1]}で連戦`)
        }
      }
    }
  }

  return warnings
}

/**
 * 1リーグ制の日程を生成
 */
export function generateSingleLeagueSchedule(
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
  const matchesPerTeamPerDay = config?.matchesPerTeamPerDay || 2
  const constraintScores = config?.constraintScores || {}
  const venueHostFirstMatch = config?.venueHostFirstMatch ?? true

  if (teams.length < 2) {
    warnings.push('チームが2チーム以上必要です')
    return {
      success: false,
      matches: [],
      day1Matches: [],
      day2Matches: [],
      warnings,
      stats: { totalMatches: 0, matchesPerGroup: 0, matchesPerTeam: 0 },
    }
  }

  if (venues.length === 0) {
    warnings.push('会場が登録されていません')
    return {
      success: false,
      matches: [],
      day1Matches: [],
      day2Matches: [],
      warnings,
      stats: { totalMatches: 0, matchesPerGroup: 0, matchesPerTeam: 0 },
    }
  }

  const matchesPerDay = (teams.length * matchesPerTeamPerDay) / 2
  const matchesPerVenuePerDay = Math.ceil(matchesPerDay / venues.length)

  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, matchesPerVenuePerDay)

  console.log('[SingleLeague] 設定:', { startTime, matchDuration, interval, constraintScores })
  console.log('[SingleLeague] チーム数:', teams.length, '1日の試合数/チーム:', matchesPerTeamPerDay)
  console.log('[SingleLeague] 1日の総試合数:', matchesPerDay, '2日間合計:', matchesPerDay * 2)
  console.log('[SingleLeague] 会場数:', venues.length, '会場あたり試合数:', matchesPerVenuePerDay)
  console.log('[SingleLeague] キックオフ時刻:', kickoffTimes)

  // 時間オーバーフローのチェック
  const timeParts = startTime.split(':').map(Number)
  const startHour = timeParts[0] || 0
  const startMinute = timeParts[1] || 0
  const totalMinutesNeeded = (startHour * 60 + startMinute) + (matchesPerVenuePerDay - 1) * (matchDuration + interval)
  if (totalMinutesNeeded > 23 * 60 + 59) {
    warnings.push(`1日の試合数が多すぎます。会場あたり${matchesPerVenuePerDay}試合は時間内に収まりません。会場を増やすか、試合間隔を短くしてください。`)
  }

  // 会場校のチームIDをマッピング
  const venueHostTeams = new Map<number, number>()
  teams.forEach(team => {
    if (team.isVenueHost) {
      const venue = venues.find(v => v.name.includes(team.name) || v.name.includes(team.shortName || ''))
      if (venue) {
        venueHostTeams.set(venue.id, team.id)
        console.log(`[SingleLeague] 会場校: ${team.name} -> 会場${venue.name}`)
      }
    }
  })

  // 全対戦ペアを生成
  const allPairs: { home: TeamInfo; away: TeamInfo; score: number }[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairs.push({
        home: teams[i],
        away: teams[j],
        score: calculatePairScore(teams[i], teams[j], new Set(), constraintScores)
      })
    }
  }

  allPairs.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return Math.random() - 0.5
  })

  console.log('[SingleLeague] ペア数:', allPairs.length, '上位5ペア:', allPairs.slice(0, 5).map(p =>
    `${p.home.shortName || p.home.name} vs ${p.away.shortName || p.away.name} (score:${p.score})`
  ))

  const usedPairs = new Set<string>()

  const generateDayMatches = (
    day: 1 | 2,
    matchDate: string,
    availablePairs: { home: TeamInfo; away: TeamInfo; score: number }[]
  ): GeneratedMatch[] => {
    const dayMatches: GeneratedMatch[] = []
    const teamMatchCount: Record<number, number> = {}
    const teamsInPrevSlot = new Set<number>()

    teams.forEach(t => { teamMatchCount[t.id] = 0 })

    const numSlots = matchesPerVenuePerDay

    for (let slotIndex = 0; slotIndex < numSlots; slotIndex++) {
      const teamsInThisSlot = new Set<number>()

      for (let venueIndex = 0; venueIndex < venues.length; venueIndex++) {
        if (dayMatches.length >= matchesPerDay) break

        const venue = venues[venueIndex]

        // 会場校を1試合目に配置
        if (venueHostFirstMatch && slotIndex === 0 && venueHostTeams.has(venue.id)) {
          const hostTeamId = venueHostTeams.get(venue.id)!
          const hostPair = availablePairs.find(pair => {
            const pairKey = makePairKey(pair.home.id, pair.away.id)
            if (usedPairs.has(pairKey)) return false
            if (teamMatchCount[pair.home.id] >= matchesPerTeamPerDay) return false
            if (teamMatchCount[pair.away.id] >= matchesPerTeamPerDay) return false
            if (teamsInThisSlot.has(pair.home.id) || teamsInThisSlot.has(pair.away.id)) return false
            return pair.home.id === hostTeamId || pair.away.id === hostTeamId
          })

          if (hostPair) {
            const pairKey = makePairKey(hostPair.home.id, hostPair.away.id)
            dayMatches.push({
              homeTeamId: hostPair.home.id,
              awayTeamId: hostPair.away.id,
              homeTeamName: hostPair.home.shortName || hostPair.home.name,
              awayTeamName: hostPair.away.shortName || hostPair.away.name,
              groupId: null as unknown as string,
              venueId: venue.id,
              venueName: venue.name,
              matchDate,
              matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
              matchOrder: matchOrder++,
              day,
              slot: slotIndex + 1,
            })
            teamsInThisSlot.add(hostPair.home.id)
            teamsInThisSlot.add(hostPair.away.id)
            teamMatchCount[hostPair.home.id]++
            teamMatchCount[hostPair.away.id]++
            usedPairs.add(pairKey)
            continue
          }
        }

        // 通常のペア選択
        for (const pair of availablePairs) {
          const pairKey = makePairKey(pair.home.id, pair.away.id)

          if (usedPairs.has(pairKey)) continue
          if (teamMatchCount[pair.home.id] >= matchesPerTeamPerDay) continue
          if (teamMatchCount[pair.away.id] >= matchesPerTeamPerDay) continue
          if (teamsInThisSlot.has(pair.home.id)) continue
          if (teamsInThisSlot.has(pair.away.id)) continue

          // 連戦回避
          const isConsecutive = teamsInPrevSlot.has(pair.home.id) || teamsInPrevSlot.has(pair.away.id)
          if (isConsecutive) {
            const hasAlternative = availablePairs.some(altPair => {
              const altKey = makePairKey(altPair.home.id, altPair.away.id)
              if (usedPairs.has(altKey)) return false
              if (teamMatchCount[altPair.home.id] >= matchesPerTeamPerDay) return false
              if (teamMatchCount[altPair.away.id] >= matchesPerTeamPerDay) return false
              if (teamsInThisSlot.has(altPair.home.id) || teamsInThisSlot.has(altPair.away.id)) return false
              if (teamsInPrevSlot.has(altPair.home.id) || teamsInPrevSlot.has(altPair.away.id)) return false
              return true
            })
            if (hasAlternative) continue
          }

          dayMatches.push({
            homeTeamId: pair.home.id,
            awayTeamId: pair.away.id,
            homeTeamName: pair.home.shortName || pair.home.name,
            awayTeamName: pair.away.shortName || pair.away.name,
            groupId: null as unknown as string,
            venueId: venue.id,
            venueName: venue.name,
            matchDate,
            matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
            matchOrder: matchOrder++,
            day,
            slot: slotIndex + 1,
          })

          teamsInThisSlot.add(pair.home.id)
          teamsInThisSlot.add(pair.away.id)
          teamMatchCount[pair.home.id]++
          teamMatchCount[pair.away.id]++
          usedPairs.add(pairKey)
          break
        }
      }

      teamsInPrevSlot.clear()
      teamsInThisSlot.forEach(id => teamsInPrevSlot.add(id))

      if (dayMatches.length >= matchesPerDay) break
    }

    return dayMatches
  }

  const day1Matches = generateDayMatches(1, day1Date, allPairs)
  matches.push(...day1Matches)

  const day2Pairs = allPairs.map(pair => ({
    ...pair,
    score: calculatePairScore(pair.home, pair.away, usedPairs, constraintScores)
  })).sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return Math.random() - 0.5
  })
  const day2Matches = generateDayMatches(2, day2Date, day2Pairs)
  matches.push(...day2Matches)

  // 各チームの試合数を確認
  const matchCountByTeam: Record<number, number> = {}
  matches.forEach(m => {
    matchCountByTeam[m.homeTeamId] = (matchCountByTeam[m.homeTeamId] || 0) + 1
    matchCountByTeam[m.awayTeamId] = (matchCountByTeam[m.awayTeamId] || 0) + 1
  })

  const matchesPerTeam = matchesPerTeamPerDay * 2

  teams.forEach(team => {
    const count = matchCountByTeam[team.id] || 0
    if (count < matchesPerTeam) {
      warnings.push(`${team.name}の試合数が${count}試合です（${matchesPerTeam}試合必要）`)
    }
  })

  const consecutiveWarnings = checkConsecutiveMatchesInSchedule(matches, teams)
  if (consecutiveWarnings.length > 0) {
    warnings.push(...consecutiveWarnings)
  }

  return {
    success: matches.length > 0,
    matches,
    day1Matches,
    day2Matches,
    warnings,
    stats: {
      totalMatches: matches.length,
      matchesPerGroup: matches.length,
      matchesPerTeam,
    },
  }
}

/**
 * 1リーグ制の対戦表を検証（後方互換性）
 */
export function validateSingleLeagueSchedule(_matches: GeneratedMatch[], _teams: TeamInfo[]): string[] {
  return []
}
