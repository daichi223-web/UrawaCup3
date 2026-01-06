/**
 * WebSocket接続管理フック
 */

import { useState, useEffect, useRef, useCallback } from 'react'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  tournamentId: number | null
  onMessage?: (message: WebSocketMessage) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket({
  tournamentId,
  onMessage,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = useCallback(() => {
    if (!tournamentId) return

    // 既存の接続をクリーンアップ
    if (wsRef.current) {
      wsRef.current.close()
    }

    setStatus('connecting')

    // 開発環境ではバックエンドに直接接続
    const isDev = import.meta.env.DEV
    const wsHost = isDev ? 'localhost:8000' : window.location.host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${wsHost}/ws?tournament_id=${tournamentId}`

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setStatus('connected')
        reconnectAttemptsRef.current = 0

        // ハートビート開始（30秒間隔）
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        if (event.data === 'pong') return // ハートビート応答を無視

        try {
          const message = JSON.parse(event.data) as WebSocketMessage
          onMessage?.(message)
        } catch (e) {
          console.error('WebSocket message parse error:', e)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        wsRef.current = null

        // ハートビート停止
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }

        // 再接続
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setStatus('reconnecting')
          reconnectAttemptsRef.current++
          const delay = reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1)
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('WebSocket connection error:', error)
      setStatus('disconnected')
    }
  }, [tournamentId, onMessage, reconnectInterval, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    reconnectAttemptsRef.current = maxReconnectAttempts // 再接続を防止
    setStatus('disconnected')
  }, [maxReconnectAttempts])

  useEffect(() => {
    if (tournamentId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [tournamentId, connect, disconnect])

  return {
    status,
    isConnected: status === 'connected',
    reconnect: connect,
    disconnect,
  }
}
