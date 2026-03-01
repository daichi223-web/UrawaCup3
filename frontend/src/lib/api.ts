/**
 * Supabase API Layer
 * FastAPIバックエンドの代わりにSupabaseを直接使用
 */

import { supabase } from './supabase'
import type {
  Tournament, Team, Match, Goal,
  Venue, Player,
} from './database.types'
import {
  normalizeTeamName,
  normalizePlayerName,
  normalizeVenueName,
  normalizeJerseyNumber,
} from '@/utils/normalize'
import { getErrorMessage } from '@/utils/errorHandler'
import {
  validateId,
  validateTeamInput,
} from '@/utils/validation'
import {
  ensureValidSession,
  withRateLimitProtection,
} from '@/utils/apiGuard'
import type { RealtimeChannel, RealtimePostgresChangesPayload, Session, AuthChangeEvent } from '@supabase/supabase-js'

// Type for tournament query results
interface TournamentRow {
  id: number
  name: string
  short_name?: string | null
  start_date: string
  end_date: string
  year: number
  edition: number
  match_duration: number
  half_duration: number
  interval_minutes: number
  preliminary_start_time?: string | null
  finals_start_time?: string | null
  finals_match_duration?: number | null
  finals_interval_minutes?: number | null
  group_count?: number | null
  teams_per_group?: number | null
  advancing_teams?: number | null
  sender_organization?: string | null
  sender_name?: string | null
  sender_contact?: string | null
  created_at: string
  updated_at: string
}

// Type for group query results
interface GroupRow {
  id: string
  name: string
  tournament_id: number
}

// Type for team query results
interface TeamRow {
  id: number
  name: string
  tournament_id: number
  [key: string]: unknown
}

// Type for match query results (used in standingsApi and matchesApi)
type MatchRow = {
  id: number
  tournament_id: number
  home_team_id?: number | null
  away_team_id?: number | null
  home_score_total?: number | null
  away_score_total?: number | null
  result?: string | null
  status?: string
  approval_status?: string | null
  [key: string]: unknown
}

// 更新用の部分的なフィールド型
type TournamentUpdateFields = Pick<Tournament, 'name' | 'short_name' | 'start_date' | 'end_date' | 'year' | 'edition'>

// 得点クエリ結果の型（チーム結合含む）
interface GoalWithTeam {
  player_name: string
  team_id: number
  team: { name: string } | null
}

/**
 * Supabaseエラーを日本語メッセージ付きエラーに変換
 */
function handleSupabaseError(error: unknown): never {
  const message = getErrorMessage(error)
  throw new Error(message)
}

// ============================================
// Tournaments API
// ============================================

