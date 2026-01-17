/**
 * 浦和カップ 組み合わせ生成ロジック
 *
 * 設計思想:
 * - 4グループ × 6チーム = 24チーム
 * - 変則総当たり方式（4試合制）- 各チームはグループ内6チーム中5チームと対戦せず、4チームと対戦
 * - 対角線ペア（1-6, 2-5, 3-4）は対戦しない
 * - 連戦回避 - 各チームは最低1枠の休みを挟む
 * - 会場固定 - 各グループは1番チーム（ホスト校）の会場で全試合実施
 */

// 対戦パターン定義（1-indexed: チーム番号1〜6）
// 初日の対戦カード
const DAY1_MATCHES: [number, number][] = [
  [1, 2], // 枠1: 1 vs 2
  [3, 5], // 枠2: 3 vs 5
  [4, 6], // 枠3: 4 vs 6
  [1, 3], // 枠4: 1 vs 3
  [2, 4], // 枠5: 2 vs 4
  [5, 6], // 枠6: 5 vs 6
]

// 二日目の対戦カード
const DAY2_MATCHES: [number, number][] = [
  [1, 5], // 枠1: 1 vs 5
  [2, 3], // 枠2: 2 vs 3
  [4, 5], // 枠3: 4 vs 5
  [3, 6], // 枠4: 3 vs 6
  [1, 4], // 枠5: 1 vs 4
  [2, 6], // 枠6: 2 vs 6
]

// 対戦しないペア（対角線ペア）
const NON_MATCHING_PAIRS: [number, number][] = [
  [1, 6], // シード最上位と最下位
  [2, 5], // シード2番目と5番目
  [3, 4], // シード中位同士
]

// デフォルト設定
const DEFAULT_START_TIME = '09:00'
const DEFAULT_MATCH_DURATION = 15 // 試合時間（分）
const DEFAULT_INTERVAL = 10 // 試合間隔（分）= HT + 入れ替え

/**
 * キックオフ時刻を動的に生成
 * @param startTime 開始時刻 (HH:MM)
 * @param matchDuration 試合時間（分）
 * @param interval 試合間隔（分）= HT + 入れ替え
 * @param matchCount 試合数
 */
function generateKickoffTimes(
  startTime: string,
  matchDuration: number,
  interval: number,
  matchCount: number
): string[] {
  const times: string[] = []
  const [startHour, startMinute] = startTime.split(':').map(Number)
  let currentMinutes = startHour * 60 + startMinute

  for (let i = 0; i < matchCount; i++) {
    const hours = Math.floor(currentMinutes / 60)
    const minutes = currentMinutes % 60
    times.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
    // 次の試合開始時刻 = 試合時間 + 間隔
    currentMinutes += matchDuration + interval
  }

  return times
}

// グループ定義
const GROUPS = ['A', 'B', 'C', 'D']

// 会場とグループの対応
const GROUP_VENUES: Record<string, string> = {
  'A': '浦和南高G',
  'B': '市立浦和高G',
  'C': '浦和学院高G',
  'D': '武南高G',
}

