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

// 対戦制約スコアの設定
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
 * 対戦ペアの優先度スコアを計算（低いほど優先）
 */
function calculatePairScore(
  teamA: TeamInfo,
  teamB: TeamInfo,
  usedPairs: Set<string>,
  scores: ConstraintScores
): number {
  let score = 0
  const pairKey = `${Math.min(teamA.id, teamB.id)}-${Math.max(teamA.id, teamB.id)}`

  // 対戦済み
  if (usedPairs.has(pairKey)) {
    score += scores.alreadyPlayed || 200
  }

  // 同リーグ
  if (teamA.leagueId && teamB.leagueId && teamA.leagueId === teamB.leagueId) {
    score += scores.sameLeague || 100
  }

  // 同地域
  if (teamA.region && teamB.region && teamA.region === teamB.region) {
    score += scores.sameRegion || 50
  }

  // 地元同士
  if (teamA.teamType === 'local' && teamB.teamType === 'local') {
    score += scores.localTeams || 30
  }

  return score
}

/**
 * 1リーグ制の日程を生成
 * 各チーム1日2試合 × 2日間 = 計4試合
 * - 優先度スコアに基づく対戦相手選択
 * - 連戦回避（同チームが連続スロットに入らない）
 * - 会場校を1試合目に配置
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
  const matchesPerTeamPerDay = config?.matchesPerTeamPerDay || 2
  const constraintScores = config?.constraintScores || {}
  const venueHostFirstMatch = config?.venueHostFirstMatch ?? true

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

  // 各チーム2試合/日の場合、1日の試合数 = チーム数 * 2 / 2 = チーム数
  const matchesPerDay = (teams.length * matchesPerTeamPerDay) / 2
  const totalMatchesNeeded = matchesPerDay * 2 // 2日間

  // 1日あたりの会場ごとの試合数を計算
  const matchesPerVenuePerDay = Math.ceil(matchesPerDay / venues.length)

  // キックオフ時刻を動的に生成
  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, matchesPerVenuePerDay)

  console.log('[SingleLeague] 設定:', { startTime, matchDuration, interval, constraintScores })
  console.log('[SingleLeague] チーム数:', teams.length, '1日の試合数/チーム:', matchesPerTeamPerDay)
  console.log('[SingleLeague] 1日の総試合数:', matchesPerDay, '2日間合計:', totalMatchesNeeded)
  console.log('[SingleLeague] 会場数:', venues.length, '会場あたり試合数:', matchesPerVenuePerDay)
  console.log('[SingleLeague] キックオフ時刻:', kickoffTimes)

  // 時間オーバーフローのチェック
  const timeParts = startTime.split(':').map(Number)
  const startHour = timeParts[0] || 0
  const startMinute = timeParts[1] || 0
  const totalMinutesNeeded = (startHour * 60 + startMinute) + (matchesPerVenuePerDay - 1) * (matchDuration + interval)
  if (totalMinutesNeeded > 23 * 60 + 59) {
    warnings.push(`1日の試合数が多すぎます。会場あたり${matchesPerVenuePerDay}試合は時間内に収まりません。会場を増やすか、試合間隔を短くしてください。`)
  }

  // 会場校のチームIDをマッピング
  const venueHostTeams = new Map<number, number>() // venueId -> teamId
  teams.forEach(team => {
    if (team.isVenueHost) {
      // 該当する会場を探す（名前が一致する会場を仮定）
      const venue = venues.find(v => v.name.includes(team.name) || v.name.includes(team.shortName || ''))
      if (venue) {
        venueHostTeams.set(venue.id, team.id)
        console.log(`[SingleLeague] 会場校: ${team.name} -> 会場${venue.name}`)
      }
    }
  })

  // 全対戦ペアを生成
  const allPairs: { home: TeamInfo; away: TeamInfo; score: number }[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairs.push({
        home: teams[i],
        away: teams[j],
        score: calculatePairScore(teams[i], teams[j], new Set(), constraintScores)
      })
    }
  }

  // スコア順にソート（低スコア優先）+ ランダム性を加える
  allPairs.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return Math.random() - 0.5 // 同スコアならランダム
  })

  console.log('[SingleLeague] ペア数:', allPairs.length, '上位5ペア:', allPairs.slice(0, 5).map(p =>
    `${p.home.shortName || p.home.name} vs ${p.away.shortName || p.away.name} (score:${p.score})`
  ))

  // 使用済みペアを追跡
  const usedPairs = new Set<string>()

  // 各日の試合を生成する関数（スコアベース + 連戦回避）
  const generateDayMatches = (
    day: 1 | 2,
    matchDate: string,
    availablePairs: { home: TeamInfo; away: TeamInfo; score: number }[]
  ): GeneratedMatch[] => {
    const dayMatches: GeneratedMatch[] = []
    const teamMatchCount: Record<number, number> = {}
    const teamsInPrevSlot = new Set<number>() // 前のスロットに出場したチーム（連戦回避用）

    // 各チームの試合数を初期化
    teams.forEach(t => { teamMatchCount[t.id] = 0 })

    // 時間帯（slot）ごとに試合を割り当て
    const numSlots = matchesPerVenuePerDay

    for (let slotIndex = 0; slotIndex < numSlots; slotIndex++) {
      const teamsInThisSlot = new Set<number>()
      let matchesInSlot = 0

      // 会場ごとに試合を割り当て
      for (let venueIndex = 0; venueIndex < venues.length; venueIndex++) {
        if (dayMatches.length >= matchesPerDay) break

        const venue = venues[venueIndex]

        // 会場校を1試合目に配置
        if (venueHostFirstMatch && slotIndex === 0 && venueHostTeams.has(venue.id)) {
          const hostTeamId = venueHostTeams.get(venue.id)!
          const hostPair = availablePairs.find(pair => {
            const pairKey = `${Math.min(pair.home.id, pair.away.id)}-${Math.max(pair.home.id, pair.away.id)}`
            if (usedPairs.has(pairKey)) return false
            if (teamMatchCount[pair.home.id] >= matchesPerTeamPerDay) return false
            if (teamMatchCount[pair.away.id] >= matchesPerTeamPerDay) return false
            if (teamsInThisSlot.has(pair.home.id) || teamsInThisSlot.has(pair.away.id)) return false
            return pair.home.id === hostTeamId || pair.away.id === hostTeamId
          })

          if (hostPair) {
            const pairKey = `${Math.min(hostPair.home.id, hostPair.away.id)}-${Math.max(hostPair.home.id, hostPair.away.id)}`
            dayMatches.push({
              homeTeamId: hostPair.home.id,
              awayTeamId: hostPair.away.id,
              homeTeamName: hostPair.home.shortName || hostPair.home.name,
              awayTeamName: hostPair.away.shortName || hostPair.away.name,
              groupId: null as any, // 1リーグ制ではnull（色は表示時に会場インデックスから計算）
              venueId: venue.id,
              venueName: venue.name,
              matchDate,
              matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
              matchOrder: matchOrder++,
              day,
              slot: slotIndex + 1,
            })
            teamsInThisSlot.add(hostPair.home.id)
            teamsInThisSlot.add(hostPair.away.id)
            teamMatchCount[hostPair.home.id]++
            teamMatchCount[hostPair.away.id]++
            usedPairs.add(pairKey)
            matchesInSlot++
            continue
          }
        }

        // 通常のペア選択（スコア順、連戦回避）
        for (const pair of availablePairs) {
          const pairKey = `${Math.min(pair.home.id, pair.away.id)}-${Math.max(pair.home.id, pair.away.id)}`

          // すでに使用済みのペアはスキップ
          if (usedPairs.has(pairKey)) continue

          // 両チームがまだ1日の試合数上限未満か確認
          if (teamMatchCount[pair.home.id] >= matchesPerTeamPerDay) continue
          if (teamMatchCount[pair.away.id] >= matchesPerTeamPerDay) continue

          // この時間帯に既に出場しているチームはスキップ
          if (teamsInThisSlot.has(pair.home.id)) continue
          if (teamsInThisSlot.has(pair.away.id)) continue

          // 連戦回避: 前のスロットに出場したチームは優先度を下げる
          const isConsecutive = teamsInPrevSlot.has(pair.home.id) || teamsInPrevSlot.has(pair.away.id)
          if (isConsecutive) {
            // 連戦になるが他に選択肢がなければ許容
            const hasAlternative = availablePairs.some(altPair => {
              const altKey = `${Math.min(altPair.home.id, altPair.away.id)}-${Math.max(altPair.home.id, altPair.away.id)}`
              if (usedPairs.has(altKey)) return false
              if (teamMatchCount[altPair.home.id] >= matchesPerTeamPerDay) return false
              if (teamMatchCount[altPair.away.id] >= matchesPerTeamPerDay) return false
              if (teamsInThisSlot.has(altPair.home.id) || teamsInThisSlot.has(altPair.away.id)) return false
              if (teamsInPrevSlot.has(altPair.home.id) || teamsInPrevSlot.has(altPair.away.id)) return false
              return true
            })
            if (hasAlternative) continue // 連戦を避けられる場合はスキップ
          }

          // この試合を追加
          dayMatches.push({
            homeTeamId: pair.home.id,
            awayTeamId: pair.away.id,
            homeTeamName: pair.home.shortName || pair.home.name,
            awayTeamName: pair.away.shortName || pair.away.name,
            groupId: null as any, // 1リーグ制ではnull（色は表示時に会場インデックスから計算）
            venueId: venue.id,
            venueName: venue.name,
            matchDate,
            matchTime: kickoffTimes[slotIndex] || kickoffTimes[kickoffTimes.length - 1],
            matchOrder: matchOrder++,
            day,
            slot: slotIndex + 1,
          })

          teamsInThisSlot.add(pair.home.id)
          teamsInThisSlot.add(pair.away.id)
          teamMatchCount[pair.home.id]++
          teamMatchCount[pair.away.id]++
          usedPairs.add(pairKey)
          matchesInSlot++
          break // この会場は割り当て完了
        }
      }

      // 連戦回避用: 現在のスロットのチームを次のスロット用に保存
      teamsInPrevSlot.clear()
      teamsInThisSlot.forEach(id => teamsInPrevSlot.add(id))

      if (dayMatches.length >= matchesPerDay) break
    }

    return dayMatches
  }

  // Day1の試合を生成
  const day1Matches = generateDayMatches(1, day1Date, allPairs)
  matches.push(...day1Matches)

  // Day2の試合を生成（残りのペアから、スコア再計算）
  const day2Pairs = allPairs.map(pair => ({
    ...pair,
    score: calculatePairScore(pair.home, pair.away, usedPairs, constraintScores)
  })).sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return Math.random() - 0.5
  })
  const day2Matches = generateDayMatches(2, day2Date, day2Pairs)
  matches.push(...day2Matches)

  // 各チームの試合数を確認
  const matchCountByTeam: Record<number, number> = {}
  matches.forEach(m => {
    matchCountByTeam[m.homeTeamId] = (matchCountByTeam[m.homeTeamId] || 0) + 1
    matchCountByTeam[m.awayTeamId] = (matchCountByTeam[m.awayTeamId] || 0) + 1
  })

  const matchesPerTeam = matchesPerTeamPerDay * 2 // 2日間で4試合

  // 試合数が足りないチームがあれば警告
  teams.forEach(team => {
    const count = matchCountByTeam[team.id] || 0
    if (count < matchesPerTeam) {
      warnings.push(`${team.name}の試合数が${count}試合です（${matchesPerTeam}試合必要）`)
    }
  })

  // 連戦チェック
  const consecutiveWarnings = checkConsecutiveMatchesInSchedule(matches, teams)
  if (consecutiveWarnings.length > 0) {
    warnings.push(...consecutiveWarnings)
  }

  return {
    success: matches.length > 0,
    matches,
    day1Matches,
    day2Matches,
    warnings,
    stats: {
      totalMatches: matches.length,
      matchesPerGroup: matches.length,
      matchesPerTeam,
    },
  }
}

/**
 * 1リーグ制の連戦チェック（全会場横断）
 * 同日に連続する枠で試合がないか確認
 */
function checkConsecutiveMatchesInSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  const warnings: string[] = []

  // 日ごとにチェック（グループではなく全会場横断）
  for (const day of [1, 2] as const) {
    const dayMatches = matches.filter(m => m.day === day)

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
          const team = teams.find(t => t.id === Number(teamId))
          const teamName = team?.shortName || team?.name || `チーム${teamId}`
          warnings.push(`Day${day}: ${teamName}が枠${slots[i]}と${slots[i + 1]}で連戦`)
        }
      }
    }
  }

  return warnings
}

/**
 * 1リーグ制の対戦表を検証
 * 注意: 1リーグ制は部分的な総当たりのため、この検証は使用しない
 */
export function validateSingleLeagueSchedule(matches: GeneratedMatch[], teams: TeamInfo[]): string[] {
  // 1リーグ制は各チーム4試合（2試合/日 × 2日）なので、
  // 完全総当たり(n-1試合)の検証は適用しない
  // 検証は generateSingleLeagueSchedule 内で行われる
  return []
}

// ============================================================================
// 制約付き会場配置最適化アルゴリズム
// ============================================================================

/**
 * チーム情報（制約チェック用）
 */
export interface TeamForAssignment {
  id: number
  name: string
  shortName?: string
  region?: string           // 地域（埼玉、東京など）
  leagueId?: number         // 所属リーグID
  teamType?: 'local' | 'invited'  // 地元校 or 招待校
}