export const tournamentsApi = {
  async getAll() {
    const { data: rawData, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('year', { ascending: false })
    if (error) handleSupabaseError(error)

    const data = rawData as TournamentRow[] | null
    // snake_case → camelCase 正規化
    return data?.map(t => ({
      ...t,
      shortName: t.short_name,
      startDate: t.start_date,
      endDate: t.end_date,
      matchDuration: t.match_duration,
      halfDuration: t.half_duration,
      intervalMinutes: t.interval_minutes,
      preliminaryStartTime: t.preliminary_start_time,
      finalsStartTime: t.finals_start_time,
      finalsMatchDuration: t.finals_match_duration,
      finalsIntervalMinutes: t.finals_interval_minutes,
      groupCount: t.group_count,
      teamsPerGroup: t.teams_per_group,
      advancingTeams: t.advancing_teams,
      senderOrganization: t.sender_organization,
      senderName: t.sender_name,
      senderContact: t.sender_contact,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })) ?? []
  },

  async getById(id: number) {
    const { data: rawData, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) handleSupabaseError(error)

    const data = rawData as TournamentRow | null
    // snake_case → camelCase 正規化
    return data ? {
      ...data,
      shortName: data.short_name,
      startDate: data.start_date,
      endDate: data.end_date,
      matchDuration: data.match_duration,
      halfDuration: data.half_duration,
      intervalMinutes: data.interval_minutes,
      preliminaryStartTime: data.preliminary_start_time,
      finalsStartTime: data.finals_start_time,
      finalsMatchDuration: data.finals_match_duration,
      finalsIntervalMinutes: data.finals_interval_minutes,
      groupCount: data.group_count,
      teamsPerGroup: data.teams_per_group,
      advancingTeams: data.advancing_teams,
      senderOrganization: data.sender_organization,
      senderName: data.sender_name,
      senderContact: data.sender_contact,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } : null
  },

  async update(id: number, updates: Partial<Tournament>) {
    // 400対策: IDバリデーション
    validateId(id, '大会ID')

    // 401対策: セッション確認
    await ensureValidSession()

    // 許可されたフィールドのみを抽出
    const allowedFields = ['name', 'short_name', 'start_date', 'end_date', 'year', 'edition'] as const
    const sanitizedUpdates: Partial<TournamentUpdateFields> = {}
    for (const key of allowedFields) {
      if (key in updates && updates[key as keyof Tournament] !== undefined) {
        (sanitizedUpdates as Record<string, unknown>)[key] = updates[key as keyof Tournament]
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('更新するフィールドがありません')
    }

    const { data, error } = await supabase
      .from('tournaments')
      .update(sanitizedUpdates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },
}

// ============================================
// Teams API
// ============================================

export const teamsApi = {
  async getAll(tournamentId: number) {
    // 400対策: IDバリデーション
    validateId(tournamentId, '大会ID')

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('group_id')
      .order('group_order')
    if (error) handleSupabaseError(error)
    return { teams: data || [], total: data?.length || 0 }
  },

  async getById(id: number) {
    // 400対策: IDバリデーション
    validateId(id, 'チームID')

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async create(team: Omit<Team, 'id' | 'created_at' | 'updated_at'>) {
    // 401対策: セッション確認
    await ensureValidSession()

    // 400対策: 入力バリデーション
    validateTeamInput({
      name: team.name,
      tournament_id: team.tournament_id,
      team_type: team.team_type,
    })

    // 全角半角正規化
    const normalizedTeam = {
      ...team,
      name: team.name ? normalizeTeamName(team.name) : team.name,
      short_name: team.short_name ? normalizeTeamName(team.short_name) : team.short_name,
    }

    // 402対策: レート制限付き実行
    return withRateLimitProtection(async () => {
      const { data, error } = await supabase
        .from('teams')
        .insert(normalizedTeam as never)
        .select()
        .single()
      if (error) handleSupabaseError(error)
      return data
    })
  },

  async update(id: number, updates: Partial<Team>) {
    // 401対策: セッション確認
    await ensureValidSession()

    // 400対策: IDバリデーション
    validateId(id, 'チームID')

    // 全角半角正規化
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.name) {
      normalizedUpdates.name = normalizeTeamName(normalizedUpdates.name)
    }
    if (normalizedUpdates.short_name) {
      normalizedUpdates.short_name = normalizeTeamName(normalizedUpdates.short_name)
    }

    // 402対策: レート制限付き実行
    return withRateLimitProtection(async () => {
      const { data, error } = await supabase
        .from('teams')
        .update(normalizedUpdates as never)
        .eq('id', id)
        .select()
        .single()
      if (error) handleSupabaseError(error)
      return data
    })
  },

  async delete(id: number) {
    // 401対策: セッション確認
    await ensureValidSession()

    // 400対策: IDバリデーション
    validateId(id, 'チームID')

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id)
    if (error) handleSupabaseError(error)
  },

  // 一括削除前のバリデーション（試合・得点データの存在チェック）
  async validateDeleteAll(tournamentId: number): Promise<{ canDelete: boolean; matchCount: number; goalCount: number }> {
    await ensureValidSession()

    // 大会のチームIDを取得
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)

    const teams = teamsData as TeamRow[] | null
    if (!teams || teams.length === 0) {
      return { canDelete: true, matchCount: 0, goalCount: 0 }
    }

    const teamIds = teams.map(t => t.id)

    // 試合データのチェック
    const { count: matchCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    // 得点データのチェック
    const { count: goalCount } = await supabase
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)

    return {
      canDelete: (matchCount || 0) === 0 && (goalCount || 0) === 0,
      matchCount: matchCount || 0,
      goalCount: goalCount || 0,
    }
  },

  // 全チーム一括削除
  async deleteAll(tournamentId: number) {
    await ensureValidSession()
    validateId(tournamentId, '大会ID')

    // 削除前バリデーション
    const validation = await this.validateDeleteAll(tournamentId)
    if (!validation.canDelete) {
      throw new Error(
        `削除できません: ${validation.matchCount}件の試合、${validation.goalCount}件の得点データが存在します。先に試合データを削除してください。`
      )
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('tournament_id', tournamentId)

    if (error) handleSupabaseError(error)
  },
}

// ============================================
// Matches API
// ============================================

export const matchesApi = {
  async getAll(tournamentId: number, options?: { groupId?: string; status?: string }) {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*)
      `)
      .eq('tournament_id', tournamentId)
      .order('match_date')
      .order('match_time')

    if (options?.groupId) {
      query = query.eq('group_id', options.groupId)
    }
    if (options?.status) {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query
    if (error) handleSupabaseError(error)
    return { matches: data || [], total: data?.length || 0 }
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        venue:venues(*),
        goals(*)
      `)
      .eq('id', id)
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async update(id: number, updates: Partial<Match>) {
    const { data, error } = await supabase
      .from('matches')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async updateScore(id: number, score: {
    home_score_half1?: number
    home_score_half2?: number
    away_score_half1?: number
    away_score_half2?: number
    status?: string
  }) {
    const home_total = (score.home_score_half1 ?? 0) + (score.home_score_half2 ?? 0)
    const away_total = (score.away_score_half1 ?? 0) + (score.away_score_half2 ?? 0)

    // スコアが入力されたら常に結果を計算（status に関係なく）
    let result: 'home_win' | 'away_win' | 'draw'
    if (home_total > away_total) result = 'home_win'
    else if (home_total < away_total) result = 'away_win'
    else result = 'draw'

    const { data, error } = await supabase
      .from('matches')
      .update({
        ...score,
        home_score_total: home_total,
        away_score_total: away_total,
        result,
      } as never)
      .eq('id', id)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },
}

// ============================================
// Goals API
// ============================================

export const goalsApi = {
  async getByMatch(matchId: number) {
    const { data, error } = await supabase
      .from('goals')
      .select('*, team:teams(*), player:players(*)')
      .eq('match_id', matchId)
      .order('half')
      .order('minute')
    if (error) handleSupabaseError(error)
    return data
  },

  async create(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('goals')
      .insert(goal as never)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
    if (error) handleSupabaseError(error)
  },
}

// ============================================
// Standings API
// ============================================

export const standingsApi = {
  async getByGroup(tournamentId: number) {
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id')

    if (groupsError) throw groupsError

    const groups = groupsData as GroupRow[] | null

    const result = []
    for (const group of groups || []) {
      const { data: standings, error } = await supabase
        .from('standings')
        .select('*, team:teams(*)')
        .eq('tournament_id', tournamentId)
        .eq('group_id', group.id)
        .order('rank')

      if (error) handleSupabaseError(error)

      // 順位表が空の場合は空配列を返す（試合入力前は順位表示しない）
      // 以前はチームから暫定順位を生成していたが、総合順位に影響するため削除
      if (!standings || standings.length === 0) {
        result.push({
          groupId: group.id,
          groupName: group.name,
          standings: []
        })
      } else {
        result.push({
          groupId: group.id,
          groupName: group.name,
          standings: standings
        })
      }
    }
    return result
  },

  async getTopScorers(_tournamentId: number, limit = 20) {
    const { data, error } = await supabase
      .from('goals')
      .select(`
        player_name,
        team_id,
        team:teams(name)
      `)
      .eq('is_own_goal', false)

    if (error) handleSupabaseError(error)

    // 得点者ごとに集計
    const scorerMap = new Map<string, { name: string; teamId: number; teamName: string; goals: number }>()

    for (const goal of data as GoalWithTeam[]) {
      const key = `${goal.team_id}-${goal.player_name}`
      if (scorerMap.has(key)) {
        scorerMap.get(key)!.goals++
      } else {
        scorerMap.set(key, {
          name: goal.player_name,
          teamId: goal.team_id,
          teamName: goal.team?.name || '',
          goals: 1
        })
      }
    }

    // ソートしてランキング作成
    const sorted = Array.from(scorerMap.values())
      .sort((a, b) => b.goals - a.goals)
      .slice(0, limit)
      .map((scorer, index) => ({
        rank: index + 1,
        scorerName: scorer.name,
        teamId: scorer.teamId,
        teamName: scorer.teamName,
        goals: scorer.goals
      }))

    return sorted
  },

  async recalculate(tournamentId: number, groupId?: string) {
    // 該当グループの完了済み＆承認済み試合を取得（stageは問わない）
    // approval_status が null（承認フロー未使用）または 'approved'（承認済み）のみ対象
    let matchQuery = supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed')
      .or('approval_status.is.null,approval_status.eq.approved')

    if (groupId) {
      matchQuery = matchQuery.eq('group_id', groupId)
    } else {
      matchQuery = matchQuery.is('group_id', null)
    }

    const { data: matchesData, error: matchError } = await matchQuery

    if (matchError) throw matchError

    let matches = (matchesData || []) as MatchRow[]

    // 該当グループのチームを取得
    let teamQuery = supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)

    if (groupId) {
      teamQuery = teamQuery.eq('group_id', groupId)
    }

    const { data: teamsData, error: teamError } = await teamQuery

    if (teamError) throw teamError

    const teams = (teamsData || []) as TeamRow[]

    // フォールバック: group_idで試合が0件だが、試合のgroup_idがnullの場合
    // チームのIDでフィルタして試合を取得する
    if (matches.length === 0 && groupId && teams.length > 0) {
      const teamIds = teams.map(t => t.id)
      console.log(`[Standings] group_id=${groupId} の試合が0件。チームID (${teamIds.join(',')}) でフォールバック検索`)

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'completed')
        .or('approval_status.is.null,approval_status.eq.approved')
        .eq('stage', 'preliminary')

      if (!fallbackError && fallbackData) {
        const teamIdSet = new Set(teamIds)
        matches = (fallbackData as MatchRow[]).filter(m =>
          teamIdSet.has(m.home_team_id) || teamIdSet.has(m.away_team_id)
        )
        console.log(`[Standings] フォールバック: ${matches.length} 試合を検出（チームID照合）`)
      }
    }

    console.log(`[Standings] Found ${matches.length} completed+approved matches for group ${groupId || '(single league)'}`)
    console.log(`[Standings] Found ${teams.length} teams for group ${groupId || '(all teams)'}`)

    // チームごとの成績を計算
    const stats = new Map<number, {
      played: number; won: number; drawn: number; lost: number;
      goals_for: number; goals_against: number;
    }>()

    for (const team of teams) {
      stats.set(team.id, { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 })
    }

    for (const match of matches) {
      if (!match.home_team_id || !match.away_team_id) continue

      const homeStats = stats.get(match.home_team_id)
      const awayStats = stats.get(match.away_team_id)
      if (!homeStats || !awayStats) continue

      const homeScore = match.home_score_total ?? 0
      const awayScore = match.away_score_total ?? 0

      homeStats.played++
      awayStats.played++
      homeStats.goals_for += homeScore
      homeStats.goals_against += awayScore
      awayStats.goals_for += awayScore
      awayStats.goals_against += homeScore

      // resultフィールドがない場合はスコアから勝敗を判定
      const result = match.result || (
        homeScore > awayScore ? 'home_win' :
        homeScore < awayScore ? 'away_win' : 'draw'
      )

      if (result === 'home_win') {
        homeStats.won++
        awayStats.lost++
      } else if (result === 'away_win') {
        awayStats.won++
        homeStats.lost++
      } else {
        homeStats.drawn++
        awayStats.drawn++
      }
    }

    // 順位を計算してDBに保存
    const standings = Array.from(stats.entries()).map(([teamId, s]) => ({
      tournament_id: tournamentId,
      group_id: groupId || null,
      team_id: teamId,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      goal_difference: s.goals_for - s.goals_against,
      points: s.won * 3 + s.drawn,
      rank: 0
    }))

    // ソートして順位付け
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      return b.goals_for - a.goals_for
    })

    standings.forEach((s, i) => { s.rank = i + 1 })

    // 既存の順位を削除して再挿入
    let deleteQuery = supabase
      .from('standings')
      .delete()
      .eq('tournament_id', tournamentId)

    if (groupId) {
      deleteQuery = deleteQuery.eq('group_id', groupId)
    } else {
      deleteQuery = deleteQuery.is('group_id', null)
    }
    await deleteQuery

    const { error } = await supabase
      .from('standings')
      .insert(standings as never)

    if (error) handleSupabaseError(error)
    return standings
  }
}

