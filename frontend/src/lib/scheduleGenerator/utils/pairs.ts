// src/lib/scheduleGenerator/utils/pairs.ts
/**
 * 対戦ペア関連のユーティリティ
 */

import type {
  TeamInfo,
  TeamForAssignment,
  ConstraintScores,
  GeneratedMatchWithBMatch
} from '../types'
import { A_MATCH_PAIR_INDICES, B_MATCH_PAIR_INDICES } from '../constants'

/**
 * ペアキーを生成（小さいID-大きいID）
 */
export function makePairKey(id1: number, id2: number): string {
  return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`
}

/**
 * 対戦ペアの優先度スコアを計算（低いほど優先）
 */
export function calculatePairScore(
  teamA: TeamInfo,
  teamB: TeamInfo,
  usedPairs: Set<string>,
  scores: ConstraintScores
): number {
  let score = 0
  const pairKey = makePairKey(teamA.id, teamB.id)

  // 対戦済み
  if (usedPairs.has(pairKey)) {
    score += scores.alreadyPlayed || 200
  }

  // 同リーグ
  if (teamA.leagueId && teamB.leagueId && teamA.leagueId === teamB.leagueId) {
    score += scores.sameLeague || 100
  }

  // 同地域
  if (teamA.region && teamB.region && teamA.region === teamB.region) {
    score += scores.sameRegion || 50
  }

  // 地元同士
  if (teamA.teamType === 'local' && teamB.teamType === 'local') {
    score += scores.localTeams || 30
  }

  return score
}

/**
 * 2チーム間のコンフリクトスコアを計算
 */
export function calculatePairConflict(
  team1: TeamForAssignment,
  team2: TeamForAssignment,
  scores: ConstraintScores
): { score: number; sameLeague: boolean; sameRegion: boolean; localVsLocal: boolean } {
  let score = 0
  let sameLeague = false
  let sameRegion = false
  let localVsLocal = false

  // 同リーグチェック
  if (team1.leagueId && team2.leagueId && team1.leagueId === team2.leagueId) {
    score += scores.sameLeague || 100
    sameLeague = true
  }

  // 同地域チェック
  if (team1.region && team2.region && team1.region === team2.region) {
    score += scores.sameRegion || 50
    sameRegion = true
  }

  // 地元同士チェック
  if (team1.teamType === 'local' && team2.teamType === 'local') {
    score += scores.localTeams || 30
    localVsLocal = true
  }

  return { score, sameLeague, sameRegion, localVsLocal }
}

/**
 * GeneratedMatchWithBMatchからDay1のA戦ペアを抽出
 */
export function extractDay1AMatchPairs(
  matches: GeneratedMatchWithBMatch[]
): Set<string> {
  const pairs = new Set<string>()

  for (const m of matches) {
    if (m.day === 1 && !m.isBMatch) {
      pairs.add(makePairKey(m.homeTeamId, m.awayTeamId))
    }
  }

  return pairs
}

/**
 * GeneratedMatchWithBMatchからDay1のB戦ペアを抽出
 */
export function extractDay1BMatchPairs(
  matches: GeneratedMatchWithBMatch[]
): Set<string> {
  const pairs = new Set<string>()

  for (const m of matches) {
    if (m.day === 1 && m.isBMatch) {
      pairs.add(makePairKey(m.homeTeamId, m.awayTeamId))
    }
  }

  return pairs
}

/**
 * 会場配置MapからA戦ペアを抽出
 */
export function extractAMatchPairsFromAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Set<string> {
  const pairs = new Set<string>()

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    for (const [idx1, idx2] of A_MATCH_PAIR_INDICES) {
      if (idx1 < teams.length && idx2 < teams.length) {
        pairs.add(makePairKey(teams[idx1].id, teams[idx2].id))
      }
    }
  }

  return pairs
}

/**
 * 会場配置MapからB戦ペアを抽出
 */
export function extractBMatchPairsFromAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Set<string> {
  const pairs = new Set<string>()

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    for (const [idx1, idx2] of B_MATCH_PAIR_INDICES) {
      if (idx1 < teams.length && idx2 < teams.length) {
        pairs.add(makePairKey(teams[idx1].id, teams[idx2].id))
      }
    }
  }

  return pairs
}
