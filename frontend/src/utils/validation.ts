/**
 * 入力バリデーションユーティリティ
 *
 * 400 Bad Request エラーを防ぐための事前検証
 */

import type { Database } from '../types/database.types'

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * 必須フィールドチェック
 */
export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName}は必須です。`, fieldName)
  }
  return value
}

/**
 * 数値チェック（整数）
 */
export function validateInteger(value: unknown, fieldName: string): number {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName}は必須です。`, fieldName)
  }

  const num = typeof value === 'number' ? value : parseInt(String(value), 10)

  if (isNaN(num)) {
    throw new ValidationError(`${fieldName}は数値で入力してください。`, fieldName)
  }

  if (!Number.isInteger(num)) {
    throw new ValidationError(`${fieldName}は整数で入力してください。`, fieldName)
  }

  return num
}

/**
 * 数値チェック（正の整数）
 */
export function validatePositiveInteger(value: unknown, fieldName: string): number {
  const num = validateInteger(value, fieldName)

  if (num < 0) {
    throw new ValidationError(`${fieldName}は0以上で入力してください。`, fieldName)
  }

  return num
}

/**
 * IDチェック（正の整数、必須）
 */
export function validateId(value: unknown, fieldName: string = 'ID'): number {
  const num = validateInteger(value, fieldName)

  if (num <= 0) {
    throw new ValidationError(`${fieldName}が不正です。`, fieldName)
  }

  return num
}

/**
 * 文字列長チェック
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number }
): string {
  const { min, max } = options

  if (min !== undefined && value.length < min) {
    throw new ValidationError(`${fieldName}は${min}文字以上で入力してください。`, fieldName)
  }

  if (max !== undefined && value.length > max) {
    throw new ValidationError(`${fieldName}は${max}文字以内で入力してください。`, fieldName)
  }

  return value
}

/**
 * ENUM値チェック
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName}の値が不正です。許可される値: ${allowedValues.join(', ')}`,
      fieldName
    )
  }
  return value as T
}

/**
 * 日付形式チェック (YYYY-MM-DD)
 */
export function validateDate(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName}は必須です。`, fieldName)
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(value)) {
    throw new ValidationError(`${fieldName}はYYYY-MM-DD形式で入力してください。`, fieldName)
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName}が不正な日付です。`, fieldName)
  }

  return value
}

/**
 * 時刻形式チェック (HH:MM)
 */
