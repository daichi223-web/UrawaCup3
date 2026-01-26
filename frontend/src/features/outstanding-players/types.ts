/**
 * 優秀選手機能の型定義
 */

// 共通型を再エクスポート
export type {
  OutstandingPlayer,
  OutstandingPlayerCreate,
  OutstandingPlayerUpdate,
} from '@shared/types'

// ローカル型定義

/**
 * 選手エントリー（フォーム用）
 */
export interface PlayerEntry {
  id?: number
  teamId?: number
  teamName: string
  playerId?: number
  playerName: string
  playerNumber?: number
  awardType: 'mvp' | 'outstanding'
}

/**
 * 選手検索結果
 */
export interface PlayerSearchResult {
  id: number
  name: string
  number: number
  team_id: number
}