// ============================================
// Venues API
// ============================================

export const venuesApi = {
  async getAll(tournamentId: number) {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name')
    if (error) handleSupabaseError(error)
    return data
  },

  async create(venue: Omit<Venue, 'id' | 'created_at' | 'updated_at'>) {
    // 全角半角正規化
    const normalizedVenue = {
      ...venue,
      name: venue.name ? normalizeVenueName(venue.name) : venue.name,
      address: venue.address ? normalizeVenueName(venue.address) : venue.address,
    }
    const { data, error } = await supabase
      .from('venues')
      .insert(normalizedVenue as never)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async update(id: number, updates: Partial<Venue>) {
    // 全角半角正規化
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.name) {
      normalizedUpdates.name = normalizeVenueName(normalizedUpdates.name)
    }
    if (normalizedUpdates.address) {
      normalizedUpdates.address = normalizeVenueName(normalizedUpdates.address)
    }
    const { data, error } = await supabase
      .from('venues')
      .update(normalizedUpdates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },
}

// ============================================
// Groups API
// ============================================

export const groupsApi = {
  async getAll(tournamentId: number) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id')
    if (error) handleSupabaseError(error)
    return data
  },
}

// ============================================
// Players API
// ============================================

export const playersApi = {
  async getByTeam(teamId: number) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('number')
    if (error) handleSupabaseError(error)
    return data
  },

  async create(player: Omit<Player, 'id' | 'created_at' | 'updated_at'>) {
    // 全角半角正規化
    const normalizedPlayer = {
      ...player,
      name: player.name ? normalizePlayerName(player.name) : player.name,
      number: typeof player.number === 'string'
        ? parseInt(normalizeJerseyNumber(player.number), 10) || player.number
        : player.number,
    }
    const { data, error } = await supabase
      .from('players')
      .insert(normalizedPlayer as never)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async update(id: number, updates: Partial<Player>) {
    // 全角半角正規化
    const normalizedUpdates = { ...updates }
    if (normalizedUpdates.name) {
      normalizedUpdates.name = normalizePlayerName(normalizedUpdates.name)
    }
    if (normalizedUpdates.number !== undefined && typeof normalizedUpdates.number === 'string') {
      normalizedUpdates.number = parseInt(normalizeJerseyNumber(normalizedUpdates.number as string), 10) || normalizedUpdates.number
    }
    const { data, error } = await supabase
      .from('players')
      .update(normalizedUpdates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) handleSupabaseError(error)
    return data
  },
}

