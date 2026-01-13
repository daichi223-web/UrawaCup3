/**
 * 組み合わせ制約チェックロジック
 *
 * 制約レベル:
 * - error: 絶対制約（保存不可）
 * - warning: 警告制約（保存可能）
 * - info: 情報（表示のみ）
 */

export type ConstraintLevel = 'error' | 'warning' | 'info'

export interface ConstraintViolation {
  level: ConstraintLevel
  type: string
  label: string
  description: string
  matchIds: number[]  // 違反に関係する試合ID
  teamIds?: number[]  // 違反に関係するチームID
  day?: number        // 該当日
  slot?: number       // 該当時間枠
}

export interface MatchForValidation {
  id: number
  matchDate: string
  matchTime: string
  slot?: number       // 時間枠番号 (1-6)
  homeTeamId: number
  awayTeamId: number
  homeTeamName?: string
  awayTeamName?: string
  groupId?: string
  refereeTeamIds?: number[]
}

export interface TeamInfo {
  id: number
  name: string
  groupId: string
  teamType?: 'local' | 'invited'  // 地元校 or 招待校
  region?: string                  // 地域（例: '埼玉', '東京'）
  leagueId?: string | number       // 所属リーグID（別リーグ戦）
}

/**
 * 制約チェック設定
 */
export interface ConstraintCheckSettings {
  avoidLocalVsLocal?: boolean
  avoidSameRegion?: boolean
  avoidSameLeague?: boolean
  avoidConsecutive?: boolean
  warnDailyGameLimit?: boolean
  warnTotalGameLimit?: boolean
}

/**
 * エラー制約の定義
 */
const ERROR_CONSTRAINTS = {
  sameTimeConflict: {
    label: '同時刻重複',
    description: '同じチームが同じ時間枠に2試合入っている',
  },
  duplicateMatch: {
    label: '対戦済',
    description: '同じ対戦カードが2日間で2回以上ある',
  },
  selfMatch: {
    label: '自チーム対戦',
    description: '同じチーム同士の対戦になっている',
  },
}

/**
 * 警告制約の定義
 */
const WARNING_CONSTRAINTS = {
  dailyGameLimit: {
    label: '1日3試合以上',
    description: '1チームが1日に3試合以上出場している',
  },
  consecutive: {
    label: '連戦',
    description: '連続する時間枠で出場している（例：①→②）',
  },
  refereeConflict: {
    label: '審判中に試合',
    description: '審判担当の時間枠に自チームの試合がある',
  },
  notEnoughGames: {
    label: '試合数不足',
    description: '1チームの1日の試合数が2試合未満',
  },
  tooManyGamesTotal: {
    label: '2日間で5試合以上',
    description: '1チームが2日間合計で5試合以上',
  },
  localVsLocal: {
    label: '地元同士',
    description: '地元チーム同士の対戦（避けるべき）',
  },
  sameRegion: {
    label: '同地域',
    description: '同じ地域のチーム同士の対戦（避けるべき）',
  },
  sameLeague: {
    label: '同リーグ',
    description: '同じリーグに所属するチーム同士の対戦（普段から対戦している）',
  },
}

/**
 * 情報制約の定義
 */
const INFO_CONSTRAINTS = {
  byePairBroken: {
    label: '不戦ペア変更',
    description: '元々対戦しない設定だったペアが対戦可能になった',
  },
  refereeImbalance: {
    label: '審判偏り',
    description: '審判担当回数がチーム間で偏っている',
  },
}

/**
 * 時間枠番号を取得（HH:MM形式から）
 */
function getSlotFromTime(matchTime: string, startTime: string = '09:00', matchDuration: number = 15, interval: number = 10): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [h, m] = matchTime.split(':').map(Number)

  const startMinutes = startH * 60 + startM
  const matchMinutes = h * 60 + m

  const diff = matchMinutes - startMinutes
  const slotDuration = matchDuration + interval

  return Math.floor(diff / slotDuration) + 1
}

/**
 * 全制約をチェック
 */