export interface TeamInfo {
  id: number
  name: string
  shortName?: string
  groupId: string
  seedNumber: number // 1-6のシード番号
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

/**
 * チームをシード番号でソートしてグループ内の順位を取得
 */
function getTeamSeedNumber(teams: TeamInfo[], teamId: number): number {
  const team = teams.find(t => t.id === teamId)
  return team?.seedNumber || 0
}

/**
 * グループ内のチームをシード番号順に取得
 */
function getTeamsByGroup(teams: TeamInfo[], groupId: string): TeamInfo[] {
  return teams
    .filter(t => t.groupId === groupId)
    .sort((a, b) => a.seedNumber - b.seedNumber)
}

/**
 * 会場IDを取得（グループIDから）
 */
function getVenueForGroup(venues: Venue[], groupId: string): Venue | undefined {
  // まずgroupIdまたはgroup_id（snake_case）が一致する会場を探す
  let venue = venues.find(v => (v.groupId || v.group_id) === groupId)
  if (venue) {
    console.log(`[Schedule] グループ${groupId}の会場: ${venue.name} (group_id=${venue.group_id || venue.groupId})`)
    return venue
  }

  // グループ名を含む会場を探す
  const groupVenueName = GROUP_VENUES[groupId]
  if (groupVenueName) {
    venue = venues.find(v => v.name.includes(groupVenueName.replace('高G', '')))
    if (venue) {
      console.log(`[Schedule] グループ${groupId}の会場（名前一致）: ${venue.name}`)
      return venue
    }
  }

  // それでも見つからない場合はインデックスで割り当て
  const groupIndex = GROUPS.indexOf(groupId)
  if (groupIndex >= 0 && groupIndex < venues.length) {
    venue = venues[groupIndex]
    if (venue) {
      console.log(`[Schedule] グループ${groupId}の会場（インデックス）: ${venue.name}`)
    }
  }

  // デバッグ: 見つからない場合
  if (!venue) {
    console.log(`[Schedule] グループ${groupId}の会場が見つかりません。会場一覧:`, venues.map(v => ({
      id: v.id,
      name: v.name,
      groupId: v.groupId,
      group_id: v.group_id
    })))
  }

  return venue
}

/**
 * 審判担当チームを取得（その枠で試合をしていないチーム）
 */
function getRefereeTeams(
  groupTeams: TeamInfo[],
  homeTeamSeed: number,
  awayTeamSeed: number
): number[] {
  // 試合をしていないチームのIDを返す
  return groupTeams
    .filter(t => t.seedNumber !== homeTeamSeed && t.seedNumber !== awayTeamSeed)
    .map(t => t.id)
}

export interface ScheduleConfig {
  startTime?: string        // 開始時刻（デフォルト: 09:00）
  matchDuration?: number    // 試合時間（分、デフォルト: 15）
  intervalMinutes?: number  // 試合間隔（分、HT+入れ替え、デフォルト: 10）
}

/**
 * 浦和カップの日程を生成
 * @param teams チーム一覧
 * @param venues 会場一覧
 * @param day1Date 初日の日付
 * @param day2Date 二日目の日付
 * @param config 設定（試合時間、間隔など）
 */
export function generateUrawaCupSchedule(
  teams: TeamInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string,
  config?: ScheduleConfig
): ScheduleGenerationResult {
  const warnings: string[] = []
  const matches: GeneratedMatch[] = []
  let matchOrder = 1

  // 設定値を取得（デフォルト値を適用）
  const startTime = config?.startTime || DEFAULT_START_TIME
  const matchDuration = config?.matchDuration || DEFAULT_MATCH_DURATION
  const interval = config?.intervalMinutes || DEFAULT_INTERVAL

  // キックオフ時刻を動的に生成（1日6試合）
  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, 6)

  console.log('[Schedule] 設定:', { startTime, matchDuration, interval })
  console.log('[Schedule] キックオフ時刻:', kickoffTimes)

