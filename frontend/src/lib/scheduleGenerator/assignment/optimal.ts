// src/lib/scheduleGenerator/assignment/optimal.ts
/**
 * 制約を考慮した最適な会場配置を生成（Anchor-Pod CP アルゴリズム）
 */

import type {
  TeamForAssignment,
  ConstraintScores,
  VenueAssignmentResult,
  VenueAssignmentInfo,
  LexPairScoreWithBMatch,
} from '../types'
import { DEFAULT_CONSTRAINT_SCORES } from '../constants'
import {
  extractAMatchPairsFromAssignments,
  extractBMatchPairsFromAssignments,
} from '../utils/pairs'
import { evaluateAssignmentLex, encodeLexToScore } from '../scoring/lexicographic'
import { computePodPlanOrThrow, getPodSizes } from './pod-plan'
import { buildAssignmentsGreedyWithHosts, randomInitialAssignmentWithHosts } from './greedy'
import { cloneAssignments } from './helpers'
import { optimizeIntraVenueSlotsLex, optimizeBySwapLex } from './optimization'

/**
 * 制約を考慮した最適な会場配置を生成
 *
 * 新アルゴリズム:
 * - ホストチームは自会場にアンカー（移動しない）
 * - PodPlan で各会場のチーム数を決定（3/4/5チーム）
 * - 辞書式評価: Day1再戦 > 同リーグ > 同地域 > 地元同士
 * - Multi-start + 局所スワップで最適化
 */
export function generateOptimalVenueAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number = 4,
  _scores: ConstraintScores = DEFAULT_CONSTRAINT_SCORES,
  day1Assignments?: Map<number, TeamForAssignment[]>,
  numRestarts: number = 5,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>
): VenueAssignmentResult {
  console.log('[VenueOptimization] Starting Anchor-Pod CP with', teams.length, 'teams,', venueIds.length, 'venues')

  // Day1 Assignments がある場合は、そこから bannedPairs を生成
  let effectiveBannedAMatchPairs = bannedAMatchPairs
  let effectiveBannedBMatchPairs = bannedBMatchPairs
  if (!effectiveBannedAMatchPairs && day1Assignments) {
    effectiveBannedAMatchPairs = extractAMatchPairsFromAssignments(day1Assignments)
    console.log('[VenueOptimization] Extracted', effectiveBannedAMatchPairs.size, 'banned A-match pairs from Day1')
  }
  if (!effectiveBannedBMatchPairs && day1Assignments) {
    effectiveBannedBMatchPairs = extractBMatchPairsFromAssignments(day1Assignments)
    console.log('[VenueOptimization] Extracted', effectiveBannedBMatchPairs.size, 'banned B-match pairs from Day1')
  }

  // PodPlan計算を試みる
  let podSizes: number[]
  try {
    const plan = computePodPlanOrThrow(teams.length, venueIds.length)
    podSizes = getPodSizes(plan)
    console.log('[VenueOptimization] PodPlan:', plan, '-> sizes:', podSizes)
  } catch (e) {
    podSizes = venueIds.map(() => teamsPerVenue)
    console.log('[VenueOptimization] PodPlan failed, using uniform size:', teamsPerVenue)
  }

  let bestAssignment: Map<number, TeamForAssignment[]> | null = null
  let bestLexScore: LexPairScoreWithBMatch | null = null
  let bestEncodedScore = Infinity

  for (let restart = 0; restart < numRestarts; restart++) {
    let assignment: Map<number, TeamForAssignment[]>

    if (restart === 0) {
      assignment = buildAssignmentsGreedyWithHosts(teams, venueIds, podSizes, effectiveBannedAMatchPairs)
    } else {
      assignment = randomInitialAssignmentWithHosts(teams, venueIds, podSizes)
    }

    optimizeIntraVenueSlotsLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)
    assignment = optimizeBySwapLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)

    const lexScore = evaluateAssignmentLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)
    const encodedScore = encodeLexToScore(lexScore)

    if (encodedScore < bestEncodedScore) {
      bestEncodedScore = encodedScore
      bestAssignment = cloneAssignments(assignment)
      bestLexScore = lexScore
    }

    if (lexScore.day1Repeat === 0 && lexScore.sameLeague === 0) {
      console.log('[VenueOptimization] Found good solution at restart', restart)
      break
    }
  }

  console.log('[VenueOptimization] Best lex score:', bestLexScore, 'encoded:', bestEncodedScore)
  if (bestLexScore) {
    console.log('[VenueOptimization] A戦制約: 同リーグ=', bestLexScore.sameLeague, '同地域=', bestLexScore.sameRegion, '地元同士=', bestLexScore.localVsLocal, 'Day1再戦=', bestLexScore.day1Repeat)
    console.log('[VenueOptimization] B戦制約: 同リーグ=', bestLexScore.bMatchSameLeague, '同地域=', bestLexScore.bMatchSameRegion, '地元同士=', bestLexScore.bMatchLocalVsLocal)
  }

  // デバッグ出力
  if (bestAssignment) {
    const bMatchPairs = [[0, 2], [1, 3]]
    for (const [venueId, venueTeams] of bestAssignment) {
      const teamInfo = venueTeams.map(t => `${t.id}:${t.shortName || t.name}${t.teamType === 'local' ? '(地)' : ''}`).join(', ')
      const bMatchConflicts = bMatchPairs.map(([i, j]) => {
        const isLocalVsLocal = venueTeams[i]?.teamType === 'local' && venueTeams[j]?.teamType === 'local'
        return isLocalVsLocal ? `${venueTeams[i].shortName || venueTeams[i].name}vs${venueTeams[j].shortName || venueTeams[j].name}(地)` : null
      }).filter(Boolean)
      if (bMatchConflicts.length > 0) {
        console.log(`[VenueOptimization] 会場${venueId}: [${teamInfo}] ⚠B戦地元: ${bMatchConflicts.join(', ')}`)
      } else {
        console.log(`[VenueOptimization] 会場${venueId}: [${teamInfo}]`)
      }
    }
  }

  const details: VenueAssignmentResult['details'] = {
    sameLeaguePairs: bestLexScore?.sameLeague || 0,
    sameRegionPairs: bestLexScore?.sameRegion || 0,
    localVsLocalPairs: bestLexScore?.localVsLocal || 0,
    day1RepeatPairs: bestLexScore?.day1Repeat || 0,
    bMatchSameLeaguePairs: bestLexScore?.bMatchSameLeague || 0,
    bMatchSameRegionPairs: bestLexScore?.bMatchSameRegion || 0,
    bMatchLocalVsLocalPairs: bestLexScore?.bMatchLocalVsLocal || 0,
  }

  return {
    assignments: bestAssignment!,
    score: bestEncodedScore,
    details,
  }
}

/**
 * Map形式の配置をVenueAssignmentInfo配列に変換
 */
export function convertToVenueAssignmentInfos(
  assignments: Map<number, TeamForAssignment[]>,
  venueNames: Map<number, string>,
  matchDay: number
): VenueAssignmentInfo[] {
  const result: VenueAssignmentInfo[] = []

  for (const [venueId, teams] of assignments) {
    teams.forEach((team, index) => {
      result.push({
        venueId,
        venueName: venueNames.get(venueId) || `会場${venueId}`,
        teamId: team.id,
        teamName: team.name,
        teamShortName: team.shortName,
        teamType: team.teamType,
        matchDay,
        slotOrder: index + 1,
      })
    })
  }

  return result
}
