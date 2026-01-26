/**
 * 優秀選手機能のカスタムフック
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outstandingPlayersApi } from './api'
import type { OutstandingPlayerCreate, OutstandingPlayerUpdate } from './types'

/**
 * 優秀選手一覧を取得
 */
export function useOutstandingPlayers(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: ['outstanding-players', tournamentId],
    queryFn: () => outstandingPlayersApi.getAll(tournamentId),
    enabled,
  })
}

/**
 * MVPを取得
 */
export function useMVP(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: ['outstanding-players', tournamentId, 'mvp'],
    queryFn: () => outstandingPlayersApi.getMVP(tournamentId),
    enabled,
  })
}

/**
 * 優秀選手（MVP以外）を取得
 */
export function useOutstanding(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: ['outstanding-players', tournamentId, 'outstanding'],
    queryFn: () => outstandingPlayersApi.getOutstanding(tournamentId),
    enabled,
  })
}

/**
 * 優秀選手を登録
 */
export function useCreateOutstandingPlayer(tournamentId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (player: OutstandingPlayerCreate) => outstandingPlayersApi.create(player),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-players', tournamentId] })
    },
  })
}

/**
 * 優秀選手を更新
 */
export function useUpdateOutstandingPlayer(tournamentId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OutstandingPlayerUpdate }) =>
      outstandingPlayersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-players', tournamentId] })
    },
  })
}

/**
 * 優秀選手を削除
 */
export function useDeleteOutstandingPlayer(tournamentId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => outstandingPlayersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-players', tournamentId] })
    },
  })
}

/**
 * 優秀選手を一括登録（既存を置き換え）
 */
export function useReplaceOutstandingPlayers(tournamentId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (players: OutstandingPlayerCreate[]) =>
      outstandingPlayersApi.replaceAll(tournamentId, players),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-players', tournamentId] })
    },
  })
}
