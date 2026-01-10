/**
 * 優秀選手API
 */
import { supabase } from '@/lib/supabase'
import type { OutstandingPlayer, OutstandingPlayerCreate, OutstandingPlayerUpdate } from '@shared/types'

export const outstandingPlayersApi = {
  /**
   * 優秀選手一覧を取得
   */
  async getAll(tournamentId: number): Promise<OutstandingPlayer[]> {
    const { data, error } = await supabase
      .from('outstanding_players')
      .select(`
        *,
        team:teams(id, name, short_name, group_id),
        player:players(id, name, number)
      `)
      .eq('tournament_id', tournamentId)
      .order('award_type', { ascending: true }) // mvpが先
      .order('display_order', { ascending: true })

    if (error) throw error

    return (data || []).map(normalizeOutstandingPlayer)
  },

  /**
   * 最優秀選手を取得
   */
  async getMVP(tournamentId: number): Promise<OutstandingPlayer | null> {
    const { data, error } = await supabase
      .from('outstanding_players')
      .select(`
        *,
        team:teams(id, name, short_name, group_id),
        player:players(id, name, number)
      `)
      .eq('tournament_id', tournamentId)
      .eq('award_type', 'mvp')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return data ? normalizeOutstandingPlayer(data) : null
  },

  /**
   * 優秀選手を取得（MVP以外）
   */
  async getOutstanding(tournamentId: number): Promise<OutstandingPlayer[]> {
    const { data, error } = await supabase
      .from('outstanding_players')
      .select(`
        *,
        team:teams(id, name, short_name, group_id),
        player:players(id, name, number)
      `)
      .eq('tournament_id', tournamentId)
      .eq('award_type', 'outstanding')
      .order('display_order', { ascending: true })

    if (error) throw error

    return (data || []).map(normalizeOutstandingPlayer)
  },

  /**
   * 優秀選手を登録
   */
  async create(player: OutstandingPlayerCreate): Promise<OutstandingPlayer> {
    const { data, error } = await supabase
      .from('outstanding_players')
      .insert({
        tournament_id: player.tournamentId,
        team_id: player.teamId || null,
        player_id: player.playerId || null,
        team_name: player.teamName || null,
        player_name: player.playerName,
        player_number: player.playerNumber || null,
        award_type: player.awardType,
        display_order: player.displayOrder || 0,
      })
      .select()
      .single()

    if (error) throw error

    return normalizeOutstandingPlayer(data)
  },

  /**
   * 優秀選手を更新
   */
  async update(id: number, player: OutstandingPlayerUpdate): Promise<OutstandingPlayer> {
    const updateData: Record<string, unknown> = {}
    if (player.teamId !== undefined) updateData.team_id = player.teamId
    if (player.playerId !== undefined) updateData.player_id = player.playerId
    if (player.teamName !== undefined) updateData.team_name = player.teamName
    if (player.playerName !== undefined) updateData.player_name = player.playerName
    if (player.playerNumber !== undefined) updateData.player_number = player.playerNumber
    if (player.awardType !== undefined) updateData.award_type = player.awardType
    if (player.displayOrder !== undefined) updateData.display_order = player.displayOrder
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('outstanding_players')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return normalizeOutstandingPlayer(data)
  },

  /**
   * 優秀選手を削除
   */
  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('outstanding_players')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * 優秀選手を一括登録（既存を削除して置き換え）
   */
  async replaceAll(tournamentId: number, players: OutstandingPlayerCreate[]): Promise<OutstandingPlayer[]> {
    // 既存データを削除
    const { error: deleteError } = await supabase
      .from('outstanding_players')
      .delete()
      .eq('tournament_id', tournamentId)

    if (deleteError) throw deleteError

    // 新しいデータを挿入
    if (players.length === 0) return []

    const insertData = players.map((p, index) => ({
      tournament_id: tournamentId,
      team_id: p.teamId || null,
      player_id: p.playerId || null,
      team_name: p.teamName || null,
      player_name: p.playerName,
      player_number: p.playerNumber || null,
      award_type: p.awardType,
      display_order: p.displayOrder ?? index,
    }))

    const { data, error } = await supabase
      .from('outstanding_players')
      .insert(insertData)
      .select()

    if (error) throw error

    return (data || []).map(normalizeOutstandingPlayer)
  },
}

/**
 * snake_case → camelCase 変換
 */
function normalizeOutstandingPlayer(data: Record<string, unknown>): OutstandingPlayer {
  return {
    id: data.id as number,
    tournamentId: data.tournament_id as number,
    teamId: data.team_id as number | undefined,
    playerId: data.player_id as number | undefined,
    teamName: data.team_name as string | undefined,
    playerName: data.player_name as string,
    playerNumber: data.player_number as number | undefined,
    awardType: data.award_type as 'mvp' | 'outstanding',
    displayOrder: data.display_order as number,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    team: data.team as OutstandingPlayer['team'],
    player: data.player as OutstandingPlayer['player'],
    // snake_case fallbacks
    tournament_id: data.tournament_id as number,
    team_id: data.team_id as number | undefined,
    player_id: data.player_id as number | undefined,
    team_name: data.team_name as string | undefined,
    player_name: data.player_name as string,
    player_number: data.player_number as number | undefined,
    award_type: data.award_type as 'mvp' | 'outstanding',
    display_order: data.display_order as number,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  }
}

export default outstandingPlayersApi
