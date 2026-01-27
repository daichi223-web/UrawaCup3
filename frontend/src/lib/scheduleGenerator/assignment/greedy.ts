// src/lib/scheduleGenerator/assignment/greedy.ts
/**
 * 貪欲法による会場配置
 */

import type { TeamForAssignment, ConstraintScores } from '../types'
import { calculatePairConflict } from '../utils/pairs'
import { evaluatePairLex, encodeLexToScore } from '../scoring/lexicographic'

/**
 * ホストチームをアンカーとして配置し、残りを貪欲に配置
 */
export function buildAssignmentsGreedyWithHosts(
  teams: TeamForAssignment[],
  venueIds: number[],
  podSizes: number[],
  bannedPairs?: Set<string>
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()

  // 会場ごとに初期化
  venueIds.forEach((id) => {
    assignments.set(id, [])
  })

  // 配置済みチームを追跡
  const placedTeamIds = new Set<number>()

  // ホストチームを先に配置
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const hostTeam = teams.find(t => t.isHost && t.hostVenueId === venueId)

    if (hostTeam && !placedTeamIds.has(hostTeam.id)) {
      assignments.get(venueId)!.push(hostTeam)
      placedTeamIds.add(hostTeam.id)
    }
  }

  console.log(`[Greedy] ホスト配置完了: ${placedTeamIds.size}チーム, 残り: ${teams.length - placedTeamIds.size}チーム`)

  // 会場ごとに残りの枠を埋める
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const venueTeams = assignments.get(venueId)!
    const targetSize = podSizes[idx] || 4

    while (venueTeams.length < targetSize) {
      let bestTeam: TeamForAssignment | null = null
      let bestScore = Infinity

      for (const candidate of teams) {
        if (placedTeamIds.has(candidate.id)) continue

        let score = 0
        for (const existingTeam of venueTeams) {
          const pairLex = evaluatePairLex(candidate, existingTeam, bannedPairs)
          score += encodeLexToScore(pairLex)
        }

        if (score < bestScore) {
          bestScore = score
          bestTeam = candidate
        }
      }

      if (!bestTeam) {
        console.error(`[Greedy] 会場${venueId}: 配置可能なチームがありません (現在${venueTeams.length}/${targetSize})`)
        break
      }

      venueTeams.push(bestTeam)
      placedTeamIds.add(bestTeam.id)
    }
  }

  console.log(`[Greedy] 配置完了: 合計${placedTeamIds.size}チーム配置`)

  return assignments
}

/**
 * 貪欲法による初期配置生成
 */
export function greedyAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()
  venueIds.forEach(id => assignments.set(id, []))

  const remainingTeams = [...teams]

  for (const venueId of venueIds) {
    const venueTeams = assignments.get(venueId)!

    while (venueTeams.length < teamsPerVenue && remainingTeams.length > 0) {
      let bestTeamIndex = 0
      let bestScore = Infinity

      for (let i = 0; i < remainingTeams.length; i++) {
        const candidate = remainingTeams[i]
        let score = 0

        for (const existingTeam of venueTeams) {
          score += calculatePairConflict(candidate, existingTeam, scores).score

          if (day1Opponents) {
            const candidateOpponents = day1Opponents.get(candidate.id)
            if (candidateOpponents?.has(existingTeam.id)) {
              score += scores.alreadyPlayed || 200
            }
          }
        }

        if (score < bestScore) {
          bestScore = score
          bestTeamIndex = i
        }
      }

      venueTeams.push(remainingTeams[bestTeamIndex])
      remainingTeams.splice(bestTeamIndex, 1)
    }
  }

  return assignments
}

/**
 * ランダムな初期配置を生成
 */
export function randomInitialAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number
): Map<number, TeamForAssignment[]> {
  const shuffled = [...teams].sort(() => Math.random() - 0.5)
  const assignments = new Map<number, TeamForAssignment[]>()

  let teamIndex = 0
  for (const venueId of venueIds) {
    const venueTeams: TeamForAssignment[] = []
    for (let i = 0; i < teamsPerVenue && teamIndex < shuffled.length; i++) {
      venueTeams.push(shuffled[teamIndex++])
    }
    assignments.set(venueId, venueTeams)
  }

  return assignments
}

/**
 * ホストを維持したランダム初期配置
 */
export function randomInitialAssignmentWithHosts(
  teams: TeamForAssignment[],
  venueIds: number[],
  podSizes: number[]
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()
  venueIds.forEach(id => assignments.set(id, []))

  const placedTeamIds = new Set<number>()

  // ホストチームを先に配置
  for (const venueId of venueIds) {
    const hostTeam = teams.find(t => t.isHost && t.hostVenueId === venueId)
    if (hostTeam && !placedTeamIds.has(hostTeam.id)) {
      assignments.get(venueId)!.push(hostTeam)
      placedTeamIds.add(hostTeam.id)
    }
  }

  // 残りのチームをシャッフル
  const remainingTeams = teams.filter(t => !placedTeamIds.has(t.id))
  const shuffled = [...remainingTeams].sort(() => Math.random() - 0.5)

  // 会場ごとに残りの枠を埋める
  let teamIndex = 0
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const venueTeams = assignments.get(venueId)!
    const targetSize = podSizes[idx] || 4

    while (venueTeams.length < targetSize && teamIndex < shuffled.length) {
      const team = shuffled[teamIndex++]
      if (!placedTeamIds.has(team.id)) {
        venueTeams.push(team)
        placedTeamIds.add(team.id)
      }
    }
  }

  return assignments
}
