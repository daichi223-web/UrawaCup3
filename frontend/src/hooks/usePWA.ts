/**
 * 浦和カップ トーナメント管理システム - PWAフック（無効化版）
 *
 * PWA機能は一時的に無効化されています。
 * スタブ実装を提供してビルドエラーを防止します。
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================
// Service Worker登録フック（スタブ）
// ============================================

interface UseServiceWorkerResult {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => void;
}

/**
 * Service Workerの登録と更新を管理するフック（無効化版）
 */
export function useServiceWorker(): UseServiceWorkerResult {
  return {
    needRefresh: false,
    offlineReady: false,
    updateServiceWorker: async () => {},
    skipWaiting: () => {},
  };
}

// ============================================
// オンライン状態フック
// ============================================

/**
 * オンライン/オフライン状態を監視するフック
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// ============================================
// インストールプロンプトフック（スタブ）
// ============================================

interface UseInstallPromptResult {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
}

/**
 * PWAインストールプロンプトを管理するフック（無効化版）
 */
export function useInstallPrompt(): UseInstallPromptResult {
  return {
    canInstall: false,
    isInstalled: false,
    promptInstall: async () => false,
  };
}

// ============================================
// 同期状態フック（スタブ）
// ============================================

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  conflictCount: number;
  error: string | null;
}

interface UseSyncStateResult extends SyncState {
  sync: () => Promise<void>;
}

/**
 * オフライン同期状態を監視するフック（無効化版）
 */
export function useSyncState(): UseSyncStateResult {
  return {
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    conflictCount: 0,
    error: null,
    sync: async () => {},
  };
}

// ============================================
// ネットワーク状態の詳細フック
// ============================================

interface NetworkInfo {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * ネットワーク情報を取得するフック
 */
export function useNetworkInfo(): NetworkInfo {
  const isOnline = useOnlineStatus();
  return { isOnline };
}
