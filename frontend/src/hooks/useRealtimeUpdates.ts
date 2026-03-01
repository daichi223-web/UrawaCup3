/**
 * リアルタイム更新フック
 *
 * Supabase Realtime の postgres_changes を購読し、
 * 変更を検知したら React Query キャッシュを invalidate する
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { realtimeApi } from '@/lib/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

const TOAST_DURATION = 4000;

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// モジュールスコープで接続状態を共有（useConnectionStatus から参照）
let sharedConnectionState: ConnectionState = 'disconnected';
const stateListeners = new Set<() => void>();
function setSharedState(state: ConnectionState) {
  sharedConnectionState = state;
  stateListeners.forEach((fn) => fn());
}

export interface UseRealtimeUpdatesOptions {
  showNotifications?: boolean;
  tournamentId?: number;
  groupId?: string;
}

export interface UseRealtimeUpdatesReturn {
  connectionState: ConnectionState;
}

/**
 * リアルタイム更新フック
 *
 * @param options オプション設定
 * @returns 接続状態
 */
export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions = {}
): UseRealtimeUpdatesReturn {
  const { showNotifications = true, tournamentId } = options;
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!tournamentId) return;

    setConnectionState('connecting');
    setSharedState('connecting');
    const channels: RealtimeChannel[] = [];

    // matches テーブルの変更を購読
    const matchChannel = realtimeApi.subscribeToMatches(tournamentId, (payload) => {
      queryClient.invalidateQueries({
        queryKey: ['matches', tournamentId],
        refetchType: 'none',
      });

      const newRecord = payload.new as Record<string, unknown> | undefined;
      if (newRecord?.id) {
        queryClient.invalidateQueries({
          queryKey: ['match', newRecord.id],
          exact: true,
        });
      }

      // 順位表も invalidate
      queryClient.invalidateQueries({
        queryKey: ['standings', tournamentId],
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['pending-matches'],
        refetchType: 'active',
      });

      if (showNotifications) {
        toast.success('試合情報が更新されました', {
          duration: TOAST_DURATION,
          icon: '⚽',
        });
      }
    });
    channels.push(matchChannel);

    // standings テーブルの変更を購読
    const standingsChannel = realtimeApi.subscribeToStandings(tournamentId, () => {
      queryClient.invalidateQueries({
        queryKey: ['standings', tournamentId],
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['public-standings'],
      });

      if (showNotifications) {
        toast.success('順位表が更新されました', {
          duration: TOAST_DURATION,
          icon: '📊',
        });
      }
    });
    channels.push(standingsChannel);

    channelsRef.current = channels;
    setConnectionState('connected');
    setSharedState('connected');

    return () => {
      for (const channel of channels) {
        realtimeApi.unsubscribe(channel);
      }
      channelsRef.current = [];
      setConnectionState('disconnected');
      setSharedState('disconnected');
    };
  }, [tournamentId, queryClient, showNotifications]);

  return { connectionState };
}

/**
 * 接続状態インジケーター用フック
 * useRealtimeUpdates が管理する実際の接続状態を反映する
 */
export function useConnectionStatus() {
  const state = useSyncExternalStore(
    (cb) => { stateListeners.add(cb); return () => stateListeners.delete(cb); },
    () => sharedConnectionState,
  );
  return {
    isConnected: state === 'connected',
    isConnecting: state === 'connecting',
    isReconnecting: state === 'reconnecting',
    connectionCount: state === 'connected' ? 1 : 0,
    reconnect: () => {},
  };
}