/**
 * 制約スコア設定（DB設定に合わせた重み）
 */
export interface ConstraintScores {
  alreadyPlayed: number    // Day2再戦ペナルティ（デフォルト: 200）
  sameLeague: number       // 同リーグペナルティ（デフォルト: 100）
  sameRegion: number       // 同地域ペナルティ（デフォルト: 50）
  localTeams: number       // 地元同士ペナルティ（デフォルト: 30）
}

const DEFAULT_CONSTRAINT_SCORES: ConstraintScores = {
  alreadyPlayed: 200,
  sameLeague: 100,
  sameRegion: 50,
  localTeams: 30,
}

/**
 * 会場配置の最適化結果
 */
export interface VenueAssignmentResult {
  assignments: Map<number, TeamForAssignment[]>  // venueId -> teams
  score: number                                   // トータルコンフリクトスコア
  details: {
    sameLeaguePairs: number
    sameRegionPairs: number
    localVsLocalPairs: number
    day1RepeatPairs: number
  }
}

/**
 * 2チーム間のコンフリクトスコアを計算
 */
function calculatePairConflict(
  team1: TeamForAssignment,
  team2: TeamForAssignment,
  scores: ConstraintScores
): { score: number; sameLeague: boolean; sameRegion: boolean; localVsLocal: boolean } {
  let score = 0
  let sameLeague = false
  let sameRegion = false
  let localVsLocal = false

  // 同リーグチェック
  if (team1.leagueId && team2.leagueId && team1.leagueId === team2.leagueId) {
    score += scores.sameLeague
    sameLeague = true
  }

  // 同地域チェック
  if (team1.region && team2.region && team1.region === team2.region) {
    score += scores.sameRegion
    sameRegion = true
  }

  // 地元同士チェック
  if (team1.teamType === 'local' && team2.teamType === 'local') {
    score += scores.localTeams
    localVsLocal = true
  }

  return { score, sameLeague, sameRegion, localVsLocal }
}

