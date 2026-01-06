/**
 * IndexedDBデータベース設定 (Dexie.js)
 * オフライン対応のためのローカルストレージ
 */

import Dexie, { Table } from 'dexie'

// ローカル保存用の型定義
export interface LocalTournament {
  id: number
  name: string
  year: number | null
  syncedAt: Date
}

export interface LocalTeam {
  id: number
  tournamentId: number
  groupId: string
  name: string
  syncedAt: Date
}

export interface LocalMatch {
  id: number
  tournamentId: number
  groupId: string | null
  homeTeamId: number | null
  awayTeamId: number | null
  matchDate: string | null
  matchTime: string | null
  status: string
  homeScoreTotal: number
  awayScoreTotal: number
  approvalStatus: string
  syncedAt: Date
}

export interface LocalStanding {
  id: string  // tournamentId_groupId_teamId
  tournamentId: number
  groupId: string
  teamId: number
  teamName: string
  rank: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  syncedAt: Date
}

export interface PendingSync {
  id?: number
  type: 'match_score' | 'match_approve' | 'match_reject'
  matchId: number
  data: Record<string, unknown>
  createdAt: Date
  retryCount: number
  lastError?: string
}

export interface SyncConflict {
  id?: number
  type: string
  matchId: number
  localData: Record<string, unknown>
  serverData: Record<string, unknown>
  createdAt: Date
  resolved: boolean
}

class UrawaCupDB extends Dexie {
  tournaments!: Table<LocalTournament>
  teams!: Table<LocalTeam>
  matches!: Table<LocalMatch>
  standings!: Table<LocalStanding>
  pendingSync!: Table<PendingSync>
  conflicts!: Table<SyncConflict>

  constructor() {
    super('UrawaCupDB')

    this.version(2).stores({
      tournaments: 'id, name',
      teams: 'id, tournamentId, groupId',
      matches: 'id, tournamentId, groupId, matchDate, status',
      standings: '++id, tournamentId, groupId, teamId',
      pendingSync: '++id, type, matchId, createdAt',
      conflicts: '++id, type, matchId, resolved',
    })
  }
}

export const db = new UrawaCupDB()

// データベース初期化（エラー時は再作成）
db.open().catch(async (err) => {
  console.error('Database open failed:', err)
  if (err.name === 'UpgradeError' || err.name === 'DatabaseClosedError') {
    console.log('Deleting and recreating database...')
    await Dexie.delete('UrawaCupDB')
    window.location.reload()
  }
})

// ユーティリティ関数
export async function clearAllData(): Promise<void> {
  await db.tournaments.clear()
  await db.teams.clear()
  await db.matches.clear()
  await db.standings.clear()
}

export async function getPendingSyncCount(): Promise<number> {
  return await db.pendingSync.count()
}

export async function hasUnresolvedConflicts(): Promise<boolean> {
  const count = await db.conflicts.where('resolved').equals(0).count()
  return count > 0
}
