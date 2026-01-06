/**
 * リアルタイム更新フック
 * WebSocketメッセージを受信してReact Queryキャッシュを更新
 */

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from './useWebSocket'
import { useTournamentId } from './useTournament'

interface MatchUpdateMessage {
  type: 'MATCH_UPDATE'
  match_id: number
  data: {
    home_score_total: number
    away_score_total: number
    status: string
    approval_status: string
  }
  timestamp: string
}

interface StandingUpdateMessage {
  type: 'STANDING_UPDATE'
  group_id: string
  data: { updated: boolean }
  timestamp: string
}

interface ApprovalUpdateMessage {
  type: 'APPROVAL_UPDATE'
  match_id: number
  status: string
  timestamp: string
}

interface MatchLockedMessage {
  type: 'MATCH_LOCKED'
  match_id: number
  user_id: number
  locked: boolean
  timestamp: string
}

type WebSocketMessage =
  | MatchUpdateMessage
  | StandingUpdateMessage
  | ApprovalUpdateMessage
  | MatchLockedMessage

export function useRealtimeUpdates() {
  const tournamentId = useTournamentId()
  const queryClient = useQueryClient()

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'MATCH_UPDATE':
          // 試合一覧キャッシュを無効化
          queryClient.invalidateQueries({
            queryKey: ['matches', tournamentId],
          })
          // 個別試合キャッシュを無効化
          queryClient.invalidateQueries({
            queryKey: ['match', message.match_id],
          })
          break

        case 'STANDING_UPDATE':
          // 順位表キャッシュを無効化
          queryClient.invalidateQueries({
            queryKey: ['standings', tournamentId],
          })
          break

        case 'APPROVAL_UPDATE':
          // 承認待ち一覧を無効化
          queryClient.invalidateQueries({
            queryKey: ['pendingMatches', tournamentId],
          })
          // 試合詳細を無効化
          queryClient.invalidateQueries({
            queryKey: ['match', message.match_id],
          })
          break

        case 'MATCH_LOCKED':
          // 試合ロック状態を更新
          queryClient.invalidateQueries({
            queryKey: ['matchLock', message.match_id],
          })
          break

        default:
          console.log('Unknown WebSocket message type:', message)
      }
    },
    [queryClient, tournamentId]
  )

  const { status, isConnected, reconnect } = useWebSocket({
    tournamentId,
    onMessage: handleMessage as (msg: unknown) => void,
  })

  return {
    connectionStatus: status,
    isConnected,
    reconnect,
  }
}
