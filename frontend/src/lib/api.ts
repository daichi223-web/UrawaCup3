/**
 * Supabase API Layer
 * FastAPIバックエンドの代わりにSupabaseを直接使用
 */

import { supabase } from './supabase'
import type {
  Tournament, Team, Match, Goal, Standing,
  Venue, Player, Profile, Group
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
  validateRequired,
  validateTeamInput,
  validatePlayerInput,
  validateMatchUpdate,
  validateGoalInput,
  validateVenueInput,
  ValidationError,
} from '@/utils/validation'
import {
  ensureValidSession,
  withRateLimitProtection,
  checkExists,
} from '@/utils/apiGuard'

/**
 * Supabaseエラーを日本語メッセージ付きエラーに変換
 */
function handleSupabaseError(error: unknown): never {
  const message = getErrorMessage(error)
  throw new Error(message)
}

/**
 * ValidationErrorを適切なメッセージでスロー
 */
function handleValidationError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw error
  }
  throw error
}

// ============================================
// Tournaments API
// ============================================

export const tournamentsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('year', { ascending: false })
    if (error) handleSupabaseError(error)
    return data
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) handleSupabaseError(error)
    return data
  },

  async update(id: number, updates: Partial<Tournament>) {
    const { data, error } = await supabase
      .from('tournaments')
      .update(updates)
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
    return { teams: data, total: data.length }
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
        .insert(normalizedTeam)
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
        .update(normalizedUpdates)
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
    return { matches: data, total: data.length }
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
      .update(updates)
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
      })
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
      .insert(goal)
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
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id')

    if (groupsError) throw groupsError

    const result = []
    for (const group of groups) {
      const { data: standings, error } = await supabase
        .from('standings')
        .select('*, team:teams(*)')
        .eq('tournament_id', tournamentId)
        .eq('group_id', group.id)
        .order('rank')

      if (error) handleSupabaseError(error)

      // 順位表が空の場合はチームテーブルから取得
      if (!standings || standings.length === 0) {
        const { data: teams } = await supabase
          .from('teams')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('group_id', group.id)
          .order('group_order')

        const fallbackStandings = (teams || []).map((team, index) => ({
          team_id: team.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0,
          rank: index + 1,
          team: { id: team.id, name: team.name },
        }))

        result.push({
          groupId: group.id,
          groupName: group.name,
          standings: fallbackStandings
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

  async getTopScorers(tournamentId: number, limit = 20) {
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

    for (const goal of data) {
      const key = `${goal.team_id}-${goal.player_name}`
      if (scorerMap.has(key)) {
        scorerMap.get(key)!.goals++
      } else {
        scorerMap.set(key, {
          name: goal.player_name,
          teamId: goal.team_id,
          teamName: (goal.team as any)?.name || '',
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

  async recalculate(tournamentId: number, groupId: string) {
    // 該当グループの完了済み試合を取得（stageは問わない）
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)
      .eq('status', 'completed')

    if (matchError) throw matchError

    console.log(`[Standings] Found ${matches?.length || 0} completed matches for group ${groupId}`)

    // 該当グループのチームを取得
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)

    if (teamError) throw teamError

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
      group_id: groupId,
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
    await supabase
      .from('standings')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('group_id', groupId)

    const { error } = await supabase
      .from('standings')
      .insert(standings)

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
      .insert(normalizedVenue)
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
      .update(normalizedUpdates)
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
      .insert(normalizedPlayer)
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
      .update(normalizedUpdates)
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

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// ============================================
// Realtime Subscriptions
// ============================================

export const realtimeApi = {
  subscribeToMatches(tournamentId: number, callback: (payload: any) => void) {
    return supabase
      .channel('matches-changes')
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

  subscribeToGoals(callback: (payload: any) => void) {
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

  subscribeToStandings(tournamentId: number, callback: (payload: any) => void) {
    return supabase
      .channel('standings-changes')
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

  unsubscribe(channel: any) {
    supabase.removeChannel(channel)
  },
}