/**
 * 会場配置のトータルスコアと詳細を計算
 * A戦ペアのみを対戦済みチェック対象とする
 */
function evaluateAssignment(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): { score: number; details: VenueAssignmentResult['details'] } {
  let totalScore = 0
  const details = {
    sameLeaguePairs: 0,
    sameRegionPairs: 0,
    localVsLocalPairs: 0,
    day1RepeatPairs: 0,
  }

  // A戦ペアのインデックス（スロット順での位置）
  // A戦: (0,1), (2,3), (1,2), (0,3)
  // B戦: (0,2), (1,3) は除外
  const aMatchPairIndices: [number, number][] = [
    [0, 1], [2, 3], [1, 2], [0, 3]
  ]

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    // A戦ペアのみを評価
    for (const [i, j] of aMatchPairIndices) {
      const conflict = calculatePairConflict(teams[i], teams[j], scores)
      totalScore += conflict.score
      if (conflict.sameLeague) details.sameLeaguePairs++
      if (conflict.sameRegion) details.sameRegionPairs++
      if (conflict.localVsLocal) details.localVsLocalPairs++

      // Day2の場合、Day1でのA戦対戦ペアをチェック
      if (day1Opponents) {
        const team1Opponents = day1Opponents.get(teams[i].id)
        if (team1Opponents?.has(teams[j].id)) {
          totalScore += scores.alreadyPlayed
          details.day1RepeatPairs++
        }
      }
    }
  }

  return { score: totalScore, details }
}