export function validateMatches(
  matches: MatchForValidation[],
  teams: TeamInfo[],
  originalByePairs?: [number, number][],  // 元々の不戦ペア
  settings?: ConstraintCheckSettings      // 制約チェック設定
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // デフォルト設定（すべて有効）
  const cfg: ConstraintCheckSettings = {
    avoidLocalVsLocal: true,
    avoidSameRegion: true,
    avoidSameLeague: true,
    avoidConsecutive: true,
    warnDailyGameLimit: true,
    warnTotalGameLimit: true,
    ...settings,
  }

  // 試合にスロット番号を付与
  const matchesWithSlots = matches.map(m => ({
    ...m,
    slot: m.slot || getSlotFromTime(m.matchTime),
  }))

  // エラーチェック（常に実行）
  violations.push(...checkSameTimeConflict(matchesWithSlots))
  violations.push(...checkDuplicateMatch(matchesWithSlots))
  violations.push(...checkSelfMatch(matchesWithSlots))

  // 警告チェック（設定に基づいて実行）
  if (cfg.warnDailyGameLimit) {
    violations.push(...checkDailyGameLimit(matchesWithSlots))
  }
  if (cfg.avoidConsecutive) {
    violations.push(...checkConsecutiveMatches(matchesWithSlots))
  }
  violations.push(...checkRefereeConflict(matchesWithSlots))  // 常に実行
  violations.push(...checkNotEnoughGames(matchesWithSlots, teams))  // 常に実行
  if (cfg.warnTotalGameLimit) {
    violations.push(...checkTooManyGamesTotal(matchesWithSlots))
  }
  if (cfg.avoidLocalVsLocal) {
    violations.push(...checkLocalVsLocal(matchesWithSlots, teams))
  }
  if (cfg.avoidSameRegion) {
    violations.push(...checkSameRegion(matchesWithSlots, teams))
  }
  if (cfg.avoidSameLeague) {
    violations.push(...checkSameLeague(matchesWithSlots, teams))
  }

  // 情報チェック
  if (originalByePairs) {
    violations.push(...checkByePairBroken(matchesWithSlots, originalByePairs))
  }
  violations.push(...checkRefereeImbalance(matchesWithSlots, teams))

  return violations
}

/**
 * エラー: 同時刻重複チェック
 */
function checkSameTimeConflict(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 日付・スロットごとにグループ化
  const byDateSlot: Record<string, MatchForValidation[]> = {}
  for (const m of matches) {
    const key = `${m.matchDate}_${m.slot}`
    if (!byDateSlot[key]) byDateSlot[key] = []
    byDateSlot[key].push(m)
  }

  // 各チームが同じ日・スロットに複数出場していないかチェック
  for (const [, slotMatches] of Object.entries(byDateSlot)) {
    const teamAppearances: Record<number, number[]> = {}

    for (const m of slotMatches) {
      if (!teamAppearances[m.homeTeamId]) teamAppearances[m.homeTeamId] = []
      if (!teamAppearances[m.awayTeamId]) teamAppearances[m.awayTeamId] = []
      teamAppearances[m.homeTeamId].push(m.id)
      teamAppearances[m.awayTeamId].push(m.id)
    }

    for (const [teamId, matchIds] of Object.entries(teamAppearances)) {
      if (matchIds.length > 1) {
        violations.push({
          level: 'error',
          type: 'sameTimeConflict',
          label: ERROR_CONSTRAINTS.sameTimeConflict.label,
          description: ERROR_CONSTRAINTS.sameTimeConflict.description,
          matchIds,
          teamIds: [Number(teamId)],
        })
      }
    }
  }

  return violations
}

/**
 * エラー: 同一カード重複チェック
 */
function checkDuplicateMatch(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 対戦ペアごとに試合をカウント
  const pairMatches: Record<string, MatchForValidation[]> = {}

  for (const m of matches) {
    // チームIDを小さい順にソートしてペアキーを作成
    const pairKey = [m.homeTeamId, m.awayTeamId].sort((a, b) => a - b).join('-')
    if (!pairMatches[pairKey]) pairMatches[pairKey] = []
    pairMatches[pairKey].push(m)
  }

  for (const [, pairMatchList] of Object.entries(pairMatches)) {
    if (pairMatchList.length > 1) {
      violations.push({
        level: 'error',
        type: 'duplicateMatch',
        label: ERROR_CONSTRAINTS.duplicateMatch.label,
        description: ERROR_CONSTRAINTS.duplicateMatch.description,
        matchIds: pairMatchList.map(m => m.id),
        teamIds: [pairMatchList[0].homeTeamId, pairMatchList[0].awayTeamId],
      })
    }
  }

  return violations
}

/**
 * エラー: 自チーム対戦チェック
 */
function checkSelfMatch(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  for (const m of matches) {
    if (m.homeTeamId === m.awayTeamId) {
      violations.push({
        level: 'error',
        type: 'selfMatch',
        label: ERROR_CONSTRAINTS.selfMatch.label,
        description: ERROR_CONSTRAINTS.selfMatch.description,
        matchIds: [m.id],
        teamIds: [m.homeTeamId],
      })
    }
  }

  return violations
}

