// src/lib/scheduleGenerator/constants.ts
/**
 * スケジュール生成で使用する定数
 */

import type { BMatchPattern, ConstraintScores, MatchPatternEntry } from './types'

// ============================================================================
// 浦和カップ対戦パターン
// ============================================================================

// 初日の対戦カード（1-indexed: チーム番号1〜6）
export const DAY1_MATCHES: [number, number][] = [
  [1, 2], // 枠1: 1 vs 2
  [3, 5], // 枠2: 3 vs 5
  [4, 6], // 枠3: 4 vs 6
  [1, 3], // 枠4: 1 vs 3
  [2, 4], // 枠5: 2 vs 4
  [5, 6], // 枠6: 5 vs 6
]

// 二日目の対戦カード
export const DAY2_MATCHES: [number, number][] = [
  [1, 5], // 枠1: 1 vs 5
  [2, 3], // 枠2: 2 vs 3
  [4, 5], // 枠3: 4 vs 5
  [3, 6], // 枠4: 3 vs 6
  [1, 4], // 枠5: 1 vs 4
  [2, 6], // 枠6: 2 vs 6
]

// 対戦しないペア（対角線ペア）
export const NON_MATCHING_PAIRS: [number, number][] = [
  [1, 6], // シード最上位と最下位
  [2, 5], // シード2番目と5番目
  [3, 4], // シード中位同士
]

// ============================================================================
// デフォルト設定
// ============================================================================

export const DEFAULT_START_TIME = '09:00'
export const DEFAULT_MATCH_DURATION = 15 // 試合時間（分）
export const DEFAULT_INTERVAL = 10 // 試合間隔（分）= HT + 入れ替え

// グループ定義
export const GROUPS = ['A', 'B', 'C', 'D']

// 会場とグループの対応
export const GROUP_VENUES: Record<string, string> = {
  'A': '浦和南高G',
  'B': '市立浦和高G',
  'C': '浦和学院高G',
  'D': '武南高G',
}

// デフォルトの制約スコア設定
export const DEFAULT_CONSTRAINT_SCORES: Required<ConstraintScores> = {
  alreadyPlayed: 200,
  sameLeague: 100,
  sameRegion: 50,
  localTeams: 30,
  consecutiveMatch: 20,
}

// ============================================================================
// B戦パターン定義
// ============================================================================

// B戦ペアの定義（チームインデックス 0-3）
export const B_MATCH_PAIR_OPTIONS: Record<BMatchPattern, [number, number][]> = {
  'A': [[0, 1], [2, 3]], // 1vs2 + 3vs4
  'B': [[0, 2], [1, 3]], // 1vs3 + 2vs4
  'C': [[0, 3], [1, 2]], // 1vs4 + 2vs3
}

// A戦ペアのインデックス（パターンB基準）
export const A_MATCH_PAIR_INDICES: [number, number][] = [
  [0, 1], [2, 3], [1, 2], [0, 3]
]

// B戦ペアのインデックス（パターンB基準）
export const B_MATCH_PAIR_INDICES: [number, number][] = [
  [0, 2], [1, 3]
]

// ============================================================================
// 試合パターン生成
// ============================================================================

/**
 * B戦パターンに基づいて試合パターンを生成
 *
 * 制約:
 * - B戦は必ずスロット3と6に配置
 * - 連戦回避を最大限考慮
 */
export function getMatchPattern(bMatchPattern: BMatchPattern): MatchPatternEntry[] {
  const patterns: Record<BMatchPattern, MatchPatternEntry[]> = {
    // パターンA: B戦 = (1vs2)@slot3, (3vs4)@slot6
    'A': [
      { slot: 1, home: 1, away: 3, isBMatch: false },
      { slot: 2, home: 2, away: 4, isBMatch: false },
      { slot: 3, home: 1, away: 2, isBMatch: true },
      { slot: 4, home: 1, away: 4, isBMatch: false },
      { slot: 5, home: 2, away: 3, isBMatch: false },
      { slot: 6, home: 3, away: 4, isBMatch: true },
    ],
    // パターンB: B戦 = (1vs3)@slot3, (2vs4)@slot6 - 元の連戦最小化パターン
    'B': [
      { slot: 1, home: 1, away: 2, isBMatch: false },
      { slot: 2, home: 3, away: 4, isBMatch: false },
      { slot: 3, home: 1, away: 3, isBMatch: true },
      { slot: 4, home: 2, away: 3, isBMatch: false },
      { slot: 5, home: 1, away: 4, isBMatch: false },
      { slot: 6, home: 2, away: 4, isBMatch: true },
    ],
    // パターンC: B戦 = (1vs4)@slot3, (2vs3)@slot6
    'C': [
      { slot: 1, home: 1, away: 2, isBMatch: false },
      { slot: 2, home: 3, away: 4, isBMatch: false },
      { slot: 3, home: 1, away: 4, isBMatch: true },
      { slot: 4, home: 1, away: 3, isBMatch: false },
      { slot: 5, home: 2, away: 4, isBMatch: false },
      { slot: 6, home: 2, away: 3, isBMatch: true },
    ],
  }

  return patterns[bMatchPattern]
}

// デフォルトパターン（後方互換性）
export const FOUR_TEAM_MATCH_PATTERN = getMatchPattern('B')