/**
 * Day1のA戦対戦相手マップを構築
 * B戦は対戦済みとしてカウントしない
 *
 * 4チームラウンドロビンの対戦パターン（スロット順）:
 * - A戦: (1vs2), (3vs4), (2vs3), (1vs4) → 対戦済みとしてカウント
 * - B戦: (1vs3), (2vs4) → カウントしない
 */
function buildDay1OpponentsMap(
  day1Assignments: Map<number, TeamForAssignment[]>
): Map<number, Set<number>> {
  const opponents = new Map<number, Set<number>>()

  // A戦の対戦ペア（スロット順での位置: 1vs2, 3vs4, 2vs3, 1vs4）
  // B戦は (1vs3), (2vs4) なので除外
  const aMatchPairs: [number, number][] = [
    [0, 1], // チーム1 vs チーム2
    [2, 3], // チーム3 vs チーム4
    [1, 2], // チーム2 vs チーム3
    [0, 3], // チーム1 vs チーム4
  ]

  for (const [, teams] of day1Assignments) {
    if (teams.length < 4) continue

    // 各チームの対戦相手をA戦のみで記録
    for (const [idx1, idx2] of aMatchPairs) {
      const team1 = teams[idx1]
      const team2 = teams[idx2]

      if (!opponents.has(team1.id)) {
        opponents.set(team1.id, new Set())
      }
      if (!opponents.has(team2.id)) {
        opponents.set(team2.id, new Set())
      }

      opponents.get(team1.id)!.add(team2.id)
      opponents.get(team2.id)!.add(team1.id)
    }
  }

  return opponents
}

/**
 * ランダムな初期配置を生成
 */
function randomInitialAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number
): Map<number, TeamForAssignment[]> {
  const shuffled = [...teams].sort(() => Math.random() - 0.5)
  const assignments = new Map<number, TeamForAssignment[]>()

  let teamIndex = 0
  for (const venueId of venueIds) {
    const venueTeams: TeamForAssignment[] = []
    for (let i = 0; i < teamsPerVenue && teamIndex < shuffled.length; i++) {
      venueTeams.push(shuffled[teamIndex++])
    }
    assignments.set(venueId, venueTeams)
  }

  return assignments
}

/**
 * 貪欲法による初期配置生成
 */
function greedyAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()
  venueIds.forEach(id => assignments.set(id, []))

  const remainingTeams = [...teams]

  for (const venueId of venueIds) {
    const venueTeams = assignments.get(venueId)!

    while (venueTeams.length < teamsPerVenue && remainingTeams.length > 0) {
      let bestTeamIndex = 0
      let bestScore = Infinity

      for (let i = 0; i < remainingTeams.length; i++) {
        const candidate = remainingTeams[i]
        let score = 0

        // 既配置チームとのコンフリクト
        for (const existingTeam of venueTeams) {
          score += calculatePairConflict(candidate, existingTeam, scores).score

          // Day2: Day1対戦相手との重複
          if (day1Opponents) {
            const candidateOpponents = day1Opponents.get(candidate.id)
            if (candidateOpponents?.has(existingTeam.id)) {
              score += scores.alreadyPlayed
            }
          }
        }

        if (score < bestScore) {
          bestScore = score
          bestTeamIndex = i
        }
      }

      venueTeams.push(remainingTeams[bestTeamIndex])
      remainingTeams.splice(bestTeamIndex, 1)
    }
  }

  return assignments
}

/**
 * 同一会場内でのスロット入れ替えによる最適化
 * 制約違反ペアをB戦スロットに移動することで解消を試みる
 *
 * スロット順でのA戦/B戦ペア:
 * - A戦: (0,1), (2,3), (1,2), (0,3) → 制約チェック対象
 * - B戦: (0,2), (1,3) → 制約チェック対象外
 */
function optimizeIntraVenueSlots(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): Map<number, TeamForAssignment[]> {
  for (const [venueId, teams] of assignments) {
    if (teams.length !== 4) continue

    // 4チームの全順列を試す（4! = 24通り）
    const permutations = generatePermutations([0, 1, 2, 3])
    let bestOrder = [0, 1, 2, 3]
    let bestScore = evaluateVenueScore(teams, bestOrder, scores, day1Opponents)

    for (const perm of permutations) {
      const score = evaluateVenueScore(teams, perm, scores, day1Opponents)
      if (score < bestScore) {
        bestScore = score
        bestOrder = perm
      }
    }

    // 最良の順序に並び替え
    if (bestOrder.join(',') !== '0,1,2,3') {
      const reordered = bestOrder.map(i => teams[i])
      assignments.set(venueId, reordered)
    }
  }

  return assignments
}