/**
 * 警告: 1日3試合以上チェック
 */
function checkDailyGameLimit(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 日付ごとにチームの出場試合をカウント
  const dailyTeamMatches: Record<string, Record<number, number[]>> = {}

  for (const m of matches) {
    if (!dailyTeamMatches[m.matchDate]) dailyTeamMatches[m.matchDate] = {}

    if (!dailyTeamMatches[m.matchDate][m.homeTeamId]) {
      dailyTeamMatches[m.matchDate][m.homeTeamId] = []
    }
    if (!dailyTeamMatches[m.matchDate][m.awayTeamId]) {
      dailyTeamMatches[m.matchDate][m.awayTeamId] = []
    }

    dailyTeamMatches[m.matchDate][m.homeTeamId].push(m.id)
    dailyTeamMatches[m.matchDate][m.awayTeamId].push(m.id)
  }

  for (const [date, teamMatches] of Object.entries(dailyTeamMatches)) {
    for (const [teamId, matchIds] of Object.entries(teamMatches)) {
      if (matchIds.length >= 3) {
        violations.push({
          level: 'warning',
          type: 'dailyGameLimit',
          label: WARNING_CONSTRAINTS.dailyGameLimit.label,
          description: `${date}: ${matchIds.length}試合`,
          matchIds,
          teamIds: [Number(teamId)],
        })
      }
    }
  }

  return violations
}

/**
 * 警告: 連戦チェック
 */
function checkConsecutiveMatches(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 日付・チームごとにスロットを記録
  const teamSlots: Record<string, Record<number, { slot: number; matchId: number }[]>> = {}

  for (const m of matches) {
    const key = m.matchDate
    if (!teamSlots[key]) teamSlots[key] = {}

    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      if (!teamSlots[key][teamId]) teamSlots[key][teamId] = []
      teamSlots[key][teamId].push({ slot: m.slot!, matchId: m.id })
    }
  }

  for (const [date, teams] of Object.entries(teamSlots)) {
    for (const [teamId, slots] of Object.entries(teams)) {
      // スロット順にソート
      slots.sort((a, b) => a.slot - b.slot)

      for (let i = 0; i < slots.length - 1; i++) {
        if (slots[i + 1].slot - slots[i].slot === 1) {
          violations.push({
            level: 'warning',
            type: 'consecutive',
            label: WARNING_CONSTRAINTS.consecutive.label,
            description: `${date}: 枠${slots[i].slot}→枠${slots[i + 1].slot}`,
            matchIds: [slots[i].matchId, slots[i + 1].matchId],
            teamIds: [Number(teamId)],
          })
        }
      }
    }
  }

  return violations
}

/**
 * 警告: 審判中に試合チェック
 */
function checkRefereeConflict(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 日付・スロットごとに審判チームを記録
  const refereeAssignments: Record<string, Record<number, number[]>> = {}  // date_slot -> teamId -> matchIds
  const playingTeams: Record<string, Record<number, number>> = {}  // date_slot -> teamId -> matchId

  for (const m of matches) {
    const key = `${m.matchDate}_${m.slot}`

    // 出場チームを記録
    if (!playingTeams[key]) playingTeams[key] = {}
    playingTeams[key][m.homeTeamId] = m.id
    playingTeams[key][m.awayTeamId] = m.id

    // 審判チームを記録
    if (m.refereeTeamIds && m.refereeTeamIds.length > 0) {
      if (!refereeAssignments[key]) refereeAssignments[key] = {}
      for (const refId of m.refereeTeamIds) {
        if (!refereeAssignments[key][refId]) refereeAssignments[key][refId] = []
        refereeAssignments[key][refId].push(m.id)
      }
    }
  }

  // 審判担当チームが同時刻に試合していないかチェック
  for (const [key, refs] of Object.entries(refereeAssignments)) {
    const playing = playingTeams[key] || {}
    for (const [teamId, refMatchIds] of Object.entries(refs)) {
      const playingMatchId = playing[Number(teamId)]
      if (playingMatchId) {
        violations.push({
          level: 'warning',
          type: 'refereeConflict',
          label: WARNING_CONSTRAINTS.refereeConflict.label,
          description: WARNING_CONSTRAINTS.refereeConflict.description,
          matchIds: [...refMatchIds, playingMatchId],
          teamIds: [Number(teamId)],
        })
      }
    }
  }

  return violations
}

