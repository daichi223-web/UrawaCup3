// src/lib/scheduleGenerator/utils/kickoff.ts
/**
 * キックオフ時刻の生成
 */

/**
 * キックオフ時刻を動的に生成
 * @param startTime 開始時刻 (HH:MM)
 * @param matchDuration 試合時間（分）
 * @param interval 試合間隔（分）= HT + 入れ替え
 * @param matchCount 試合数
 */
export function generateKickoffTimes(
  startTime: string,
  matchDuration: number,
  interval: number,
  matchCount: number
): string[] {
  const times: string[] = []
  // HH:MM または HH:MM:SS 形式に対応
  const timeParts = startTime.split(':').map(Number)
  const startHour = timeParts[0] || 0
  const startMinute = timeParts[1] || 0
  let currentMinutes = startHour * 60 + startMinute
  const MAX_MINUTES = 23 * 60 + 59 // 23:59

  for (let i = 0; i < matchCount; i++) {
    // 23:59を超えないようにキャップ
    const cappedMinutes = Math.min(currentMinutes, MAX_MINUTES)
    const hours = Math.floor(cappedMinutes / 60)
    const minutes = cappedMinutes % 60
    times.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
    // 次の試合開始時刻 = 試合時間 + 間隔
    currentMinutes += matchDuration + interval
  }

  return times
}
