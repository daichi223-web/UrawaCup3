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
// 制約付き会場配置最適化アルゴリズム (Anchor-Pod CP)
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
  isHost?: boolean          // 会場ホストフラグ
  hostVenueId?: number      // ホストの場合、その会場ID
}

// ============================================================================
// Pod Plan 計算（3/4/5チームのPod構成）
// ============================================================================

/**
 * PodPlan: 会場ごとのチーム数（3, 4, or 5）を決定
 *
 * 条件: 3a + 4b + 5c = N, a + b + c = V
 *
 * 例: N=24, V=6 → 4×6=24 (a=0, b=6, c=0)
 * 例: N=20, V=5 → 4×5=20 (a=0, b=5, c=0)
 * 例: N=19, V=5 → 3×1 + 4×4=19 (a=1, b=4, c=0)
 * 例: N=17, V=4 → 4×2 + 5×2=18 NG → 3×1 + 4×1 + 5×2=17? (3+4+10=17, V=4 NG)
 *              → 実際は 3×3 + 4×2=17 NG (V=5) → 調整必要
 */
export interface PodPlan {
  pod3Count: number  // 3チームのPod数
  pod4Count: number  // 4チームのPod数
  pod5Count: number  // 5チームのPod数
  totalVenues: number
  totalTeams: number
}

/**
 * N（チーム数）とV（会場数）からPodPlanを計算
 * 解がない場合はエラーをスロー
 */
export function computePodPlanOrThrow(N: number, V: number): PodPlan {
  // 3a + 4b + 5c = N, a + b + c = V
  // → c = N - 3V + a (from 3a + 4b + 5c = N and a + b + c = V)
  // → b = V - a - c = V - a - (N - 3V + a) = 4V - N - 2a

  // 全探索（V <= 10程度なので問題なし）
  for (let a = 0; a <= V; a++) {
    for (let c = 0; c <= V - a; c++) {
      const b = V - a - c
      if (b < 0) continue

      const sum = 3 * a + 4 * b + 5 * c
      if (sum === N) {
        return {
          pod3Count: a,
          pod4Count: b,
          pod5Count: c,
          totalVenues: V,
          totalTeams: N,
        }
      }
    }
  }

  throw new Error(`PodPlan計算失敗: N=${N}, V=${V} の組み合わせに解がありません`)
}

/**
 * PodPlanから各会場のPodサイズ配列を生成
 * 例: {pod3Count: 1, pod4Count: 4, pod5Count: 0} → [3, 4, 4, 4, 4]
 */
export function getPodSizes(plan: PodPlan): number[] {
  const sizes: number[] = []
  for (let i = 0; i < plan.pod3Count; i++) sizes.push(3)
  for (let i = 0; i < plan.pod4Count; i++) sizes.push(4)
  for (let i = 0; i < plan.pod5Count; i++) sizes.push(5)
  return sizes
}

// ============================================================================
// Day1 A戦ペア抽出（Day2の禁止ペアとして使用）
// ============================================================================

/**
 * ペアキーを生成（小さいID-大きいID）
 */