export function validateTime(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName}は必須です。`, fieldName)
  }

  const timeRegex = /^\d{2}:\d{2}$/
  if (!timeRegex.test(value)) {
    throw new ValidationError(`${fieldName}はHH:MM形式で入力してください。`, fieldName)
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new ValidationError(`${fieldName}が不正な時刻です。`, fieldName)
  }

  return value
}

/**
 * 日付（オプショナル）
 */
export function validateOptionalDate(value: unknown, fieldName: string): string | null {
  if (!value || value === '') return null
  return validateDate(value, fieldName)
}

/**
 * 時刻（オプショナル）
 */
export function validateOptionalTime(value: unknown, fieldName: string): string | null {
  if (!value || value === '') return null
  return validateTime(value, fieldName)
}

// ============================================
// ドメイン固有バリデーション
// ============================================

/**
 * 試合ステータスの許可値
 */
/**
 * 試合ステータスの許可値
 */
export type MatchStatus = Database['public']['Enums']['match_status']
export const MATCH_STATUSES: MatchStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled']


/**
 * 試合ステータスチェック
 */
export function validateMatchStatus(value: unknown): MatchStatus {
  return validateEnum(value, MATCH_STATUSES, '試合ステータス')
}

/**
 * チームタイプの許可値
 */
/**
 * チームタイプの許可値
 */
export type TeamType = Database['public']['Enums']['team_type']
export const TEAM_TYPES: TeamType[] = ['local', 'invited']


/**
 * チームタイプチェック
 */
export function validateTeamType(value: unknown): TeamType {
  return validateEnum(value, TEAM_TYPES, '選択肢')
}

/**
 * ステージの許可値
 */
/**
 * ステージの許可値
 */
export type MatchStage = Database['public']['Enums']['match_stage']
// Note: validation.ts historically had a subset. If we want to support all, we should list all.
// For now, keeping the subset used by frontend, but typed as MatchStage.
export const MATCH_STAGES: MatchStage[] = ['preliminary', 'final', 'training']


/**
 * ステージチェック
 */
export function validateMatchStage(value: unknown): MatchStage {
  return validateEnum(value, MATCH_STAGES, 'ステージ')
}

/**
 * 試合結果の許可値
 */
/**
 * 試合結果の許可値
 */
export type MatchResult = Database['public']['Enums']['match_result']
export const MATCH_RESULTS: MatchResult[] = ['home_win', 'away_win', 'draw']


/**
 * ハーフの許可値
 */
export const GOAL_HALVES = [1, 2] as const

/**
 * 得点ハーフチェック
 */
export function validateGoalHalf(value: unknown): 1 | 2 {
  const num = validateInteger(value, 'ハーフ')
  if (num !== 1 && num !== 2) {
    throw new ValidationError('ハーフは1か2を指定してください。', 'half')
  }
  return num as 1 | 2
}

/**
 * 背番号チェック (0-99)
 */
export function validateJerseyNumber(value: unknown): number {
  const num = validatePositiveInteger(value, '背番号')
  if (num > 99) {
    throw new ValidationError('背番号は0〜99の範囲で入力してください。', 'number')
  }
  return num
}

/**
 * スコアチェック (0以上の整数)
 */
export function validateScore(value: unknown, fieldName: string = 'スコア'): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }
  return validatePositiveInteger(value, fieldName)
}

// ============================================
// 複合バリデーション
// ============================================

/**
 * チーム作成データのバリデーション
 */
export function validateTeamInput(data: {
  name?: string
  tournament_id?: number
  group_id?: string
  team_type?: string
}): void {
  validateRequired(data.name, 'チーム名')
  validateStringLength(data.name!, 'チーム名', { min: 1, max: 100 })
  validateId(data.tournament_id, '大会ID')

  if (data.team_type) {
    validateTeamType(data.team_type)
  }
}

/**
 * 選手作成データのバリデーション
 */
export function validatePlayerInput(data: {
  name?: string
  team_id?: number
  number?: number | string
}): void {
  validateRequired(data.name, '選手名')
  validateStringLength(data.name!, '選手名', { min: 1, max: 50 })
  validateId(data.team_id, 'チームID')

  if (data.number !== undefined && data.number !== null && data.number !== '') {
    validateJerseyNumber(data.number)
  }
}

/**
 * 試合更新データのバリデーション
 */
export function validateMatchUpdate(data: {
  status?: string
  home_score_half1?: number
  home_score_half2?: number
  away_score_half1?: number
  away_score_half2?: number
}): void {
  if (data.status) {
    validateMatchStatus(data.status)
  }

  if (data.home_score_half1 !== undefined) {
    validateScore(data.home_score_half1, '前半ホームスコア')
  }
  if (data.home_score_half2 !== undefined) {
    validateScore(data.home_score_half2, '後半ホームスコア')
  }
  if (data.away_score_half1 !== undefined) {
    validateScore(data.away_score_half1, '前半アウェイスコア')
  }
  if (data.away_score_half2 !== undefined) {
    validateScore(data.away_score_half2, '後半アウェイスコア')
  }
}

/**
 * 得点作成データのバリデーション
 */
export function validateGoalInput(data: {
  match_id?: number
  team_id?: number
  player_name?: string
  half?: number
  minute?: number
}): void {
  validateId(data.match_id, '試合ID')
  validateId(data.team_id, 'チームID')
  validateRequired(data.player_name, '得点者名')
  validateGoalHalf(data.half)

  if (data.minute !== undefined) {
    const minute = validatePositiveInteger(data.minute, '得点時間')
    if (minute > 45) {
      throw new ValidationError('得点時間は0〜45分の範囲で入力してください。', 'minute')
    }
  }
}

/**
 * 会場作成データのバリデーション
 */
export function validateVenueInput(data: {
  name?: string
  tournament_id?: number
}): void {
  validateRequired(data.name, '会場名')
  validateStringLength(data.name!, '会場名', { min: 1, max: 100 })
  validateId(data.tournament_id, '大会ID')
}
