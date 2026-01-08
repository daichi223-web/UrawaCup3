/**
 * WebSocket接続管理フック（Supabase版 - ダミー実装）
 *
 * Supabaseに移行後、カスタムWebSocketは不要
 * Supabase Realtimeを使用するため、このフックは互換性のためのスタブ
 */

import { useState } from 'react';

// WebSocketイベントタイプ
export type WebSocketEventType =
  | 'CONNECTED'
  | 'MATCH_UPDATE'
  | 'STANDING_UPDATE'
  | 'APPROVAL_UPDATE'
  | 'MATCH_LOCKED'
  | 'MATCH_UNLOCKED';

// 試合更新ペイロード
export interface MatchUpdatePayload {
  match_id: number;
  tournament_id: number;
  action?: 'score_updated' | 'created' | 'deleted' | 'approved' | 'rejected';
  home_score?: number;
  away_score?: number;
  group_id?: string;
  status?: string;
  timestamp?: string;
}

// 順位表更新ペイロード
export interface StandingUpdatePayload {
  tournament_id: number;
  group_id: string;
  reason?: string;
  timestamp?: string;
}

// 承認更新ペイロード
export interface ApprovalUpdatePayload {
  match_id: number;
  tournament_id: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by_name?: string;
  timestamp?: string;
}

// 接続確認ペイロード
export interface ConnectedPayload {
  message: string;
  timestamp: string;
  connection_count: number;
}

// WebSocketメッセージ型
export type WebSocketMessage =
  | { type: 'CONNECTED'; payload: ConnectedPayload }
  | { type: 'MATCH_UPDATE'; payload: MatchUpdatePayload }
  | { type: 'STANDING_UPDATE'; payload: StandingUpdatePayload }
  | { type: 'APPROVAL_UPDATE'; payload: ApprovalUpdatePayload }
  | { type: 'MATCH_LOCKED'; payload: { match_id: number; locked_by: string } }
  | { type: 'MATCH_UNLOCKED'; payload: { match_id: number } };

// 接続状態
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// フックの戻り値
export interface UseWebSocketReturn {
  connectionState: ConnectionState;
  connectionCount: number;
  lastMessage: WebSocketMessage | null;
  reconnect: () => void;
}

/**
 * WebSocket接続管理フック（ダミー実装）
 * Supabase Realtimeを使用するため、WebSocket接続は行わない
 */
export function useWebSocket(
  _onMessage?: (message: WebSocketMessage) => void
): UseWebSocketReturn {
  const [connectionState] = useState<ConnectionState>('disconnected');
  const [connectionCount] = useState(0);
  const [lastMessage] = useState<WebSocketMessage | null>(null);

  const reconnect = () => {
    // Supabase版では何もしない
    console.log('[WebSocket] Supabase Realtimeを使用中 - カスタムWebSocketは無効');
  };

  return {
    connectionState,
    connectionCount,
    lastMessage,
    reconnect,
  };
}
