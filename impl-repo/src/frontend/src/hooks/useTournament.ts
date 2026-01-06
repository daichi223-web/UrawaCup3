/**
 * トーナメントID取得用カスタムフック
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useAppStore } from '../store/appStore'

/**
 * 現在選択中のトーナメントIDを取得
 * @returns tournamentId または null
 */
export function useTournamentId(): number | null {
  const currentTournament = useAppStore((state) => state.currentTournament)
  return currentTournament?.id ?? null
}

/**
 * 現在選択中のトーナメント情報を取得
 */
export function useTournament() {
  return useAppStore((state) => state.currentTournament)
}

/**
 * トーナメント選択アクションを取得
 */
export function useSetTournament() {
  return useAppStore((state) => state.setCurrentTournament)
}
