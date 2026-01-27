// src/lib/scheduleGenerator/assignment/optimization.ts
/**
 * 会場配置の最適化アルゴリズム
 */

import type { TeamForAssignment, ConstraintScores, VenueAssignmentResult } from '../types'
import { A_MATCH_PAIR_INDICES, B_MATCH_PAIR_INDICES } from '../constants'
import { calculatePairConflict } from '../utils/pairs'
import {
  encodeLexToScoreWithBMatch,
  evaluateAssignmentLex,
  evaluateVenueLexScore,
} from '../scoring/lexicographic'
import { generatePermutations } from './helpers'

// ============================================================================
// 会場スコア評価
// ============================================================================

/**
 * 会場配置のトータルスコアと詳細を計算
 */
export function evaluateAssignment(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): { score: number; details: VenueAssignmentResult['details'] } {
  let totalScore = 0
  const details: VenueAssignmentResult['details'] = {
    sameLeaguePairs: 0,
    sameRegionPairs: 0,
    localVsLocalPairs: 0,
    day1RepeatPairs: 0,
    bMatchSameLeaguePairs: 0,
    bMatchSameRegionPairs: 0,
    bMatchLocalVsLocalPairs: 0,
  }

  const bMatchWeight = 0.1

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    // A戦ペアを評価
    for (const [i, j] of A_MATCH_PAIR_INDICES) {
      const conflict = calculatePairConflict(teams[i], teams[j], scores)
      totalScore += conflict.score
      if (conflict.sameLeague) details.sameLeaguePairs++
      if (conflict.sameRegion) details.sameRegionPairs++
      if (conflict.localVsLocal) details.localVsLocalPairs++

      if (day1Opponents) {
        const team1Opponents = day1Opponents.get(teams[i].id)
        if (team1Opponents?.has(teams[j].id)) {
          totalScore += scores.alreadyPlayed || 200
          details.day1RepeatPairs++
        }
      }
    }

    // B戦ペアを評価（低ウェイト）
    for (const [i, j] of B_MATCH_PAIR_INDICES) {
      const conflict = calculatePairConflict(teams[i], teams[j], scores)
      totalScore += conflict.score * bMatchWeight

      if (conflict.sameLeague) details.bMatchSameLeaguePairs = (details.bMatchSameLeaguePairs || 0) + 1
      if (conflict.sameRegion) details.bMatchSameRegionPairs = (details.bMatchSameRegionPairs || 0) + 1
      if (conflict.localVsLocal) details.bMatchLocalVsLocalPairs = (details.bMatchLocalVsLocalPairs || 0) + 1

      if (day1Opponents) {
        const team1Opponents = day1Opponents.get(teams[i].id)
        if (team1Opponents?.has(teams[j].id)) {
          totalScore += (scores.alreadyPlayed || 200) * bMatchWeight
        }
      }
    }
  }

  return { score: totalScore, details }
}

/**
 * 会場内のスコアを計算（特定の順序で）
 */
export function evaluateVenueScore(
  teams: TeamForAssignment[],
  order: number[],
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): number {
  let score = 0
  const bMatchWeight = 0.1

  // A戦の制約スコア
  for (const [i, j] of A_MATCH_PAIR_INDICES) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]

    score += calculatePairConflict(team1, team2, scores).score

    if (day1Opponents) {
      const team1Opponents = day1Opponents.get(team1.id)
      if (team1Opponents?.has(team2.id)) {
        score += scores.alreadyPlayed || 200
      }
    }
  }

  // B戦の制約スコア（低ウェイト）
  for (const [i, j] of B_MATCH_PAIR_INDICES) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]

    score += calculatePairConflict(team1, team2, scores).score * bMatchWeight

    if (day1Opponents) {
      const team1Opponents = day1Opponents.get(team1.id)
      if (team1Opponents?.has(team2.id)) {
        score += (scores.alreadyPlayed || 200) * bMatchWeight
      }
    }
  }

  return score
}

// ============================================================================
// 会場内スロット最適化
// ============================================================================

/**
 * 同一会場内でのスロット入れ替えによる最適化
 */
export function optimizeIntraVenueSlots(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): Map<number, TeamForAssignment[]> {
  for (const [venueId, teams] of assignments) {
    if (teams.length !== 4) continue

    const permutations = generatePermutations([0, 1, 2, 3])
    let bestOrder = [0, 1, 2, 3]
    let bestScore = evaluateVenueScore(teams, bestOrder, scores, day1Opponents)

    for (const perm of permutations) {
      const score = evaluateVenueScore(teams, perm, scores, day1Opponents)
      if (score < bestScore) {
        bestScore = score
        bestOrder = perm
      }
    }

    if (bestOrder.join(',') !== '0,1,2,3') {
      const reordered = bestOrder.map(i => teams[i])
      assignments.set(venueId, reordered)
    }
  }

  return assignments
}

/**
 * 会場内スロット最適化（辞書式スコア）
 */
export function optimizeIntraVenueSlotsLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>,
  debug: boolean = false
): void {
  for (const [venueId, teams] of assignments) {
    if (teams.length !== 4) continue

    const permutations = generatePermutations([0, 1, 2, 3])
    let bestOrder = [0, 1, 2, 3]
    let bestScore = evaluateVenueLexScore(teams, bestOrder, bannedAMatchPairs, bannedBMatchPairs)

    const localTeamIndices = teams.map((t, i) => t.teamType === 'local' ? i : -1).filter(i => i >= 0)

    for (const perm of permutations) {
      const score = evaluateVenueLexScore(teams, perm, bannedAMatchPairs, bannedBMatchPairs)
      if (score < bestScore) {
        bestScore = score
        bestOrder = perm
      }
    }

    if (debug && localTeamIndices.length >= 2) {
      const bMatchPairs = [[0, 2], [1, 3]]
      const reorderedTeams = bestOrder.map(i => teams[i])
      const bMatchLocalVsLocal = bMatchPairs.filter(([i, j]) =>
        reorderedTeams[i].teamType === 'local' && reorderedTeams[j].teamType === 'local'
      ).length
      console.log(`[IntraVenue] 会場${venueId}: 地元チーム=${localTeamIndices.length}個, 選択順序=[${bestOrder}], B戦地元同士=${bMatchLocalVsLocal}`)
    }

    if (bestOrder.join(',') !== '0,1,2,3') {
      const reordered = bestOrder.map(i => teams[i])
      assignments.set(venueId, reordered)
    }
  }
}

// ============================================================================
// 会場間スワップ最適化
// ============================================================================

/**
 * 局所最適化（会場間スワップによる改善）
 */
export function optimizeBySwap(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>,
  maxIterations: number = 50
): Map<number, TeamForAssignment[]> {
  const venueIds = Array.from(assignments.keys())
  let improved = true
  let iterations = 0

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    optimizeIntraVenueSlots(assignments, scores, day1Opponents)

    for (let v1 = 0; v1 < venueIds.length; v1++) {
      for (let v2 = v1 + 1; v2 < venueIds.length; v2++) {
        const venue1Teams = assignments.get(venueIds[v1])!
        const venue2Teams = assignments.get(venueIds[v2])!

        for (let t1 = 0; t1 < venue1Teams.length; t1++) {
          for (let t2 = 0; t2 < venue2Teams.length; t2++) {
            const currentScore = evaluateAssignment(assignments, scores, day1Opponents).score

            const temp = venue1Teams[t1]
            venue1Teams[t1] = venue2Teams[t2]
            venue2Teams[t2] = temp

            optimizeIntraVenueSlots(assignments, scores, day1Opponents)

            const newScore = evaluateAssignment(assignments, scores, day1Opponents).score

            if (newScore < currentScore) {
              improved = true
            } else {
              venue2Teams[t2] = venue1Teams[t1]
              venue1Teams[t1] = temp
              optimizeIntraVenueSlots(assignments, scores, day1Opponents)
            }
          }
        }
      }
    }
  }

  return assignments
}

/**
 * 会場間スワップ最適化（辞書式スコア）
 */
export function optimizeBySwapLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>,
  maxIterations: number = 50
): Map<number, TeamForAssignment[]> {
  const venueIds = Array.from(assignments.keys())
  let improved = true
  let iterations = 0

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    optimizeIntraVenueSlotsLex(assignments, bannedAMatchPairs, bannedBMatchPairs)

    for (let v1 = 0; v1 < venueIds.length; v1++) {
      for (let v2 = v1 + 1; v2 < venueIds.length; v2++) {
        let venue1Teams = assignments.get(venueIds[v1])!
        let venue2Teams = assignments.get(venueIds[v2])!

        for (let t1 = 0; t1 < venue1Teams.length; t1++) {
          if (venue1Teams[t1].isHost && venue1Teams[t1].hostVenueId === venueIds[v1]) continue

          for (let t2 = 0; t2 < venue2Teams.length; t2++) {
            if (venue2Teams[t2].isHost && venue2Teams[t2].hostVenueId === venueIds[v2]) continue

            const currentScore = encodeLexToScoreWithBMatch(
              evaluateAssignmentLex(assignments, bannedAMatchPairs, bannedBMatchPairs)
            )

            const venue1Before = [...venue1Teams]
            const venue2Before = [...venue2Teams]

            const temp = venue1Teams[t1]
            venue1Teams[t1] = venue2Teams[t2]
            venue2Teams[t2] = temp

            optimizeIntraVenueSlotsLex(assignments, bannedAMatchPairs, bannedBMatchPairs)

            venue1Teams = assignments.get(venueIds[v1])!
            venue2Teams = assignments.get(venueIds[v2])!

            const newScore = encodeLexToScoreWithBMatch(
              evaluateAssignmentLex(assignments, bannedAMatchPairs, bannedBMatchPairs)
            )

            if (newScore < currentScore) {
              improved = true
            } else {
              assignments.set(venueIds[v1], venue1Before)
              assignments.set(venueIds[v2], venue2Before)
              venue1Teams = venue1Before
              venue2Teams = venue2Before
            }
          }
        }
      }
    }
  }

  return assignments
}