  // グループごとに処理
  for (const groupId of GROUPS) {
    const groupTeams = getTeamsByGroup(teams, groupId)

    // チーム数チェック
    if (groupTeams.length !== 6) {
      warnings.push(`グループ${groupId}のチーム数が${groupTeams.length}です（6チーム必要）`)
      if (groupTeams.length < 2) continue
    }

    // 会場を取得
    const venue = getVenueForGroup(venues, groupId)
    if (!venue) {
      warnings.push(`グループ${groupId}の会場が見つかりません`)
      continue
    }

    // 初日の試合を生成
    for (let slot = 0; slot < DAY1_MATCHES.length; slot++) {
      const [homeSeed, awaySeed] = DAY1_MATCHES[slot]

      // シード番号に対応するチームを取得
      const homeTeam = groupTeams.find(t => t.seedNumber === homeSeed)
      const awayTeam = groupTeams.find(t => t.seedNumber === awaySeed)

      if (!homeTeam || !awayTeam) {
        warnings.push(`グループ${groupId}の初日枠${slot + 1}: チームが見つかりません`)
        continue
      }

      const refereeTeamIds = getRefereeTeams(groupTeams, homeSeed, awaySeed)

      matches.push({
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeTeamName: homeTeam.shortName || homeTeam.name,
        awayTeamName: awayTeam.shortName || awayTeam.name,
        groupId,
        venueId: venue.id,
        venueName: venue.name,
        matchDate: day1Date,
        matchTime: kickoffTimes[slot],
        matchOrder: matchOrder++,
        day: 1,
        slot: slot + 1,
        refereeTeamIds,
      })
    }

    // 二日目の試合を生成
    for (let slot = 0; slot < DAY2_MATCHES.length; slot++) {
      const [homeSeed, awaySeed] = DAY2_MATCHES[slot]

      const homeTeam = groupTeams.find(t => t.seedNumber === homeSeed)
      const awayTeam = groupTeams.find(t => t.seedNumber === awaySeed)

      if (!homeTeam || !awayTeam) {
        warnings.push(`グループ${groupId}の二日目枠${slot + 1}: チームが見つかりません`)
        continue
      }

      const refereeTeamIds = getRefereeTeams(groupTeams, homeSeed, awaySeed)

      matches.push({
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeTeamName: homeTeam.shortName || homeTeam.name,
        awayTeamName: awayTeam.shortName || awayTeam.name,
        groupId,
        venueId: venue.id,
        venueName: venue.name,
        matchDate: day2Date,
        matchTime: kickoffTimes[slot],
        matchOrder: matchOrder++,
        day: 2,
        slot: slot + 1,
        refereeTeamIds,
      })
    }
  }

  // 日ごとに分類
  const day1Matches = matches.filter(m => m.day === 1)
  const day2Matches = matches.filter(m => m.day === 2)

  return {
    success: matches.length > 0,
    matches,
    day1Matches,
    day2Matches,
    warnings,
    stats: {
      totalMatches: matches.length,
      matchesPerGroup: 12, // 6試合 × 2日
      matchesPerTeam: 4,   // 各チーム4試合
    },
  }
}

/**
 * 対戦表を検証
 */
export function validateSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  const errors: string[] = []

  // チームごとの試合数をカウント
  const matchCountByTeam: Record<number, number> = {}
  const opponentsByTeam: Record<number, Set<number>> = {}

  for (const match of matches) {
    // ホームチーム
    matchCountByTeam[match.homeTeamId] = (matchCountByTeam[match.homeTeamId] || 0) + 1
    if (!opponentsByTeam[match.homeTeamId]) opponentsByTeam[match.homeTeamId] = new Set()
    opponentsByTeam[match.homeTeamId].add(match.awayTeamId)

    // アウェイチーム
    matchCountByTeam[match.awayTeamId] = (matchCountByTeam[match.awayTeamId] || 0) + 1
    if (!opponentsByTeam[match.awayTeamId]) opponentsByTeam[match.awayTeamId] = new Set()
    opponentsByTeam[match.awayTeamId].add(match.homeTeamId)
  }

  // 各チームが4試合であることを確認
  for (const team of teams) {
    const count = matchCountByTeam[team.id] || 0
    if (count !== 4) {
      errors.push(`${team.name}の試合数が${count}です（4試合必要）`)
    }
  }

  // 対角線ペアが対戦していないことを確認
  for (const [seed1, seed2] of NON_MATCHING_PAIRS) {
    for (const groupId of GROUPS) {
      const groupTeams = teams.filter(t => t.groupId === groupId)
      const team1 = groupTeams.find(t => t.seedNumber === seed1)
      const team2 = groupTeams.find(t => t.seedNumber === seed2)

      if (team1 && team2) {
        if (opponentsByTeam[team1.id]?.has(team2.id)) {
          errors.push(`グループ${groupId}: シード${seed1}とシード${seed2}が対戦しています（対角線ペア）`)
        }
      }
    }
  }

  return errors
}

