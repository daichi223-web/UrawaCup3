/**
 * 浦和カップ トーナメント管理システム - 同期サービス
 *
 * Supabaseへの移行後、オフライン同期機能は無効化
 * Supabaseはリアルタイム同期を提供するため、この機能は不要
 */

// ============================================
// 同期ステータス管理（ダミー実装）
// ============================================

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  conflictCount: number;
  error: string | null;
}

const syncState: SyncState = {
  isSyncing: false,
  lastSyncAt: new Date(),
  pendingCount: 0,
  conflictCount: 0,
  error: null,
};

type SyncListener = (state: SyncState) => void;
const listeners: Set<SyncListener> = new Set();

/**
 * 同期ステータスのリスナーを追加
 */
export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  // 現在のステートを即座に通知
  listener(syncState);
  return () => listeners.delete(listener);
}

/**
 * 現在の同期ステータスを取得
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

// ============================================
// 同期処理（ダミー実装）
// ============================================

/**
 * 同期キューの全アイテムを同期（Supabase版では何もしない）
 */
export async function syncAll(): Promise<void> {
  // Supabaseはリアルタイム同期を提供するため、手動同期は不要
  if (import.meta.env.DEV) console.log('[SyncService] Supabase版では自動同期されます');
}

// ============================================
// オンライン/オフラインイベント処理
// ============================================

/**
 * オンラインイベントハンドラ
 */
export function handleOnline(): void {
  if (import.meta.env.DEV) console.log('[SyncService] オンラインになりました');
}

/**
 * オフラインイベントハンドラ
 */
export function handleOffline(): void {
  if (import.meta.env.DEV) console.log('[SyncService] オフラインになりました');
}

// ============================================
// 初期化
// ============================================

let isInitialized = false;

/**
 * 同期サービスを初期化
 */
export function initSyncService(): void {
  if (isInitialized) return;

  // オンライン/オフラインイベントリスナーを登録
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  isInitialized = true;
  if (import.meta.env.DEV) console.log('[SyncService] 初期化完了（Supabase版）');
}

/**
 * 同期サービスを破棄
 */
export function destroySyncService(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  listeners.clear();
  isInitialized = false;
}

// ============================================
// 試合データ専用の同期関数（ダミー実装）
// ============================================

/**
 * 試合結果をオフライン対応で保存（Supabaseでは直接保存）
 */
export async function saveMatchResultOffline(
  matchId: number,
  data: unknown
): Promise<void> {
  if (import.meta.env.DEV) console.log('[SyncService] Supabase版では直接API経由で保存されます', matchId, data);
}

/**
 * 得点をオフライン対応で保存（Supabaseでは直接保存）
 */
export async function saveGoalOffline(
  matchId: number,
  goalData: unknown
): Promise<number> {
  if (import.meta.env.DEV) console.log('[SyncService] Supabase版では直接API経由で保存されます', matchId, goalData);
  return Date.now();
}
