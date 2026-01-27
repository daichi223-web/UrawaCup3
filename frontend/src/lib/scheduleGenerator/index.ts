// src/lib/scheduleGenerator/index.ts
/**
 * スケジュール生成モジュール
 *
 * 浦和カップの組み合わせ生成ロジック
 * - 4グループ × 6チーム = 24チーム
 * - 変則総当たり方式（4試合制）
 * - 対角線ペア（1-6, 2-5, 3-4）は対戦しない
 * - 連戦回避 - 各チームは最低1枠の休みを挟む
 * - 会場固定 - 各グループは1番チーム（ホスト校）の会場で全試合実施
 */

// Types
export type {
  TeamInfo,
  GeneratedMatch,
  ScheduleGenerationResult,
  Venue,
  ConstraintScores,
  ScheduleConfig,
  TeamForAssignment,
  PodPlan,
  LexPairScore,
  LexPairScoreWithBMatch,
  VenueAssignmentResult,
  VenueAssignmentInfo,
  GeneratedMatchWithBMatch,
  VenueBasedScheduleResult,
  BMatchPattern,
  MatchPatternEntry,
} from './types'

// Constants
export {
  DAY1_MATCHES,
  DAY2_MATCHES,
  NON_MATCHING_PAIRS,
  DEFAULT_START_TIME,
  DEFAULT_MATCH_DURATION,
  DEFAULT_INTERVAL,
  GROUPS,
  GROUP_VENUES,
  DEFAULT_CONSTRAINT_SCORES,
  B_MATCH_PAIR_OPTIONS,
  A_MATCH_PAIR_INDICES,
  B_MATCH_PAIR_INDICES,
  getMatchPattern,
  FOUR_TEAM_MATCH_PATTERN,
} from './constants'

// Utils
export {
  generateKickoffTimes,
} from './utils/kickoff'

export {
  getTeamSeedNumber,
  getTeamsByGroup,
} from './utils/team'

export {
  getVenueForGroup,
  getRefereeTeams,
} from './utils/venue'

export {
  makePairKey,
  calculatePairScore,
  calculatePairConflict,
  extractDay1AMatchPairs,
  extractDay1BMatchPairs,
  extractAMatchPairsFromAssignments,
  extractBMatchPairsFromAssignments,
} from './utils/pairs'

// Scoring
export {
  encodeLexToScore,
  encodeLexToScoreWithBMatch,
  evaluatePairLex,
  evaluateAssignmentLex,
  evaluateVenueLexScore,
} from './scoring/lexicographic'

// Assignment
export {
  computePodPlanOrThrow,
  getPodSizes,
} from './assignment/pod-plan'

export {
  buildAssignmentsGreedyWithHosts,
  greedyAssignment,
  randomInitialAssignment,
  randomInitialAssignmentWithHosts,
} from './assignment/greedy'

export {
  generatePermutations,
  cloneAssignments,
  buildDay1OpponentsMap,
} from './assignment/helpers'

export {
  evaluateAssignment,
  evaluateVenueScore,
  optimizeIntraVenueSlots,
  optimizeIntraVenueSlotsLex,
  optimizeBySwap,
  optimizeBySwapLex,
} from './assignment/optimization'

export {
  generateOptimalVenueAssignment,
  convertToVenueAssignmentInfos,
} from './assignment/optimal'

// Schedule generation
export {
  generateUrawaCupSchedule,
} from './schedule/urawa-cup'

export {
  generateSingleLeagueSchedule,
  validateSingleLeagueSchedule,
} from './schedule/single-league'

export {
  generateVenueBasedSchedule,
} from './schedule/venue-based'

export {
  validateSchedule,
  checkConsecutiveMatches,
} from './schedule/validation'