/**
 * 連戦チェック（同日に連続する枠で試合がないか）
 */
export function checkConsecutiveMatches(matches: GeneratedMatch[]): string[] {
  const warnings: string[] = []

  // グループ・日ごとにチェック
  for (const groupId of GROUPS) {
    for (const day of [1, 2] as const) {
      const dayMatches = matches
        .filter(m => m.groupId === groupId && m.day === day)
        .sort((a, b) => a.slot - b.slot)

      // チームごとに出場枠を記録
      const slotsByTeam: Record<number, number[]> = {}

      for (const match of dayMatches) {
        if (!slotsByTeam[match.homeTeamId]) slotsByTeam[match.homeTeamId] = []
        if (!slotsByTeam[match.awayTeamId]) slotsByTeam[match.awayTeamId] = []
        slotsByTeam[match.homeTeamId].push(match.slot)
        slotsByTeam[match.awayTeamId].push(match.slot)
      }

      // 連続する枠がないかチェック
      for (const [teamId, slots] of Object.entries(slotsByTeam)) {
        slots.sort((a, b) => a - b)
        for (let i = 0; i < slots.length - 1; i++) {
          if (slots[i + 1] - slots[i] === 1) {
            const team = matches.find(m => m.homeTeamId === Number(teamId) || m.awayTeamId === Number(teamId))
            const teamName = team?.homeTeamId === Number(teamId) ? team.homeTeamName : team?.awayTeamName
            warnings.push(`グループ${groupId} Day${day}: ${teamName}が枠${slots[i]}と${slots[i + 1]}で連戦`)
          }
        }
      }
    }
  }

  return warnings
}

/**
 * 1リーグ制（総当たり）の日程を生成
 * @param teams チーム一覧
 * @param venues 会場一覧
 * @param day1Date 初日の日付
 * @param day2Date 二日目の日付
 * @param config 設定（試合時間、間隔など）
 */
