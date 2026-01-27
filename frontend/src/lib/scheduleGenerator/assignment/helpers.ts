// src/lib/scheduleGenerator/assignment/helpers.ts
/**
 * 配置関連のヘルパー関数
 */

import type { TeamForAssignment } from '../types'

/**
 * 配列の全順列を生成
 */
export function generatePermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]

  const result: number[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    const perms = generatePermutations(rest)
    for (const perm of perms) {
      result.push([arr[i], ...perm])
    }
  }
  return result
}

/**
 * Deep copy of assignments
 */
export function cloneAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Map<number, TeamForAssignment[]> {
  const clone = new Map<number, TeamForAssignment[]>()
  for (const [venueId, teams] of assignments) {
    clone.set(venueId, [...teams])
  }
  return clone
}

/**
 * Day1のA戦対戦相手マップを構築
 * B戦は対戦済みとしてカウントしない
 */
export function buildDay1OpponentsMap(
  day1Assignments: Map<number, TeamForAssignment[]>
): Map<number, Set<number>> {
  const opponents = new Map<number, Set<number>>()

  // A戦の対戦ペア（スロット順での位置: 1vs2, 3vs4, 2vs3, 1vs4）
  const aMatchPairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [1, 2],
    [0, 3],
  ]

  for (const [, teams] of day1Assignments) {
    if (teams.length < 4) continue

    for (const [idx1, idx2] of aMatchPairs) {
      const team1 = teams[idx1]
      const team2 = teams[idx2]

      if (!opponents.has(team1.id)) {
        opponents.set(team1.id, new Set())
      }
      if (!opponents.has(team2.id)) {
        opponents.set(team2.id, new Set())
      }

      opponents.get(team1.id)!.add(team2.id)
      opponents.get(team2.id)!.add(team1.id)
    }
  }

  return opponents
}