/**
 * 警告: 1日の試合数不足チェック
 */
function checkNotEnoughGames(matches: MatchForValidation[], teams: TeamInfo[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 予選リーグのチームのみ対象
  const groupTeamIds = new Set(teams.filter(t => t.groupId).map(t => t.id))

  // 日付ごとにチームの試合数をカウント
  const dates = [...new Set(matches.map(m => m.matchDate))].sort()

  // 2日間のみ対象（予選リーグ）
  const preliminaryDates = dates.slice(0, 2)

  for (const date of preliminaryDates) {
    const dailyMatches = matches.filter(m => m.matchDate === date)
    const teamMatchCount: Record<number, number[]> = {}

    for (const m of dailyMatches) {
      if (groupTeamIds.has(m.homeTeamId)) {
        if (!teamMatchCount[m.homeTeamId]) teamMatchCount[m.homeTeamId] = []
        teamMatchCount[m.homeTeamId].push(m.id)
      }
      if (groupTeamIds.has(m.awayTeamId)) {
        if (!teamMatchCount[m.awayTeamId]) teamMatchCount[m.awayTeamId] = []
        teamMatchCount[m.awayTeamId].push(m.id)
      }
    }

    for (const teamId of groupTeamIds) {
      const matchIds = teamMatchCount[teamId] || []
      if (matchIds.length < 2) {
        violations.push({
          level: 'warning',
          type: 'notEnoughGames',
          label: WARNING_CONSTRAINTS.notEnoughGames.label,
          description: `${date}: ${matchIds.length}試合のみ`,
          matchIds,
          teamIds: [teamId],
        })
      }
    }
  }

  return violations
}

/**
 * 警告: 2日間で5試合以上チェック
 */
function checkTooManyGamesTotal(matches: MatchForValidation[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // チームごとの全試合をカウント
  const teamMatches: Record<number, number[]> = {}

  for (const m of matches) {
    if (!teamMatches[m.homeTeamId]) teamMatches[m.homeTeamId] = []
    if (!teamMatches[m.awayTeamId]) teamMatches[m.awayTeamId] = []
    teamMatches[m.homeTeamId].push(m.id)
    teamMatches[m.awayTeamId].push(m.id)
  }

  for (const [teamId, matchIds] of Object.entries(teamMatches)) {
    if (matchIds.length >= 5) {
      violations.push({
        level: 'warning',
        type: 'tooManyGamesTotal',
        label: WARNING_CONSTRAINTS.tooManyGamesTotal.label,
        description: `合計${matchIds.length}試合`,
        matchIds,
        teamIds: [Number(teamId)],
      })
    }
  }

  return violations
}

/**
 * 警告: 地元チーム同士の対戦チェック
 */
function checkLocalVsLocal(
  matches: MatchForValidation[],
  teams: TeamInfo[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // チームIDからTeamInfoを引くためのMap
  const teamMap = new Map(teams.map(t => [t.id, t]))

  for (const m of matches) {
    const homeTeam = teamMap.get(m.homeTeamId)
    const awayTeam = teamMap.get(m.awayTeamId)

    if (homeTeam?.teamType === 'local' && awayTeam?.teamType === 'local') {
      violations.push({
        level: 'warning',
        type: 'localVsLocal',
        label: WARNING_CONSTRAINTS.localVsLocal.label,
        description: `${homeTeam.name} vs ${awayTeam.name}`,
        matchIds: [m.id],
        teamIds: [m.homeTeamId, m.awayTeamId],
      })
    }
  }

  return violations
}

/**
 * 警告: 同一地域チーム同士の対戦チェック
 */
function checkSameRegion(
  matches: MatchForValidation[],
  teams: TeamInfo[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // チームIDからTeamInfoを引くためのMap
  const teamMap = new Map(teams.map(t => [t.id, t]))

  for (const m of matches) {
    const homeTeam = teamMap.get(m.homeTeamId)
    const awayTeam = teamMap.get(m.awayTeamId)

    // 両チームに地域が設定されていて、かつ同じ地域の場合
    if (
      homeTeam?.region &&
      awayTeam?.region &&
      homeTeam.region === awayTeam.region
    ) {
      violations.push({
        level: 'warning',
        type: 'sameRegion',
        label: WARNING_CONSTRAINTS.sameRegion.label,
        description: `${homeTeam.name} vs ${awayTeam.name}（${homeTeam.region}）`,
        matchIds: [m.id],
        teamIds: [m.homeTeamId, m.awayTeamId],
      })
    }
  }

  return violations
}

/**
 * 警告: 同一リーグ所属チーム同士の対戦チェック
 */
function checkSameLeague(
  matches: MatchForValidation[],
  teams: TeamInfo[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // チームIDからTeamInfoを引くためのMap
  const teamMap = new Map(teams.map(t => [t.id, t]))

  for (const m of matches) {
    const homeTeam = teamMap.get(m.homeTeamId)
    const awayTeam = teamMap.get(m.awayTeamId)

    // 両チームにリーグIDが設定されていて、かつ同じリーグの場合
    if (
      homeTeam?.leagueId &&
      awayTeam?.leagueId &&
      homeTeam.leagueId === awayTeam.leagueId
    ) {
      violations.push({
        level: 'warning',
        type: 'sameLeague',
        label: WARNING_CONSTRAINTS.sameLeague.label,
        description: `${homeTeam.name} vs ${awayTeam.name}`,
        matchIds: [m.id],
        teamIds: [m.homeTeamId, m.awayTeamId],
      })
    }
  }

  return violations
}

/**
 * 情報: 不戦ペア変更チェック
 */
function checkByePairBroken(
  matches: MatchForValidation[],
  originalByePairs: [number, number][]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // 現在の対戦ペアを取得
  const currentPairs = new Set<string>()
  for (const m of matches) {
    const pairKey = [m.homeTeamId, m.awayTeamId].sort((a, b) => a - b).join('-')
    currentPairs.add(pairKey)
  }

  // 元々の不戦ペアが対戦しているかチェック
  for (const [team1, team2] of originalByePairs) {
    const pairKey = [team1, team2].sort((a, b) => a - b).join('-')
    if (currentPairs.has(pairKey)) {
      const matchId = matches.find(m => {
        const mPairKey = [m.homeTeamId, m.awayTeamId].sort((a, b) => a - b).join('-')
        return mPairKey === pairKey
      })?.id

      if (matchId) {
        violations.push({
          level: 'info',
          type: 'byePairBroken',
          label: INFO_CONSTRAINTS.byePairBroken.label,
          description: INFO_CONSTRAINTS.byePairBroken.description,
          matchIds: [matchId],
          teamIds: [team1, team2],
        })
      }
    }
  }

  return violations
}

/**
 * 情報: 審判担当回数の偏りチェック
 */
function checkRefereeImbalance(matches: MatchForValidation[], teams: TeamInfo[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // グループごとにチェック
  const groups = [...new Set(teams.map(t => t.groupId).filter(Boolean))]

  for (const groupId of groups) {
    const groupTeamIds = new Set(teams.filter(t => t.groupId === groupId).map(t => t.id))
    const groupMatches = matches.filter(m => m.groupId === groupId)

    // 審判担当回数をカウント
    const refCount: Record<number, number> = {}
    for (const teamId of groupTeamIds) {
      refCount[teamId] = 0
    }

    for (const m of groupMatches) {
      if (m.refereeTeamIds) {
        for (const refId of m.refereeTeamIds) {
          if (groupTeamIds.has(refId)) {
            refCount[refId]++
          }
        }
      }
    }

    // 偏りをチェック（最大と最小の差が2以上なら警告）
    const counts = Object.values(refCount)
    if (counts.length > 0) {
      const max = Math.max(...counts)
      const min = Math.min(...counts)

      if (max - min >= 2) {
        violations.push({
          level: 'info',
          type: 'refereeImbalance',
          label: INFO_CONSTRAINTS.refereeImbalance.label,
          description: `グループ${groupId}: 審判回数 ${min}〜${max}回`,
          matchIds: [],
          teamIds: [...groupTeamIds],
        })
      }
    }
  }

  return violations
}

/**
 * 制約違反サマリーを取得
 */
export function getViolationSummary(violations: ConstraintViolation[]): {
  errors: ConstraintViolation[]
  warnings: ConstraintViolation[]
  infos: ConstraintViolation[]
  hasErrors: boolean
  canSave: boolean
} {
  const errors = violations.filter(v => v.level === 'error')
  const warnings = violations.filter(v => v.level === 'warning')
  const infos = violations.filter(v => v.level === 'info')

  return {
    errors,
    warnings,
    infos,
    hasErrors: errors.length > 0,
    canSave: errors.length === 0,
  }
}

/**
 * 特定の試合に関連する違反を取得
 */
export function getViolationsForMatch(
  matchId: number,
  violations: ConstraintViolation[]
): ConstraintViolation[] {
  return violations.filter(v => v.matchIds.includes(matchId))
}
