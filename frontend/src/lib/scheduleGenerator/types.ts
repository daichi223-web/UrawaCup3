// src/lib/scheduleGenerator/types.ts
/**
 * スケジュール生成で使用する型定義
 */

// ============================================================================
// 基本型定義
// ============================================================================

export interface TeamInfo {
  id: number
  name: string
  shortName?: string
  groupId: string
  seedNumber: number // 1-6のシード番号
  // 制約チェック用フィールド（オプション）
  region?: string       // 地域
  leagueId?: number     // リーグID
  teamType?: 'local' | 'invited'  // チームタイプ
  isVenueHost?: boolean // 会場校フラグ
}

export interface GeneratedMatch {
  homeTeamId: number
  awayTeamId: number
  homeTeamName: string
  awayTeamName: string
  groupId: string
  venueId: number
  venueName: string
  matchDate: string
  matchTime: string
  matchOrder: number
  day: 1 | 2
  slot: number // 1-6の枠番号
  refereeTeamIds?: number[] // 審判担当チームID
}

export interface ScheduleGenerationResult {
  success: boolean
  matches: GeneratedMatch[]
  day1Matches: GeneratedMatch[]
  day2Matches: GeneratedMatch[]
  warnings: string[]
  stats: {
    totalMatches: number
    matchesPerGroup: number
    matchesPerTeam: number
  }
}

export interface Venue {
  id: number
  name: string
  groupId?: string
  group_id?: string  // snake_case (from Supabase)
}

// ============================================================================
// 制約スコア設定
// ============================================================================

export interface ConstraintScores {
  alreadyPlayed?: number    // 対戦済み（デフォルト: 200）
  sameLeague?: number       // 同リーグ（デフォルト: 100）
  sameRegion?: number       // 同地域（デフォルト: 50）
  localTeams?: number       // 地元同士（デフォルト: 30）
  consecutiveMatch?: number // 連戦（デフォルト: 20）
}

export interface ScheduleConfig {
  startTime?: string        // 開始時刻（デフォルト: 09:00）
  matchDuration?: number    // 試合時間（分、デフォルト: 15）
  intervalMinutes?: number  // 試合間隔（分、HT+入れ替え、デフォルト: 10）
  matchesPerTeamPerDay?: number // 1日あたりのチーム試合数（デフォルト: 2）
  constraintScores?: ConstraintScores // 制約スコア設定
  venueHostFirstMatch?: boolean // 会場校を1試合目に配置（デフォルト: true）
}

// ============================================================================
// 会場配置関連
// ============================================================================

export interface TeamForAssignment {
  id: number
  name: string
  shortName?: string
  region?: string           // 地域（埼玉、東京など）
  leagueId?: string | number // 所属リーグID
  teamType?: 'local' | 'invited'  // 地元校 or 招待校
  isHost?: boolean          // 会場ホストフラグ
  hostVenueId?: number      // ホストの場合、その会場ID
}

export interface PodPlan {
  pod3Count: number  // 3チームのPod数
  pod4Count: number  // 4チームのPod数
  pod5Count: number  // 5チームのPod数
  totalVenues: number
  totalTeams: number
}

// ============================================================================
// スコアリング関連
// ============================================================================

export interface LexPairScore {
  sameLeague: number    // 同リーグペア数
  sameRegion: number    // 同地域ペア数
  localVsLocal: number  // 地元同士ペア数
  day1Repeat: number    // Day1再戦ペア数（ハード制約）
}

export interface LexPairScoreWithBMatch extends LexPairScore {
  bMatchSameLeague: number
  bMatchSameRegion: number
  bMatchLocalVsLocal: number
}

// ============================================================================
// 会場配置結果
// ============================================================================

export interface VenueAssignmentResult {
  assignments: Map<number, TeamForAssignment[]>  // venueId -> teams
  score: number                                   // トータルコンフリクトスコア
  details: {
    // A戦の制約（メイン）
    sameLeaguePairs: number
    sameRegionPairs: number
    localVsLocalPairs: number
    day1RepeatPairs: number
    // B戦の制約（参考情報）
    bMatchSameLeaguePairs?: number
    bMatchSameRegionPairs?: number
    bMatchLocalVsLocalPairs?: number
  }
}

export interface VenueAssignmentInfo {
  venueId: number
  venueName: string
  teamId: number
  teamName: string
  teamShortName?: string
  teamType?: string  // 'local' | 'guest' など
  matchDay: number
  slotOrder: number
}

// ============================================================================
// B戦付き試合・スケジュール
// ============================================================================

export interface GeneratedMatchWithBMatch extends GeneratedMatch {
  isBMatch: boolean // B戦フラグ
}

export interface VenueBasedScheduleResult {
  success: boolean
  matches: GeneratedMatchWithBMatch[]
  day1Matches: GeneratedMatchWithBMatch[]
  day2Matches: GeneratedMatchWithBMatch[]
  warnings: string[]
  stats: {
    totalMatches: number
    aMatches: number
    bMatches: number
    matchesPerTeam: number
  }
}

// ============================================================================
// B戦パターン
// ============================================================================

export type BMatchPattern = 'A' | 'B' | 'C'

export interface MatchPatternEntry {
  slot: number
  home: number
  away: number
  isBMatch: boolean
}
