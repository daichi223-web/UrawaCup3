// src/lib/scheduleGenerator/scoring/lexicographic.ts
/**
 * 辞書式スコアリング（Lexicographic Scoring）
 * 優先順位: sameLeague > sameRegion > localVsLocal
 */

import type { TeamForAssignment, LexPairScore, LexPairScoreWithBMatch } from '../types'
import { A_MATCH_PAIR_INDICES, B_MATCH_PAIR_INDICES } from '../constants'
import { makePairKey } from '../utils/pairs'

/**
 * 辞書式スコアを単一の数値にエンコード
 * 上位ビットほど優先度が高い
 *
 * エンコード方式: day1Repeat * 10^9 + sameLeague * 10^6 + sameRegion * 10^3 + localVsLocal
 */
export function encodeLexToScore(lex: LexPairScore): number {
  return (
    lex.day1Repeat * 1_000_000_000 +
    lex.sameLeague * 1_000_000 +
    lex.sameRegion * 1_000 +
    lex.localVsLocal
  )
}

/**
 * A戦 + B戦を含む辞書式スコアをエンコード
 * B戦はA戦より低い優先度（小数点以下）でタイブレーカーとして使用
 */
export function encodeLexToScoreWithBMatch(lex: LexPairScoreWithBMatch): number {
  // A戦部分（整数）
  const aMatchScore = (
    lex.day1Repeat * 1_000_000_000 +
    lex.sameLeague * 1_000_000 +
    lex.sameRegion * 1_000 +
    lex.localVsLocal
  )
  // B戦部分（小数点以下 = A戦優先のタイブレーカー）
  const bMatchScore = (
    lex.bMatchSameLeague * 0.0001 +
    lex.bMatchSameRegion * 0.00001 +
    lex.bMatchLocalVsLocal * 0.000001
  )
  return aMatchScore + bMatchScore
}

/**
 * 2チーム間の辞書式制約を評価
 */
export function evaluatePairLex(
  team1: TeamForAssignment,
  team2: TeamForAssignment,
  bannedPairs?: Set<string>
): LexPairScore {
  const result: LexPairScore = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
  }

  // Day1再戦チェック（ハード制約）
  if (bannedPairs) {
    const pairKey = makePairKey(team1.id, team2.id)
    if (bannedPairs.has(pairKey)) {
      result.day1Repeat = 1
    }
  }

  // 同リーグチェック
  if (team1.leagueId && team2.leagueId && team1.leagueId === team2.leagueId) {
    result.sameLeague = 1
  }

  // 同地域チェック
  if (team1.region && team2.region && team1.region === team2.region) {
    result.sameRegion = 1
  }

  // 地元同士チェック
  if (team1.teamType === 'local' && team2.teamType === 'local') {
    result.localVsLocal = 1
  }

  return result
}

/**
 * 会場配置の辞書式スコアを計算
 */
export function evaluateAssignmentLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>
): LexPairScoreWithBMatch {
  const total: LexPairScoreWithBMatch = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
    bMatchSameLeague: 0,
    bMatchSameRegion: 0,
    bMatchLocalVsLocal: 0,
  }

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    // A戦評価（bannedAMatchPairs を使用）
    for (const [i, j] of A_MATCH_PAIR_INDICES) {
      if (i < teams.length && j < teams.length) {
        const pairLex = evaluatePairLex(teams[i], teams[j], bannedAMatchPairs)
        total.sameLeague += pairLex.sameLeague
        total.sameRegion += pairLex.sameRegion
        total.localVsLocal += pairLex.localVsLocal
        total.day1Repeat += pairLex.day1Repeat
      }
    }

    // B戦評価（bannedBMatchPairs を使用）
    for (const [i, j] of B_MATCH_PAIR_INDICES) {
      if (i < teams.length && j < teams.length) {
        const pairLex = evaluatePairLex(teams[i], teams[j], bannedBMatchPairs)
        total.bMatchSameLeague += pairLex.sameLeague
        total.bMatchSameRegion += pairLex.sameRegion
        total.bMatchLocalVsLocal += pairLex.localVsLocal
        total.day1Repeat += pairLex.day1Repeat
      }
    }
  }

  return total
}

/**
 * 会場内の辞書式スコアを計算（特定の順序で）
 */
export function evaluateVenueLexScore(
  teams: TeamForAssignment[],
  order: number[],
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>
): number {
  const total: LexPairScore = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
  }

  // A戦の制約（フルウェイト、A戦禁止ペアでday1Repeatチェック）
  for (const [i, j] of A_MATCH_PAIR_INDICES) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]
    const pairLex = evaluatePairLex(team1, team2, bannedAMatchPairs)
    total.sameLeague += pairLex.sameLeague
    total.sameRegion += pairLex.sameRegion
    total.localVsLocal += pairLex.localVsLocal
    total.day1Repeat += pairLex.day1Repeat
  }

  // B戦の制約（0.001倍 = タイブレーカーとして使用）
  for (const [i, j] of B_MATCH_PAIR_INDICES) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]
    const pairLex = evaluatePairLex(team1, team2, bannedBMatchPairs)
    total.localVsLocal += pairLex.localVsLocal * 0.001
    total.sameRegion += pairLex.sameRegion * 0.001
    total.sameLeague += pairLex.sameLeague * 0.001
    total.day1Repeat += pairLex.day1Repeat * 0.001
  }

  return encodeLexToScore(total)
}