// ============================================
// Auth API
// ============================================

export const authApi = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) handleSupabaseError(error)
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) handleSupabaseError(error)
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) handleSupabaseError(error)
    return data.session
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// ============================================
// Realtime Subscriptions
// ============================================

// Realtime payload型エイリアス
type RealtimePayload<T extends Record<string, unknown> = Record<string, unknown>> = RealtimePostgresChangesPayload<T>

export const realtimeApi = {
  subscribeToMatches(tournamentId: number, callback: (payload: RealtimePayload) => void) {
    return supabase
      .channel(`matches-changes-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        callback
      )
      .subscribe()
  },

  subscribeToGoals(callback: (payload: RealtimePayload) => void) {
    return supabase
      .channel('goals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
        },
        callback
      )
      .subscribe()
  },

  subscribeToStandings(tournamentId: number, callback: (payload: RealtimePayload) => void) {
    return supabase
      .channel(`standings-changes-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'standings',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        callback
      )
      .subscribe()
  },

  unsubscribe(channel: RealtimeChannel) {
    supabase.removeChannel(channel)
  },
}

// ============================================================================
// Leagues API
// ============================================================================
export const leaguesApi = {
  async getAll(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .order('name')
    if (error) throw new Error(getErrorMessage(error))
    return (data || []) as { id: number; name: string }[]
  },

  async getByTournament(tournamentId: number): Promise<{ id: number; name: string }[]> {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('name')
    if (error) throw new Error(getErrorMessage(error))
    return (data || []) as { id: number; name: string }[]
  },

  async create(name: string): Promise<{ id: number; name: string }> {
    const { data, error } = await supabase
      .from('leagues')
      .insert({ name } as never)
      .select()
      .single()
    if (error) throw new Error(getErrorMessage(error))
    return data as { id: number; name: string }
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('leagues')
      .delete()
      .eq('id', id)
    if (error) throw new Error(getErrorMessage(error))
  },
}

// ============================================================================
// Regions API
// ============================================================================
export const regionsApi = {
  async getAll(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .order('name')
    if (error) throw new Error(getErrorMessage(error))
    return (data || []) as { id: number; name: string }[]
  },

  async create(name: string): Promise<{ id: number; name: string }> {
    const { data, error } = await supabase
      .from('regions')
      .insert({ name } as never)
      .select()
      .single()
    if (error) throw new Error(getErrorMessage(error))
    return data as { id: number; name: string }
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('regions')
      .delete()
      .eq('id', id)
    if (error) throw new Error(getErrorMessage(error))
  },
}