/**
 * 会場内のスコアを計算（特定の順序で）
 */
function evaluateVenueScore(
  teams: TeamForAssignment[],
  order: number[],
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>
): number {
  // A戦ペアのインデックス（順序適用後）
  const aMatchPairIndices: [number, number][] = [
    [0, 1], [2, 3], [1, 2], [0, 3]
  ]

  let score = 0
  for (const [i, j] of aMatchPairIndices) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]

    score += calculatePairConflict(team1, team2, scores).score

    if (day1Opponents) {
      const team1Opponents = day1Opponents.get(team1.id)
      if (team1Opponents?.has(team2.id)) {
        score += scores.alreadyPlayed
      }
    }
  }

  return score
}

/**
 * 配列の全順列を生成
 */
function generatePermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]

  const result: number[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    const perms = generatePermutations(rest)
    for (const perm of perms) {
      result.push([arr[i], ...perm])
    }
  }
  return result
}

/**
 * 局所最適化（会場間スワップによる改善）
 */
function optimizeBySwap(
  assignments: Map<number, TeamForAssignment[]>,
  scores: ConstraintScores,
  day1Opponents?: Map<number, Set<number>>,
  maxIterations: number = 50
): Map<number, TeamForAssignment[]> {
  const venueIds = Array.from(assignments.keys())
  let improved = true
  let iterations = 0

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    // 1. まず会場内スロット最適化を実行
    optimizeIntraVenueSlots(assignments, scores, day1Opponents)

    // 2. 会場間スワップを試行
    for (let v1 = 0; v1 < venueIds.length; v1++) {
      for (let v2 = v1 + 1; v2 < venueIds.length; v2++) {
        const venue1Teams = assignments.get(venueIds[v1])!
        const venue2Teams = assignments.get(venueIds[v2])!

        for (let t1 = 0; t1 < venue1Teams.length; t1++) {
          for (let t2 = 0; t2 < venue2Teams.length; t2++) {
            const currentScore = evaluateAssignment(assignments, scores, day1Opponents).score

            // スワップ
            const temp = venue1Teams[t1]
            venue1Teams[t1] = venue2Teams[t2]
            venue2Teams[t2] = temp

            // スワップ後、両会場の内部スロットも最適化
            optimizeIntraVenueSlots(assignments, scores, day1Opponents)

            const newScore = evaluateAssignment(assignments, scores, day1Opponents).score

            if (newScore < currentScore) {
              improved = true
            } else {
              // 元に戻す
              venue2Teams[t2] = venue1Teams[t1]
              venue1Teams[t1] = temp
              // 元に戻した後も内部スロット最適化
              optimizeIntraVenueSlots(assignments, scores, day1Opponents)
            }
          }
        }
      }
    }
  }

  return assignments
}

/**
 * Deep copy of assignments
 */
function cloneAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Map<number, TeamForAssignment[]> {
  const clone = new Map<number, TeamForAssignment[]>()
  for (const [venueId, teams] of assignments) {
    clone.set(venueId, [...teams])
  }
  return clone
}

/**
 * 制約を考慮した最適な会場配置を生成（Multi-start）
 */
export function generateOptimalVenueAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number = 4,
  scores: ConstraintScores = DEFAULT_CONSTRAINT_SCORES,
  day1Assignments?: Map<number, TeamForAssignment[]>,
  numRestarts: number = 5
): VenueAssignmentResult {
  console.log('[VenueOptimization] Starting with', teams.length, 'teams,', venueIds.length, 'venues')

  const day1Opponents = day1Assignments ? buildDay1OpponentsMap(day1Assignments) : undefined

  let bestAssignment: Map<number, TeamForAssignment[]> | null = null
  let bestScore = Infinity
  let bestDetails: VenueAssignmentResult['details'] | null = null

  for (let restart = 0; restart < numRestarts; restart++) {
    // 初期配置（最初は貪欲法、以降はランダム）
    let assignment: Map<number, TeamForAssignment[]>
    if (restart === 0) {
      assignment = greedyAssignment(teams, venueIds, teamsPerVenue, scores, day1Opponents)
    } else {
      assignment = randomInitialAssignment(teams, venueIds, teamsPerVenue)
    }

    // 局所最適化
    assignment = optimizeBySwap(assignment, scores, day1Opponents)

    // 評価
    const { score, details } = evaluateAssignment(assignment, scores, day1Opponents)

    if (score < bestScore) {
      bestScore = score
      bestAssignment = cloneAssignments(assignment)
      bestDetails = details
    }

    // スコア0なら最適解
    if (score === 0) break
  }

  console.log('[VenueOptimization] Best score:', bestScore, bestDetails)

  return {
    assignments: bestAssignment!,
    score: bestScore,
    details: bestDetails!,
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
        matchDay,
        slotOrder: index + 1,
      })
    })
  }

  return result
}

