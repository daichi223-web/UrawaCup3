/**
 * オフライン同期サービス
 * ペンディング中のデータをサーバーに同期
 */

import axios from 'axios'
import { db, PendingSync, SyncConflict } from './db'

const MAX_RETRY_COUNT = 3

interface SyncResult {
  success: boolean
  synced: number
  failed: number
  conflicts: number
}

/**
 * すべてのペンディングデータを同期
 */
export async function syncAll(): Promise<SyncResult> {
  const pending = await db.pendingSync.toArray()
  let synced = 0
  let failed = 0
  let conflicts = 0

  for (const item of pending) {
    try {
      const result = await syncItem(item)
      if (result === 'success') {
        await db.pendingSync.delete(item.id!)
        synced++
      } else if (result === 'conflict') {
        conflicts++
      } else {
        failed++
      }
    } catch (error) {
      console.error('Sync error:', error)
      failed++
    }
  }

  return { success: failed === 0, synced, failed, conflicts }
}

/**
 * 個別アイテムの同期
 */
async function syncItem(item: PendingSync): Promise<'success' | 'conflict' | 'failed'> {
  try {
    switch (item.type) {
      case 'match_score':
        await axios.put(`/api/matches/${item.matchId}/score`, item.data)
        break
      case 'match_approve':
        await axios.post(`/api/matches/${item.matchId}/approve`, null, {
          params: { user_id: item.data.user_id },
        })
        break
      case 'match_reject':
        await axios.post(`/api/matches/${item.matchId}/reject`, null, {
          params: {
            user_id: item.data.user_id,
            reason: item.data.reason,
          },
        })
        break
      default:
        console.warn('Unknown sync type:', item.type)
        return 'failed'
    }

    return 'success'
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      // 競合検出
      await createConflict(item, error.response.data)
      return 'conflict'
    }

    // リトライカウント更新
    await db.pendingSync.update(item.id!, {
      retryCount: item.retryCount + 1,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    })

    if (item.retryCount >= MAX_RETRY_COUNT) {
      await db.pendingSync.delete(item.id!)
      return 'failed'
    }

    throw error
  }
}

/**
 * 競合レコードを作成
 */
async function createConflict(
  item: PendingSync,
  serverData: Record<string, unknown>
): Promise<void> {
  const conflict: SyncConflict = {
    type: item.type,
    matchId: item.matchId,
    localData: item.data,
    serverData,
    createdAt: new Date(),
    resolved: false,
  }

  await db.conflicts.add(conflict)
  await db.pendingSync.delete(item.id!)
}

/**
 * オフライン時に試合結果を保存
 */
export async function saveMatchResultOffline(
  matchId: number,
  scoreData: Record<string, unknown>
): Promise<void> {
  const pending: PendingSync = {
    type: 'match_score',
    matchId,
    data: scoreData,
    createdAt: new Date(),
    retryCount: 0,
  }

  await db.pendingSync.add(pending)

  // ローカルのmatchも更新
  await db.matches.update(matchId, {
    homeScoreTotal: scoreData.home_score_half1 as number + (scoreData.home_score_half2 as number),
    awayScoreTotal: scoreData.away_score_half1 as number + (scoreData.away_score_half2 as number),
    status: 'completed',
    syncedAt: new Date(),
  })
}

/**
 * 競合を解決
 */
export async function resolveConflict(
  conflictId: number,
  useLocal: boolean
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId)
  if (!conflict) return

  if (useLocal) {
    // ローカルデータを再同期
    const pending: PendingSync = {
      type: conflict.type as PendingSync['type'],
      matchId: conflict.matchId,
      data: conflict.localData,
      createdAt: new Date(),
      retryCount: 0,
    }
    await db.pendingSync.add(pending)
  }

  // 競合を解決済みにマーク
  await db.conflicts.update(conflictId, { resolved: true })
}

/**
 * オンライン復帰時の自動同期
 */
export function setupAutoSync(): void {
  window.addEventListener('online', async () => {
    console.log('Network online - starting sync...')
    const result = await syncAll()
    console.log('Sync result:', result)
  })
}
