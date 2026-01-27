// src/lib/scheduleGenerator/schedule/validation.ts
/**
 * 対戦表の検証機能
 */

import type { TeamInfo, GeneratedMatch } from '../types'
import { GROUPS, NON_MATCHING_PAIRS } from '../constants'

/**
 * 対戦表を検証
 */
export function validateSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  const errors: string[] = []

  const matchCountByTeam: Record<number, number> = {}
  const opponentsByTeam: Record<number, Set<number>> = {}

  for (const match of matches) {
    matchCountByTeam[match.homeTeamId] = (matchCountByTeam[match.homeTeamId] || 0) + 1
    if (!opponentsByTeam[match.homeTeamId]) opponentsByTeam[match.homeTeamId] = new Set()
    opponentsByTeam[match.homeTeamId].add(match.awayTeamId)

    matchCountByTeam[match.awayTeamId] = (matchCountByTeam[match.awayTeamId] || 0) + 1
    if (!opponentsByTeam[match.awayTeamId]) opponentsByTeam[match.awayTeamId] = new Set()
    opponentsByTeam[match.awayTeamId].add(match.homeTeamId)
  }

  // 各チームが4試合であることを確認
  for (const team of teams) {
    const count = matchCountByTeam[team.id] || 0
    if (count !== 4) {
      errors.push(`${team.name}の試合数が${count}です（4試合必要）`)
    }
  }

  // 対角線ペアが対戦していないことを確認
  for (const [seed1, seed2] of NON_MATCHING_PAIRS) {
    for (const groupId of GROUPS) {
      const groupTeams = teams.filter(t => t.groupId === groupId)
      const team1 = groupTeams.find(t => t.seedNumber === seed1)
      const team2 = groupTeams.find(t => t.seedNumber === seed2)

      if (team1 && team2) {
        if (opponentsByTeam[team1.id]?.has(team2.id)) {
          errors.push(`グループ${groupId}: シード${seed1}とシード${seed2}が対戦しています（対角線ペア）`)
        }
      }
    }
  }

  return errors
}

/**
 * 連戦チェック（同日に連続する枠で試合がないか）
 */
export function checkConsecutiveMatches(matches: GeneratedMatch[]): string[] {
  const warnings: string[] = []

  for (const groupId of GROUPS) {
    for (const day of [1, 2] as const) {
      const dayMatches = matches
        .filter(m => m.groupId === groupId && m.day === day)
        .sort((a, b) => a.slot - b.slot)

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
            const team = matches.find(m => m.homeTeamId === Number(teamId) || m.awayTeamId === Number(teamId))
            const teamName = team?.homeTeamId === Number(teamId) ? team.homeTeamName : team?.awayTeamName
            warnings.push(`グループ${groupId} Day${day}: ${teamName}が枠${slots[i]}と${slots[i + 1]}で連戦`)
          }
        }
      }
    }
  }

  return warnings
}
