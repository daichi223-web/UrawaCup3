/**
 * APIガードユーティリティ
 *
 * 401, 402, 403, 404, 405エラーを防ぐための事前チェック
 */

import { supabase } from '@/lib/supabase'
import { showError, isUnauthorizedError, isNetworkError } from './errorHandler'

/**
 * セッション状態
 */
let sessionCheckInProgress = false
let lastSessionCheck = 0
const SESSION_CHECK_INTERVAL = 60000 // 1分

/**
 * 401対策: セッションの有効性を確認（簡略化版）
 */
export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('[Session] Error getting session:', error)
      return false
    }

    if (!session) {
      console.warn('[Session] No active session')
      return false
    }

    return true
  } catch (error) {
    console.error('[Session] Unexpected error:', error)
    return false
  }
}

/**
 * 401対策: 認証が必要な操作前にセッションを確認
 */
export async function requireAuth(): Promise<void> {
  const valid = await ensureValidSession()
  if (!valid) {
    throw new Error('ログインが必要です。再度ログインしてください。')
  }
}

/**
 * 403対策: ユーザーの権限を確認
 */
export async function checkPermission(
  requiredRole: 'admin' | 'venue_staff',
  venueId?: number
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    return false
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, venue_id')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) {
    return false
  }

  // adminは全ての権限を持つ
  if (profile.role === 'admin') {
    return true
  }

  // venue_staffは自分の会場のみ
  if (requiredRole === 'venue_staff' && profile.role === 'venue_staff') {
    if (venueId !== undefined) {
      return profile.venue_id === venueId
    }
    return true
  }

  return false
}

/**
 * 403対策: 管理者権限を要求
 */
export async function requireAdmin(): Promise<void> {
  const hasPermission = await checkPermission('admin')
  if (!hasPermission) {
    throw new Error('この操作には管理者権限が必要です。')
  }
}

/**
 * 403対策: 会場スタッフ権限を要求
 */
export async function requireVenueStaff(venueId?: number): Promise<void> {
  const hasPermission = await checkPermission('venue_staff', venueId)
  if (!hasPermission) {
    throw new Error('この会場を編集する権限がありません。')
  }
}

/**
 * 404対策: データの存在確認
 */
export async function checkExists(
  table: string,
  id: number,
  entityName: string = 'データ'
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .single()

  if (error || !data) {
    return false
  }

  return true
}

/**
 * 404対策: 存在確認してからエラー
 */
export async function requireExists(
  table: string,
  id: number,
  entityName: string = 'データ'
): Promise<void> {
  const exists = await checkExists(table, id, entityName)
  if (!exists) {
    throw new Error(`指定された${entityName}が見つかりません。`)
  }
}

/**
 * 402/429対策: レート制限付きリトライ
 */
const requestTimestamps: number[] = []
const MAX_REQUESTS_PER_MINUTE = 60
const RATE_LIMIT_WINDOW = 60000 // 1分

export async function withRateLimitProtection<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; retryDelay?: number }
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000 } = options || {}

  // 古いタイムスタンプを削除
  const now = Date.now()
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift()
  }

  // レート制限チェック
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestRequest = requestTimestamps[0]
    const waitTime = oldestRequest + RATE_LIMIT_WINDOW - now
    console.warn(`[RateLimit] Too many requests. Waiting ${waitTime}ms...`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return withRateLimitProtection(fn, options)
  }

  requestTimestamps.push(now)

  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 429エラーの場合はリトライ
      if (error instanceof Error && error.message.includes('429')) {
        console.warn(`[RateLimit] 429 error, retrying in ${retryDelay}ms... (attempt ${attempt + 1})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      }

      // ネットワークエラーの場合もリトライ
      if (isNetworkError(error)) {
        console.warn(`[Network] Network error, retrying in ${retryDelay}ms... (attempt ${attempt + 1})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      }

      // その他のエラーは即座にスロー
      throw error
    }
  }

  throw lastError
}

/**
 * 405対策: 未実装機能の警告
 */
const UNIMPLEMENTED_FEATURES = new Set([
  'generateSchedule',
  'generateTrainingMatches',
  'generateFinalTournament',
  'generateFinalDaySchedule',
  'generateReport',
])

export function warnIfUnimplemented(featureName: string): boolean {
  if (UNIMPLEMENTED_FEATURES.has(featureName)) {
    console.warn(`[Feature] ${featureName} はまだサーバーサイドで実装されていません。`)
    return true
  }
  return false
}

/**
 * 405対策: 未実装機能をチェックしてエラー
 */
export function requireImplemented(featureName: string): void {
  if (UNIMPLEMENTED_FEATURES.has(featureName)) {
    throw new Error(
      `${featureName} 機能は現在利用できません。手動で操作してください。`
    )
  }
}

/**
 * API呼び出しをラップして全てのガードを適用
 */
export async function guardedApiCall<T>(
  fn: () => Promise<T>,
  options?: {
    requireAuth?: boolean
    requireAdmin?: boolean
    checkExistence?: { table: string; id: number; entityName?: string }
    featureName?: string
  }
): Promise<T> {
  const {
    requireAuth: needsAuth = true,
    requireAdmin: needsAdmin = false,
    checkExistence,
    featureName,
  } = options || {}

  // 405チェック
  if (featureName) {
    requireImplemented(featureName)
  }

  // 401チェック
  if (needsAuth) {
    await requireAuth()
  }

  // 403チェック
  if (needsAdmin) {
    await requireAdmin()
  }

  // 404チェック
  if (checkExistence) {
    await requireExists(
      checkExistence.table,
      checkExistence.id,
      checkExistence.entityName
    )
  }

  // レート制限付きで実行
  return withRateLimitProtection(fn)
}
