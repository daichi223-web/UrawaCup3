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

// キックオフ時刻（25分間隔: 試合15分 + インターバル10分）
const KICKOFF_TIMES = [
  '09:00',
  '09:25',
  '09:50',
  '10:15',
  '10:40',
  '11:05',
]

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
  // まずgroupIdが一致する会場を探す
  let venue = venues.find(v => v.groupId === groupId)
  if (venue) return venue

  // グループ名を含む会場を探す
  const groupVenueName = GROUP_VENUES[groupId]
  if (groupVenueName) {
    venue = venues.find(v => v.name.includes(groupVenueName.replace('高G', '')))
  }

  // それでも見つからない場合はインデックスで割り当て
  if (!venue) {
    const groupIndex = GROUPS.indexOf(groupId)
    if (groupIndex >= 0 && groupIndex < venues.length) {
      venue = venues[groupIndex]
    }
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

/**
 * 浦和カップの日程を生成
 */
export function generateUrawaCupSchedule(
  teams: TeamInfo[],
  venues: Venue[],
  day1Date: string,
  day2Date: string
): ScheduleGenerationResult {
  const warnings: string[] = []
  const matches: GeneratedMatch[] = []
  let matchOrder = 1

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
        matchTime: KICKOFF_TIMES[slot],
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
        matchTime: KICKOFF_TIMES[slot],
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