export function generateSingleLeagueSchedule(
  teams: TeamInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string,
  config?: ScheduleConfig
): ScheduleGenerationResult {
  const warnings: string[] = []
  const matches: GeneratedMatch[] = []
  let matchOrder = 1

  // 設定値を取得（デフォルト値を適用）
  const startTime = config?.startTime || DEFAULT_START_TIME
  const matchDuration = config?.matchDuration || DEFAULT_MATCH_DURATION
  const interval = config?.intervalMinutes || DEFAULT_INTERVAL

  if (teams.length < 2) {
    warnings.push('チームが2チーム以上必要です')
    return {
      success: false,
      matches: [],
      day1Matches: [],
      day2Matches: [],
      warnings,
      stats: { totalMatches: 0, matchesPerGroup: 0, matchesPerTeam: 0 },
    }
  }

  if (venues.length === 0) {
    warnings.push('会場が登録されていません')
    return {
      success: false,
      matches: [],
      day1Matches: [],
      day2Matches: [],
      warnings,
      stats: { totalMatches: 0, matchesPerGroup: 0, matchesPerTeam: 0 },
    }
  }

  // 総当たりペアを生成
  const allPairs: { home: TeamInfo; away: TeamInfo }[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairs.push({ home: teams[i], away: teams[j] })
    }
  }

  const totalMatches = allPairs.length
  const matchesPerDay = Math.ceil(totalMatches / 2)

  // 1日あたりの会場ごとの最大試合数を計算
  const matchesPerVenuePerDay = Math.ceil(matchesPerDay / venues.length)

  // キックオフ時刻を動的に生成
  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, matchesPerVenuePerDay)

  console.log('[SingleLeague] 設定:', { startTime, matchDuration, interval })
  console.log('[SingleLeague] 総試合数:', totalMatches, '1日あたり:', matchesPerDay)
  console.log('[SingleLeague] 会場数:', venues.length, '会場あたり試合数:', matchesPerVenuePerDay)
  console.log('[SingleLeague] キックオフ時刻:', kickoffTimes)

  // Day1の試合を生成
  const day1Pairs = allPairs.slice(0, matchesPerDay)
  for (let i = 0; i < day1Pairs.length; i++) {
    const pair = day1Pairs[i]
    const venueIndex = i % venues.length
    const slotIndex = Math.floor(i / venues.length)
    const venue = venues[venueIndex]

    matches.push({
      homeTeamId: pair.home.id,
      awayTeamId: pair.away.id,
      homeTeamName: pair.home.shortName || pair.home.name,
      awayTeamName: pair.away.shortName || pair.away.name,
      groupId: '-', // 1リーグ制は'-'で統一
      venueId: venue.id,
      venueName: venue.name,
      matchDate: day1Date,
      matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
      matchOrder: matchOrder++,
      day: 1,
      slot: slotIndex + 1,
    })
  }

  // Day2の試合を生成
  const day2Pairs = allPairs.slice(matchesPerDay)
  for (let i = 0; i < day2Pairs.length; i++) {
    const pair = day2Pairs[i]
    const venueIndex = i % venues.length
    const slotIndex = Math.floor(i / venues.length)
    const venue = venues[venueIndex]

    matches.push({
      homeTeamId: pair.home.id,
      awayTeamId: pair.away.id,
      homeTeamName: pair.home.shortName || pair.home.name,
      awayTeamName: pair.away.shortName || pair.away.name,
      groupId: '-',
      venueId: venue.id,
      venueName: venue.name,
      matchDate: day2Date,
      matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
      matchOrder: matchOrder++,
      day: 2,
      slot: slotIndex + 1,
    })
  }

  // 日ごとに分類
  const day1Matches = matches.filter(m => m.day === 1)
  const day2Matches = matches.filter(m => m.day === 2)

  // 各チームの試合数を計算
  const matchesPerTeam = teams.length - 1 // 総当たりなので n-1 試合

  return {
    success: matches.length > 0,
    matches,
    day1Matches,
    day2Matches,
    warnings,
    stats: {
      totalMatches: matches.length,
      matchesPerGroup: matches.length, // 1グループなので全試合
      matchesPerTeam,
    },
  }
}

/**
 * 1リーグ制の対戦表を検証
 */
export function validateSingleLeagueSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  const errors: string[] = []

  // チームごとの試合数をカウント
  const matchCountByTeam: Record<number, number> = {}
  const opponentsByTeam: Record<number, Set<number>> = {}

  for (const match of matches) {
    matchCountByTeam[match.homeTeamId] = (matchCountByTeam[match.homeTeamId] || 0) + 1
    if (!opponentsByTeam[match.homeTeamId]) opponentsByTeam[match.homeTeamId] = new Set()
    opponentsByTeam[match.homeTeamId].add(match.awayTeamId)

    matchCountByTeam[match.awayTeamId] = (matchCountByTeam[match.awayTeamId] || 0) + 1
    if (!opponentsByTeam[match.awayTeamId]) opponentsByTeam[match.awayTeamId] = new Set()
    opponentsByTeam[match.awayTeamId].add(match.homeTeamId)
  }

  const expectedMatches = teams.length - 1

  // 各チームが n-1 試合であることを確認
  for (const team of teams) {
    const count = matchCountByTeam[team.id] || 0
    if (count !== expectedMatches) {
      errors.push(`${team.name}の試合数が${count}です（${expectedMatches}試合必要）`)
    }
  }

  // 全チームと対戦していることを確認
  for (const team of teams) {
    const opponents = opponentsByTeam[team.id] || new Set()
    if (opponents.size !== expectedMatches) {
      errors.push(`${team.name}の対戦相手が${opponents.size}チームです（${expectedMatches}チーム必要）`)
    }
  }

  return errors
}