export function makePairKey(id1: number, id2: number): string {
  return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`
}

/**
 * GeneratedMatchWithBMatchからDay1のA戦ペアを抽出
 * @param matches 生成された試合一覧
 * @returns Day1 A戦の対戦ペアSet
 */
export function extractDay1AMatchPairs(
  matches: GeneratedMatchWithBMatch[]
): Set<string> {
  const pairs = new Set<string>()

  for (const m of matches) {
    // Day1 かつ A戦のみ
    if (m.day === 1 && !m.isBMatch) {
      pairs.add(makePairKey(m.homeTeamId, m.awayTeamId))
    }
  }

  return pairs
}

/**
 * GeneratedMatchWithBMatchからDay1のB戦ペアを抽出
 * @param matches 生成された試合一覧
 * @returns Day1 B戦の対戦ペアSet
 */
export function extractDay1BMatchPairs(
  matches: GeneratedMatchWithBMatch[]
): Set<string> {
  const pairs = new Set<string>()

  for (const m of matches) {
    // Day1 かつ B戦のみ
    if (m.day === 1 && m.isBMatch) {
      pairs.add(makePairKey(m.homeTeamId, m.awayTeamId))
    }
  }

  return pairs
}

/**
 * 会場配置MapからA戦ペアを抽出
 * @param assignments 会場配置Map
 * @returns A戦の対戦ペアSet
 */
export function extractAMatchPairsFromAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Set<string> {
  const pairs = new Set<string>()

  // A戦の対戦ペア（スロット順での位置: 1vs2, 3vs4, 2vs3, 1vs4）
  const aMatchPairIndices: [number, number][] = [
    [0, 1], // チーム1 vs チーム2
    [2, 3], // チーム3 vs チーム4
    [1, 2], // チーム2 vs チーム3
    [0, 3], // チーム1 vs チーム4
  ]

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    for (const [idx1, idx2] of aMatchPairIndices) {
      if (idx1 < teams.length && idx2 < teams.length) {
        pairs.add(makePairKey(teams[idx1].id, teams[idx2].id))
      }
    }
  }

  return pairs
}

/**
 * 会場配置MapからB戦ペアを抽出
 * @param assignments 会場配置Map
 * @returns B戦の対戦ペアSet
 */
export function extractBMatchPairsFromAssignments(
  assignments: Map<number, TeamForAssignment[]>
): Set<string> {
  const pairs = new Set<string>()

  // B戦の対戦ペア（パターンB: 1vs3, 2vs4）
  const bMatchPairIndices: [number, number][] = [
    [0, 2], // チーム1 vs チーム3
    [1, 3], // チーム2 vs チーム4
  ]

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    for (const [idx1, idx2] of bMatchPairIndices) {
      if (idx1 < teams.length && idx2 < teams.length) {
        pairs.add(makePairKey(teams[idx1].id, teams[idx2].id))
      }
    }
  }

  return pairs
}

// ============================================================================
// 辞書式スコアリング（Lexicographic Scoring）
// ============================================================================

/**
 * 辞書式優先度でのペア評価結果
 * 優先順位: sameLeague > sameRegion > localVsLocal
 */
export interface LexPairScore {
  sameLeague: number    // 同リーグペア数
  sameRegion: number    // 同地域ペア数
  localVsLocal: number  // 地元同士ペア数
  day1Repeat: number    // Day1再戦ペア数（ハード制約）
}

/**
 * 辞書式スコアを単一の数値にエンコード
 * 上位ビットほど優先度が高い
 *
 * エンコード方式: day1Repeat * 10^9 + sameLeague * 10^6 + sameRegion * 10^3 + localVsLocal
 */
export function encodeLexToScore(lex: LexPairScore): number {
  return (
    lex.day1Repeat * 1_000_000_000 +
    lex.sameLeague * 1_000_000 +
    lex.sameRegion * 1_000 +
    lex.localVsLocal
  )
}

/**
 * A戦 + B戦を含む辞書式スコアをエンコード
 * B戦はA戦より低い優先度（小数点以下）でタイブレーカーとして使用
 */
export function encodeLexToScoreWithBMatch(lex: LexPairScoreWithBMatch): number {
  // A戦部分（整数）
  const aMatchScore = (
    lex.day1Repeat * 1_000_000_000 +
    lex.sameLeague * 1_000_000 +
    lex.sameRegion * 1_000 +
    lex.localVsLocal
  )
  // B戦部分（小数点以下 = A戦優先のタイブレーカー）
  // B戦内の優先度: sameLeague > sameRegion > localVsLocal
  const bMatchScore = (
    lex.bMatchSameLeague * 0.0001 +
    lex.bMatchSameRegion * 0.00001 +
    lex.bMatchLocalVsLocal * 0.000001
  )
  return aMatchScore + bMatchScore
}

/**
 * 2チーム間の辞書式制約を評価
 */
function evaluatePairLex(
  team1: TeamForAssignment,
  team2: TeamForAssignment,
  bannedPairs?: Set<string>
): LexPairScore {
  const result: LexPairScore = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
  }

  // Day1再戦チェック（ハード制約）
  if (bannedPairs) {
    const pairKey = makePairKey(team1.id, team2.id)
    if (bannedPairs.has(pairKey)) {
      result.day1Repeat = 1
    }
  }

  // 同リーグチェック
  if (team1.leagueId && team2.leagueId && team1.leagueId === team2.leagueId) {
    result.sameLeague = 1
  }

  // 同地域チェック
  if (team1.region && team2.region && team1.region === team2.region) {
    result.sameRegion = 1
  }

  // 地元同士チェック
  if (team1.teamType === 'local' && team2.teamType === 'local') {
    result.localVsLocal = 1
  }

  return result
}

/**
 * 会場配置の辞書式スコアを計算（A戦のみ）
 */
interface LexPairScoreWithBMatch extends LexPairScore {
  bMatchSameLeague: number
  bMatchSameRegion: number
  bMatchLocalVsLocal: number
}

/**
 * 会場配置を評価
 *
 * 設計思想:
 * - A戦とB戦を別々に評価
 * - day1Repeat は A戦同士、B戦同士でのみカウント
 * - sameLeague, sameRegion, localVsLocal は両方で同じ基準
 *
 * @param assignments 会場配置
 * @param bannedAMatchPairs Day1 A戦ペア（Day2 A戦のday1Repeat用）
 * @param bannedBMatchPairs Day1 B戦ペア（Day2 B戦のday1Repeat用）
 */
function evaluateAssignmentLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>
): LexPairScoreWithBMatch {
  const total: LexPairScoreWithBMatch = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
    bMatchSameLeague: 0,
    bMatchSameRegion: 0,
    bMatchLocalVsLocal: 0,
  }

  // A戦ペアのインデックス（パターンB）
  const aMatchPairIndices: [number, number][] = [
    [0, 1], [2, 3], [1, 2], [0, 3]
  ]
  // B戦ペアのインデックス（パターンB）
  const bMatchPairIndices: [number, number][] = [
    [0, 2], [1, 3]
  ]

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    // A戦評価（bannedAMatchPairs を使用）
    for (const [i, j] of aMatchPairIndices) {
      if (i < teams.length && j < teams.length) {
        const pairLex = evaluatePairLex(teams[i], teams[j], bannedAMatchPairs)
        total.sameLeague += pairLex.sameLeague
        total.sameRegion += pairLex.sameRegion
        total.localVsLocal += pairLex.localVsLocal
        total.day1Repeat += pairLex.day1Repeat
      }
    }

    // B戦評価（bannedBMatchPairs を使用）
    for (const [i, j] of bMatchPairIndices) {
      if (i < teams.length && j < teams.length) {
        const pairLex = evaluatePairLex(teams[i], teams[j], bannedBMatchPairs)
        total.bMatchSameLeague += pairLex.sameLeague
        total.bMatchSameRegion += pairLex.sameRegion
        total.bMatchLocalVsLocal += pairLex.localVsLocal
        // B戦のday1Repeat も total.day1Repeat に加算（B戦同士の重複）
        total.day1Repeat += pairLex.day1Repeat
      }
    }
  }

  return total
}

// ============================================================================
// ホストアンカー付き貪欲配置
// ============================================================================

/**
 * ホストチームをアンカーとして配置し、残りを貪欲に配置
 */
function buildAssignmentsGreedyWithHosts(
  teams: TeamForAssignment[],
  venueIds: number[],
  podSizes: number[],
  bannedPairs?: Set<string>
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()

  // 会場ごとに初期化
  venueIds.forEach((id, idx) => {
    assignments.set(id, [])
  })

  // 配置済みチームを追跡
  const placedTeamIds = new Set<number>()

  // ホストチームを先に配置
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const hostTeam = teams.find(t => t.isHost && t.hostVenueId === venueId)

    if (hostTeam && !placedTeamIds.has(hostTeam.id)) {
      assignments.get(venueId)!.push(hostTeam)
      placedTeamIds.add(hostTeam.id)
    }
  }

  console.log(`[Greedy] ホスト配置完了: ${placedTeamIds.size}チーム, 残り: ${teams.length - placedTeamIds.size}チーム`)

  // 会場ごとに残りの枠を埋める
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const venueTeams = assignments.get(venueId)!
    const targetSize = podSizes[idx] || 4

    while (venueTeams.length < targetSize) {
      let bestTeam: TeamForAssignment | null = null
      let bestScore = Infinity

      for (const candidate of teams) {
        // 既に配置済みのチームはスキップ
        if (placedTeamIds.has(candidate.id)) continue

        let score = 0

        // 既配置チームとの制約スコア
        for (const existingTeam of venueTeams) {
          const pairLex = evaluatePairLex(candidate, existingTeam, bannedPairs)
          score += encodeLexToScore(pairLex)
        }

        if (score < bestScore) {
          bestScore = score
          bestTeam = candidate
        }
      }

      if (!bestTeam) {
        console.error(`[Greedy] 会場${venueId}: 配置可能なチームがありません (現在${venueTeams.length}/${targetSize})`)
        break
      }

      venueTeams.push(bestTeam)
      placedTeamIds.add(bestTeam.id)
    }
  }

  console.log(`[Greedy] 配置完了: 合計${placedTeamIds.size}チーム配置`)

  return assignments
}

// デフォルトの制約スコア設定（DB設定に合わせた重み）
const DEFAULT_CONSTRAINT_SCORES: Required<ConstraintScores> = {
  alreadyPlayed: 200,
  sameLeague: 100,
  sameRegion: 50,
  localTeams: 30,
  consecutiveMatch: 20,
}

/**
 * 会場配置の最適化結果
 */
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
 * A戦を優先、B戦も副次的に評価（制約解消のため）
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
    // B戦の制約（参考情報）
    bMatchSameLeaguePairs: 0,
    bMatchSameRegionPairs: 0,
    bMatchLocalVsLocalPairs: 0,
  }

  // A戦ペアのインデックス（スロット順での位置）
  const aMatchPairIndices: [number, number][] = [
    [0, 1], [2, 3], [1, 2], [0, 3]
  ]
  // B戦ペアのインデックス
  const bMatchPairIndices: [number, number][] = [
    [0, 2], [1, 3]
  ]

  // B戦の重み（A戦優先のタイブレーカー）
  const bMatchWeight = 0.1

  for (const [, teams] of assignments) {
    if (teams.length < 4) continue

    // A戦ペアを評価（フルウェイト）
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

    // B戦ペアを評価（低ウェイト = タイブレーカー）
    for (const [i, j] of bMatchPairIndices) {
      const conflict = calculatePairConflict(teams[i], teams[j], scores)
      totalScore += conflict.score * bMatchWeight

      // B戦の制約カウント（参考情報）
      if (conflict.sameLeague) details.bMatchSameLeaguePairs++
      if (conflict.sameRegion) details.bMatchSameRegionPairs++
      if (conflict.localVsLocal) details.bMatchLocalVsLocalPairs++

      // Day2の場合、Day1でのA戦対戦ペアをチェック（B戦でも低ウェイトで考慮）
      if (day1Opponents) {
        const team1Opponents = day1Opponents.get(teams[i].id)
        if (team1Opponents?.has(teams[j].id)) {
          totalScore += scores.alreadyPlayed * bMatchWeight
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
 * A戦の制約を優先、B戦の制約も副次的に考慮
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
  // B戦ペアのインデックス
  const bMatchPairIndices: [number, number][] = [
    [0, 2], [1, 3]
  ]

  let score = 0

  // A戦の制約スコア（フルウェイト）
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

  // B戦の制約スコア（0.1倍の重み = A戦優先のタイブレーカー）
  // B戦同士の入れ替えで制約が外せる場合に対応
  const bMatchWeight = 0.1
  for (const [i, j] of bMatchPairIndices) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]

    score += calculatePairConflict(team1, team2, scores).score * bMatchWeight

    if (day1Opponents) {
      const team1Opponents = day1Opponents.get(team1.id)
      if (team1Opponents?.has(team2.id)) {
        score += scores.alreadyPlayed * bMatchWeight
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
 * 制約を考慮した最適な会場配置を生成（Anchor-Pod CP アルゴリズム）
 *
 * 新アルゴリズム:
 * - ホストチームは自会場にアンカー（移動しない）
 * - PodPlan で各会場のチーム数を決定（3/4/5チーム）
 * - 辞書式評価: Day1再戦 > 同リーグ > 同地域 > 地元同士
 * - Multi-start + 局所スワップで最適化
 *
 * @param teams チーム一覧（isHost, hostVenueId フラグ付き）
 * @param venueIds 会場ID一覧
 * @param teamsPerVenue デフォルトのPodサイズ（PodPlanで上書き可能）
 * @param scores 重み付きスコア（後方互換性のため残す）
 * @param day1Assignments Day1の配置（Day2生成時に使用）
 * @param numRestarts Multi-startの試行回数
 * @param bannedAMatchPairs Day1 A戦ペア（Day2 A戦のハード制約）
 * @param bannedBMatchPairs Day1 B戦ペア（Day2 B戦のハード制約）
 */
export function generateOptimalVenueAssignment(
  teams: TeamForAssignment[],
  venueIds: number[],
  teamsPerVenue: number = 4,
  scores: ConstraintScores = DEFAULT_CONSTRAINT_SCORES,
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

  // PodPlan計算を試みる（失敗時は均等配置）
  let podSizes: number[]
  try {
    const plan = computePodPlanOrThrow(teams.length, venueIds.length)
    podSizes = getPodSizes(plan)
    console.log('[VenueOptimization] PodPlan:', plan, '-> sizes:', podSizes)
  } catch (e) {
    // PodPlanが計算できない場合は均等配置
    podSizes = venueIds.map(() => teamsPerVenue)
    console.log('[VenueOptimization] PodPlan failed, using uniform size:', teamsPerVenue)
  }

  let bestAssignment: Map<number, TeamForAssignment[]> | null = null
  let bestLexScore: LexPairScoreWithBMatch | null = null
  let bestEncodedScore = Infinity

  for (let restart = 0; restart < numRestarts; restart++) {
    // 初期配置
    let assignment: Map<number, TeamForAssignment[]>

    if (restart === 0) {
      // 最初はホストアンカー付き貪欲法（A戦制約を優先）
      assignment = buildAssignmentsGreedyWithHosts(teams, venueIds, podSizes, effectiveBannedAMatchPairs)
    } else {
      // 以降はランダム（ホストは維持）
      assignment = randomInitialAssignmentWithHosts(teams, venueIds, podSizes)
    }

    // 会場内スロット最適化（辞書式）
    optimizeIntraVenueSlotsLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)

    // 会場間スワップ最適化（辞書式）
    assignment = optimizeBySwapLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)

    // 評価
    const lexScore = evaluateAssignmentLex(assignment, effectiveBannedAMatchPairs, effectiveBannedBMatchPairs)
    const encodedScore = encodeLexToScore(lexScore)

    if (encodedScore < bestEncodedScore) {
      bestEncodedScore = encodedScore
      bestAssignment = cloneAssignments(assignment)
      bestLexScore = lexScore
    }

    // Day1再戦がなく、同リーグもなければ良い解
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

  // デバッグ: 各会場の配置チームとB戦ペアを出力
  if (bestAssignment) {
    const bMatchPairs = [[0, 2], [1, 3]]
    for (const [venueId, teams] of bestAssignment) {
      const teamInfo = teams.map(t => `${t.id}:${t.shortName || t.name}${t.teamType === 'local' ? '(地)' : ''}`).join(', ')
      // B戦ペアの地元同士チェック
      const bMatchConflicts = bMatchPairs.map(([i, j]) => {
        const isLocalVsLocal = teams[i]?.teamType === 'local' && teams[j]?.teamType === 'local'
        return isLocalVsLocal ? `${teams[i].shortName || teams[i].name}vs${teams[j].shortName || teams[j].name}(地)` : null
      }).filter(Boolean)
      if (bMatchConflicts.length > 0) {
        console.log(`[VenueOptimization] 会場${venueId}: [${teamInfo}] ⚠B戦地元: ${bMatchConflicts.join(', ')}`)
      } else {
        console.log(`[VenueOptimization] 会場${venueId}: [${teamInfo}]`)
      }
    }
  }

  // 後方互換性のための details 変換
  const details: VenueAssignmentResult['details'] = {
    sameLeaguePairs: bestLexScore?.sameLeague || 0,
    sameRegionPairs: bestLexScore?.sameRegion || 0,
    localVsLocalPairs: bestLexScore?.localVsLocal || 0,
    day1RepeatPairs: bestLexScore?.day1Repeat || 0,
    // B戦制約も追加
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
 * ホストを維持したランダム初期配置
 */
function randomInitialAssignmentWithHosts(
  teams: TeamForAssignment[],
  venueIds: number[],
  podSizes: number[]
): Map<number, TeamForAssignment[]> {
  const assignments = new Map<number, TeamForAssignment[]>()
  venueIds.forEach(id => assignments.set(id, []))

  // 配置済みチームを追跡
  const placedTeamIds = new Set<number>()

  // ホストチームを先に配置
  for (const venueId of venueIds) {
    const hostTeam = teams.find(t => t.isHost && t.hostVenueId === venueId)
    if (hostTeam && !placedTeamIds.has(hostTeam.id)) {
      assignments.get(venueId)!.push(hostTeam)
      placedTeamIds.add(hostTeam.id)
    }
  }

  // 残りのチームをシャッフル
  const remainingTeams = teams.filter(t => !placedTeamIds.has(t.id))
  const shuffled = [...remainingTeams].sort(() => Math.random() - 0.5)

  // 会場ごとに残りの枠を埋める
  let teamIndex = 0
  for (let idx = 0; idx < venueIds.length; idx++) {
    const venueId = venueIds[idx]
    const venueTeams = assignments.get(venueId)!
    const targetSize = podSizes[idx] || 4

    while (venueTeams.length < targetSize && teamIndex < shuffled.length) {
      const team = shuffled[teamIndex++]
      if (!placedTeamIds.has(team.id)) {
        venueTeams.push(team)
        placedTeamIds.add(team.id)
      }
    }
  }

  return assignments
}

/**
 * 会場内スロット最適化（辞書式スコア）
 */
function optimizeIntraVenueSlotsLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>,
  debug: boolean = false
): void {
  for (const [venueId, teams] of assignments) {
    if (teams.length !== 4) continue

    // 4チームの全順列を試す（4! = 24通り）
    const permutations = generatePermutations([0, 1, 2, 3])
    let bestOrder = [0, 1, 2, 3]
    let bestScore = evaluateVenueLexScore(teams, bestOrder, bannedAMatchPairs, bannedBMatchPairs)

    // デバッグ: 地元チームがあるか確認
    const localTeamIndices = teams.map((t, i) => t.teamType === 'local' ? i : -1).filter(i => i >= 0)

    for (const perm of permutations) {
      const score = evaluateVenueLexScore(teams, perm, bannedAMatchPairs, bannedBMatchPairs)
      if (score < bestScore) {
        bestScore = score
        bestOrder = perm
      }
    }

    // デバッグ: 地元チームが2つ以上ある場合はB戦ペアを確認
    if (debug && localTeamIndices.length >= 2) {
      const bMatchPairs = [[0, 2], [1, 3]]
      const reorderedTeams = bestOrder.map(i => teams[i])
      const bMatchLocalVsLocal = bMatchPairs.filter(([i, j]) =>
        reorderedTeams[i].teamType === 'local' && reorderedTeams[j].teamType === 'local'
      ).length
      console.log(`[IntraVenue] 会場${venueId}: 地元チーム=${localTeamIndices.length}個, 選択順序=[${bestOrder}], B戦地元同士=${bMatchLocalVsLocal}`)
      if (bMatchLocalVsLocal > 0) {
        console.log(`[IntraVenue]   チーム: ${reorderedTeams.map((t, i) => `[${i}]${t.shortName || t.name}${t.teamType === 'local' ? '(地)' : ''}`).join(', ')}`)
        console.log(`[IntraVenue]   B戦: ${bMatchPairs.map(([i, j]) => `${reorderedTeams[i].shortName || reorderedTeams[i].name} vs ${reorderedTeams[j].shortName || reorderedTeams[j].name}`).join(', ')}`)
      }
    }

    // 最良の順序に並び替え
    if (bestOrder.join(',') !== '0,1,2,3') {
      const reordered = bestOrder.map(i => teams[i])
      assignments.set(venueId, reordered)
    }
  }
}

/**
 * 会場内の辞書式スコアを計算（特定の順序で）
 */
function evaluateVenueLexScore(
  teams: TeamForAssignment[],
  order: number[],
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>
): number {
  const total: LexPairScore = {
    sameLeague: 0,
    sameRegion: 0,
    localVsLocal: 0,
    day1Repeat: 0,
  }

  // A戦ペアのインデックス
  const aMatchPairIndices: [number, number][] = [
    [0, 1], [2, 3], [1, 2], [0, 3]
  ]
  // B戦ペアのインデックス（低重みで評価）
  const bMatchPairIndices: [number, number][] = [
    [0, 2], [1, 3]
  ]

  // A戦の制約（フルウェイト、A戦禁止ペアでday1Repeatチェック）
  for (const [i, j] of aMatchPairIndices) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]
    const pairLex = evaluatePairLex(team1, team2, bannedAMatchPairs)
    total.sameLeague += pairLex.sameLeague
    total.sameRegion += pairLex.sameRegion
    total.localVsLocal += pairLex.localVsLocal
    total.day1Repeat += pairLex.day1Repeat
  }

  // B戦の制約（0.001倍 = タイブレーカーとして使用、B戦禁止ペアでday1Repeatチェック）
  for (const [i, j] of bMatchPairIndices) {
    const team1 = teams[order[i]]
    const team2 = teams[order[j]]
    const pairLex = evaluatePairLex(team1, team2, bannedBMatchPairs)
    // B戦は極めて低い重みで加算（A戦の優先度を崩さない）
    total.localVsLocal += pairLex.localVsLocal * 0.001
    total.sameRegion += pairLex.sameRegion * 0.001
    total.sameLeague += pairLex.sameLeague * 0.001
    total.day1Repeat += pairLex.day1Repeat * 0.001  // B戦のday1Repeatも加算
  }

  return encodeLexToScore(total)
}

/**
 * 会場間スワップ最適化（辞書式スコア）
 */
function optimizeBySwapLex(
  assignments: Map<number, TeamForAssignment[]>,
  bannedAMatchPairs?: Set<string>,
  bannedBMatchPairs?: Set<string>,
  maxIterations: number = 50
): Map<number, TeamForAssignment[]> {
  const venueIds = Array.from(assignments.keys())
  let improved = true
  let iterations = 0

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    // 1. 会場内スロット最適化
    optimizeIntraVenueSlotsLex(assignments, bannedAMatchPairs, bannedBMatchPairs)

    // 2. 会場間スワップを試行（ホストは除外）
    for (let v1 = 0; v1 < venueIds.length; v1++) {
      for (let v2 = v1 + 1; v2 < venueIds.length; v2++) {
        // 毎回最新の配列を取得
        let venue1Teams = assignments.get(venueIds[v1])!
        let venue2Teams = assignments.get(venueIds[v2])!

        for (let t1 = 0; t1 < venue1Teams.length; t1++) {
          // ホストはスワップしない
          if (venue1Teams[t1].isHost && venue1Teams[t1].hostVenueId === venueIds[v1]) continue

          for (let t2 = 0; t2 < venue2Teams.length; t2++) {
            // ホストはスワップしない
            if (venue2Teams[t2].isHost && venue2Teams[t2].hostVenueId === venueIds[v2]) continue

            // 現在のスコアを計算（B戦も含めたタイブレーカー付き）
            const currentScore = encodeLexToScoreWithBMatch(evaluateAssignmentLex(assignments, bannedAMatchPairs, bannedBMatchPairs))

            // スワップ前の状態を保存（配列全体をコピー）
            const venue1Before = [...venue1Teams]
            const venue2Before = [...venue2Teams]

            // スワップ実行
            const temp = venue1Teams[t1]
            venue1Teams[t1] = venue2Teams[t2]
            venue2Teams[t2] = temp

            // スワップ後、両会場の内部スロットも最適化
            optimizeIntraVenueSlotsLex(assignments, bannedAMatchPairs, bannedBMatchPairs)

            // 最適化後の配列を再取得（optimizeIntraVenueSlotsLexが新しい配列を設定する可能性があるため）
            venue1Teams = assignments.get(venueIds[v1])!
            venue2Teams = assignments.get(venueIds[v2])!

            const newScore = encodeLexToScoreWithBMatch(evaluateAssignmentLex(assignments, bannedAMatchPairs, bannedBMatchPairs))

            if (newScore < currentScore) {
              improved = true
              // 改善された - この状態を維持
            } else {
              // 改善なし - 元に戻す
              assignments.set(venueIds[v1], venue1Before)
              assignments.set(venueIds[v2], venue2Before)
              // 参照を更新
              venue1Teams = venue1Before
              venue2Teams = venue2Before
            }
          }
        }
      }
    }
  }

  return assignments
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
        teamType: team.teamType,  // 地元/ゲストの区分
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
  teamType?: string  // 'local' | 'guest' など
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
 *   B: (1vs3) + (2vs4)
 *   C: (1vs4) + (2vs3)
 *
 * 各会場でA/B/Cのうち最も制約が少ないものを動的に選択
 */
type BMatchPattern = 'A' | 'B' | 'C'

// B戦ペアの定義（チームインデックス 0-3）
const B_MATCH_PAIR_OPTIONS: Record<BMatchPattern, [number, number][]> = {
  'A': [[0, 1], [2, 3]], // 1vs2 + 3vs4
  'B': [[0, 2], [1, 3]], // 1vs3 + 2vs4
  'C': [[0, 3], [1, 2]], // 1vs4 + 2vs3
}

/**
 * 会場のチーム構成に基づいて最適なB戦パターンを選択
 */
function chooseBestBMatchPattern(teams: { teamType?: string }[]): BMatchPattern {
  if (teams.length !== 4) return 'B' // デフォルト

  let bestPattern: BMatchPattern = 'B'
  let bestScore = Infinity

  for (const pattern of ['A', 'B', 'C'] as BMatchPattern[]) {
    const bMatchPairs = B_MATCH_PAIR_OPTIONS[pattern]
    let score = 0

    for (const [i, j] of bMatchPairs) {
      // 地元同士のB戦はペナルティ
      if (teams[i]?.teamType === 'local' && teams[j]?.teamType === 'local') {
        score += 1000
      }
    }

    if (score < bestScore) {
      bestScore = score
      bestPattern = pattern
    }
  }

  return bestPattern
}

/**
 * B戦パターンに基づいて試合パターンを生成
 *
 * 制約:
 * - B戦は必ずスロット3と6に配置
 * - 連戦回避を最大限考慮（各チームは可能な限り連続スロットで試合しない）
 *
 * 各パターンで連戦を最小化する順序を事前に定義
 */
function getMatchPattern(bMatchPattern: BMatchPattern): { slot: number; home: number; away: number; isBMatch: boolean }[] {
  // 各パターンで連戦を最小化する試合順序（1-indexed）
  // 設計原則: B戦(slot3,6)の参加チームがslot2,4,5,7で連続しないよう配置
  const patterns: Record<BMatchPattern, { slot: number; home: number; away: number; isBMatch: boolean }[]> = {
    // パターンA: B戦 = (1vs2)@slot3, (3vs4)@slot6
    // チーム1,2はslot3でB戦 → slot2で1,2を使わない → slot2は3vs4
    // チーム3,4はslot6でB戦 → slot5で3,4を使わない → slot5は1vs?
    'A': [
      { slot: 1, home: 1, away: 3, isBMatch: false }, // A戦: 1,3
      { slot: 2, home: 2, away: 4, isBMatch: false }, // A戦: 2,4 (1,2休み→slot3準備)
      { slot: 3, home: 1, away: 2, isBMatch: true },  // B戦: 1,2
      { slot: 4, home: 1, away: 4, isBMatch: false }, // A戦: 1,4
      { slot: 5, home: 2, away: 3, isBMatch: false }, // A戦: 2,3 (3,4の片方休み)
      { slot: 6, home: 3, away: 4, isBMatch: true },  // B戦: 3,4
    ],
    // パターンB: B戦 = (1vs3)@slot3, (2vs4)@slot6 - 元の連戦最小化パターン
    'B': [
      { slot: 1, home: 1, away: 2, isBMatch: false }, // A戦: 1,2
      { slot: 2, home: 3, away: 4, isBMatch: false }, // A戦: 3,4 (1,3休み→slot3準備)
      { slot: 3, home: 1, away: 3, isBMatch: true },  // B戦: 1,3
      { slot: 4, home: 2, away: 3, isBMatch: false }, // A戦: 2,3
      { slot: 5, home: 1, away: 4, isBMatch: false }, // A戦: 1,4 (2,4休み→slot6準備)
      { slot: 6, home: 2, away: 4, isBMatch: true },  // B戦: 2,4
    ],
    // パターンC: B戦 = (1vs4)@slot3, (2vs3)@slot6
    'C': [
      { slot: 1, home: 1, away: 2, isBMatch: false }, // A戦: 1,2
      { slot: 2, home: 3, away: 4, isBMatch: false }, // A戦: 3,4 (1,4休み→slot3準備)
      { slot: 3, home: 1, away: 4, isBMatch: true },  // B戦: 1,4
      { slot: 4, home: 1, away: 3, isBMatch: false }, // A戦: 1,3
      { slot: 5, home: 2, away: 4, isBMatch: false }, // A戦: 2,4 (2,3休み→slot6準備)
      { slot: 6, home: 2, away: 3, isBMatch: true },  // B戦: 2,3
    ],
  }

  return patterns[bMatchPattern]
}

// デフォルトパターン（後方互換性）
const FOUR_TEAM_MATCH_PATTERN = getMatchPattern('B')

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

      // 会場ごとに最適なB戦パターンを選択（地元同士がB戦にならないよう）
      const teamsForPattern = venueTeams.map(t => ({ teamType: t.teamType }))
      const bestBMatchPattern = chooseBestBMatchPattern(teamsForPattern)
      const matchPattern = getMatchPattern(bestBMatchPattern)

      // 4チームの総当たりパターンで試合を生成
      for (const pattern of matchPattern) {
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