// ============================================================================
// 会場配置ベースの日程生成（1リーグ制・新方式）
// ============================================================================

export interface VenueAssignmentInfo {
  venueId: number
  venueName: string
  teamId: number
  teamName: string
  teamShortName?: string
  matchDay: number
  slotOrder: number
}

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

/**
 * 4チームの総当たり対戦パターン（6試合）
 *
 * 制約:
 * - スロット3,6がB戦（順位計算対象外）
 * - 各チームは2A戦 + 1B戦/日
 * - B戦2試合で4チーム全員を1回ずつカバー（完全マッチング）
 *
 * 完全マッチングの選択肢:
 *   A: (1vs2) + (3vs4)
 *   B: (1vs3) + (2vs4) ← 採用
 *   C: (1vs4) + (2vs3)
 *
 * 検証:
 *   チーム1: vs2(A), vs3(B), vs4(A) → 2A + 1B ✓
 *   チーム2: vs1(A), vs3(A), vs4(B) → 2A + 1B ✓
 *   チーム3: vs4(A), vs1(B), vs2(A) → 2A + 1B ✓
 *   チーム4: vs3(A), vs1(A), vs2(B) → 2A + 1B ✓
 */
const FOUR_TEAM_MATCH_PATTERN: { slot: number; home: number; away: number; isBMatch: boolean }[] = [
  { slot: 1, home: 1, away: 2, isBMatch: false }, // A戦: チーム1 vs チーム2
  { slot: 2, home: 3, away: 4, isBMatch: false }, // A戦: チーム3 vs チーム4
  { slot: 3, home: 1, away: 3, isBMatch: true },  // B戦: チーム1 vs チーム3 ← 完全マッチング
  { slot: 4, home: 2, away: 3, isBMatch: false }, // A戦: チーム2 vs チーム3
  { slot: 5, home: 1, away: 4, isBMatch: false }, // A戦: チーム1 vs チーム4
  { slot: 6, home: 2, away: 4, isBMatch: true },  // B戦: チーム2 vs チーム4 ← 完全マッチング
]

/**
 * 会場配置ベースの日程生成（1リーグ制・新方式）
 *
 * 設計:
 * - 各会場に4チームを配置
 * - 会場内で総当たり（6試合 = 各チーム3試合）
 * - 3,4試合目はB戦（順位計算対象外）
 * - Day1とDay2で異なる会場配置
 * - 同日の会場移動なし
 *
 * @param day1Assignments Day1の会場配置
 * @param day2Assignments Day2の会場配置
 * @param venues 会場一覧
 * @param day1Date Day1の日付
 * @param day2Date Day2の日付
 * @param config 設定
 */
