/**
 * 浦和カップ トーナメント管理システム - PWAフック
 */

import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// ============================================
// Service Worker登録フック
// ============================================

interface UseServiceWorkerResult {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => void;
}

/**
 * Service Workerの登録と更新を管理するフック
 */
export function useServiceWorker(): UseServiceWorkerResult {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // 1時間ごとに更新チェック
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {
      await updateServiceWorker(true);
    },
    skipWaiting: () => setNeedRefresh(false),
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
// インストールプロンプトフック
// ============================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UseInstallPromptResult {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
}

/**
 * PWAインストールプロンプトを管理するフック
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // standalone モードなら既にインストール済み
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  };

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    promptInstall,
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
 * オフライン同期状態フック（スタブ — オフライン同期は削除済み）
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
