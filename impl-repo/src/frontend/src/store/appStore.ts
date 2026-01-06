/**
 * Zustand アプリケーションストア
 */

import { create } from 'zustand'

interface Tournament {
  id: number
  name: string
  year: number | null
  startDate?: string
  endDate?: string
}

interface User {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'venue_staff' | 'viewer'
}

interface AppState {
  // 認証
  user: User | null
  isAuthenticated: boolean

  // 大会
  currentTournament: Tournament | null

  // アクション
  setUser: (user: User | null) => void
  setCurrentTournament: (tournament: Tournament | null) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // 初期状態
  user: null,
  isAuthenticated: false,
  currentTournament: null,

  // アクション
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setCurrentTournament: (tournament) => set({ currentTournament: tournament }),

  logout: () => set({ user: null, isAuthenticated: false }),
}))