export function generateVenueBasedSchedule(
  day1Assignments: VenueAssignmentInfo[],
  day2Assignments: VenueAssignmentInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string,
  config?: ScheduleConfig
): VenueBasedScheduleResult {
  const warnings: string[] = []
  const matches: GeneratedMatchWithBMatch[] = []
  let matchOrder = 1

  // 設定値を取得
  const startTime = config?.startTime || DEFAULT_START_TIME
  const matchDuration = config?.matchDuration || DEFAULT_MATCH_DURATION
  const interval = config?.intervalMinutes || DEFAULT_INTERVAL

  // キックオフ時刻を生成（1会場6試合）
  const kickoffTimes = generateKickoffTimes(startTime, matchDuration, interval, 6)

  console.log('[VenueBased] 設定:', { startTime, matchDuration, interval })
  console.log('[VenueBased] キックオフ時刻:', kickoffTimes)

  // 1日分の試合を生成する関数
  const generateDayMatches = (
    assignments: VenueAssignmentInfo[],
    day: 1 | 2,
    matchDate: string
  ): GeneratedMatchWithBMatch[] => {
    const dayMatches: GeneratedMatchWithBMatch[] = []

    // 会場ごとにグループ化
    const venueGroups = new Map<number, VenueAssignmentInfo[]>()
    for (const assignment of assignments) {
      if (!venueGroups.has(assignment.venueId)) {
        venueGroups.set(assignment.venueId, [])
      }
      venueGroups.get(assignment.venueId)!.push(assignment)
    }

    // 各会場で試合を生成
    for (const [venueId, venueTeams] of venueGroups) {
      // slotOrder順にソート
      venueTeams.sort((a, b) => a.slotOrder - b.slotOrder)

      const venue = venues.find(v => v.id === venueId)
      const venueName = venue?.name || venueTeams[0]?.venueName || `会場${venueId}`

      // チーム数チェック
      if (venueTeams.length !== 4) {
        warnings.push(`Day${day} 会場${venueName}: チーム数が${venueTeams.length}です（4チーム必要）`)
        if (venueTeams.length < 2) continue
      }

      // 4チームの総当たりパターンで試合を生成
      for (const pattern of FOUR_TEAM_MATCH_PATTERN) {
        const homeTeam = venueTeams[pattern.home - 1]
        const awayTeam = venueTeams[pattern.away - 1]

        if (!homeTeam || !awayTeam) {
          warnings.push(`Day${day} 会場${venueName} 枠${pattern.slot}: チームが不足`)
          continue
        }

        dayMatches.push({
          homeTeamId: homeTeam.teamId,
          awayTeamId: awayTeam.teamId,
          homeTeamName: homeTeam.teamShortName || homeTeam.teamName,
          awayTeamName: awayTeam.teamShortName || awayTeam.teamName,
          groupId: null as any, // 1リーグ制ではnull
          venueId: venueId,
          venueName: venueName,
          matchDate,
          matchTime: kickoffTimes[pattern.slot - 1] || kickoffTimes[kickoffTimes.length - 1],
          matchOrder: matchOrder++,
          day,
          slot: pattern.slot,
          isBMatch: pattern.isBMatch,
        })
      }
    }

    return dayMatches
  }

  // Day1の試合を生成
  if (day1Assignments.length === 0) {
    warnings.push('Day1の会場配置がありません')
  } else {
    const day1Matches = generateDayMatches(day1Assignments, 1, day1Date)
    matches.push(...day1Matches)
  }

  // Day2の試合を生成
  if (day2Assignments.length === 0) {
    warnings.push('Day2の会場配置がありません')
  } else {
    const day2Matches = generateDayMatches(day2Assignments, 2, day2Date)
    matches.push(...day2Matches)
  }

  // 統計計算
  const aMatches = matches.filter(m => !m.isBMatch).length
  const bMatches = matches.filter(m => m.isBMatch).length

  // 各チームの試合数を確認
  const matchCountByTeam: Record<number, { a: number; b: number }> = {}
  matches.forEach(m => {
    if (!matchCountByTeam[m.homeTeamId]) matchCountByTeam[m.homeTeamId] = { a: 0, b: 0 }
    if (!matchCountByTeam[m.awayTeamId]) matchCountByTeam[m.awayTeamId] = { a: 0, b: 0 }
    if (m.isBMatch) {
      matchCountByTeam[m.homeTeamId].b++
      matchCountByTeam[m.awayTeamId].b++
    } else {
      matchCountByTeam[m.homeTeamId].a++
      matchCountByTeam[m.awayTeamId].a++
    }
  })

  // 試合数が足りないチームを警告
  for (const [teamId, counts] of Object.entries(matchCountByTeam)) {
    if (counts.a < 4) {
      const team = [...day1Assignments, ...day2Assignments].find(a => a.teamId === Number(teamId))
      const teamName = team?.teamShortName || team?.teamName || `チーム${teamId}`
      warnings.push(`${teamName}: A戦が${counts.a}試合（4試合必要）`)
    }
  }

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
      aMatches,
      bMatches,
      matchesPerTeam: 6, // 3試合/日 × 2日
    },
  }
}
