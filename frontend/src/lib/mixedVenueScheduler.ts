/**
 * 混合会場スケジュール計算ユーティリティ
 *
 * 混合会場では、決勝トーナメント試合と研修試合が同一会場で行われる。
 * 最初のN試合は決勝トーナメント（決勝の試合時間）、以降は研修試合（予選の試合時間）となる。
 */

export interface MixedVenueConfig {
  /** 決勝試合数（最初のN試合が決勝トーナメント） */
  finalsMatchCount: number
  /** 第1試合開始時刻 (HH:mm) */
  startTime: string
  /** 決勝トーナメント試合時間（分） */
  finalsMatchDuration: number
  /** 決勝トーナメント試合間隔（分） */
  finalsIntervalMinutes: number
  /** 研修試合時間（分） - 予選と同じ */
  trainingMatchDuration: number
  /** 研修試合間隔（分） */
  trainingIntervalMinutes: number
}

export interface MatchTimeSlot {
  /** 枠番号（1-based） */
  slotNumber: number
  /** キックオフ時刻 (HH:mm) */
  kickoffTime: string
  /** 試合種別 */
  matchType: 'finals' | 'training'
  /** 試合時間（分） */
  matchDuration: number
}

/**
 * 混合会場の試合時間を計算
 * @param config 混合会場設定
 * @param totalMatches 総試合数
 * @returns 各試合の時間スロット
 */
export function calculateMixedVenueSchedule(
  config: MixedVenueConfig,
  totalMatches: number
): MatchTimeSlot[] {
  const slots: MatchTimeSlot[] = []

  // 開始時刻をパース
  const [startHour, startMinute] = config.startTime.split(':').map(Number)
  let currentMinutes = startHour * 60 + startMinute

  for (let i = 0; i < totalMatches; i++) {
    const slotNumber = i + 1
    const isFinals = i < config.finalsMatchCount
    const matchDuration = isFinals ? config.finalsMatchDuration : config.trainingMatchDuration
    const intervalMinutes = isFinals ? config.finalsIntervalMinutes : config.trainingIntervalMinutes

    // キックオフ時刻をフォーマット
    const hours = Math.floor(currentMinutes / 60)
    const minutes = currentMinutes % 60
    const kickoffTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    slots.push({
      slotNumber,
      kickoffTime,
      matchType: isFinals ? 'finals' : 'training',
      matchDuration,
    })

    // 次の試合開始時刻を計算
    // 決勝から研修への移行時は、決勝の試合時間と研修の間隔を使用
    const nextIsFinals = (i + 1) < config.finalsMatchCount
    const nextInterval = nextIsFinals ? config.finalsIntervalMinutes : config.trainingIntervalMinutes
    currentMinutes += matchDuration + nextInterval
  }

  return slots
}

/**
 * 分を HH:mm 形式に変換
 */
export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * HH:mm 形式を分に変換
 */
export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * 通常会場（単一種別）の試合時間を計算
 */
export function calculateSimpleVenueSchedule(
  startTime: string,
  matchDuration: number,
  intervalMinutes: number,
  totalMatches: number
): string[] {
  const times: string[] = []
  const [startHour, startMinute] = startTime.split(':').map(Number)
  let currentMinutes = startHour * 60 + startMinute

  for (let i = 0; i < totalMatches; i++) {
    times.push(minutesToTimeString(currentMinutes))
    currentMinutes += matchDuration + intervalMinutes
  }

  return times
}

/**
 * 混合会場かどうかを判定
 */
export function isMixedUseVenue(venue: {
  isMixedUse?: boolean
  is_mixed_use?: boolean
  finalsMatchCount?: number
  finals_match_count?: number
}): boolean {
  return (venue.isMixedUse ?? venue.is_mixed_use ?? false)
}

/**
 * 会場の決勝試合数を取得
 */
export function getFinalsMatchCount(venue: {
  finalsMatchCount?: number
  finals_match_count?: number
}): number {
  return venue.finalsMatchCount ?? venue.finals_match_count ?? 1
}
