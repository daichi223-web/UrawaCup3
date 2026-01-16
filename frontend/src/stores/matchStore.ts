import { create } from 'zustand'
import type {
  Match,
  MatchWithDetails,
  MatchScoreInput,
  GoalInput,
  MatchStatus,
  ApprovalStatus,
  MatchApprovalResponse,
  PendingMatchesResponse
} from '@shared/types'
import { matchesApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

/**
 * 試合管理状態
 */
interface MatchState {
  // 試合一覧
  matches: MatchWithDetails[]
  isLoading: boolean
  error: string | null

  // 承認待ち試合
  pendingApprovalMatches: MatchWithDetails[]
  pendingApprovalCount: number

  // 選択中の試合
  selectedMatch: MatchWithDetails | null
  isEditing: boolean

  // 得点入力中のデータ
  pendingGoals: GoalInput[]

  // アクション
  fetchMatches: (tournamentId: number, options?: { date?: string; venueId?: number; approvalStatus?: ApprovalStatus }) => Promise<void>
  selectMatch: (match: MatchWithDetails | null) => void
  updateMatchScore: (matchId: number, score: MatchScoreInput) => Promise<boolean>
  updateMatchStatus: (matchId: number, status: MatchStatus) => Promise<boolean>

  // 得点管理
  addPendingGoal: (goal: GoalInput) => void
  removePendingGoal: (index: number) => void
  updatePendingGoal: (index: number, goal: GoalInput) => void
  clearPendingGoals: () => void

  // ロック管理
  lockMatch: (matchId: number) => Promise<boolean>
  unlockMatch: (matchId: number) => Promise<boolean>

  // 承認フロー管理
  fetchPendingApprovalMatches: (tournamentId?: number, venueId?: number) => Promise<void>
  approveMatch: (matchId: number, userId: number) => Promise<boolean>
  rejectMatch: (matchId: number, userId: number, reason: string) => Promise<boolean>
  resubmitMatch: (matchId: number, userId: number) => Promise<boolean>

  // 編集モード
  setEditing: (isEditing: boolean) => void
  clearError: () => void
}

/**
 * 試合管理ストア
 * - 試合一覧の取得・更新
 * - スコア・得点の入力
 * - ロック機能
 */
export const useMatchStore = create<MatchState>((set, _get) => ({
  // 初期状態
  matches: [],
  isLoading: false,
  error: null,
  pendingApprovalMatches: [],
  pendingApprovalCount: 0,
  selectedMatch: null,
  isEditing: false,
  pendingGoals: [],

  /**
   * 試合一覧を取得
   */
  fetchMatches: async (tournamentId, options) => {
    set({ isLoading: true, error: null })
    try {
      const { matches } = await matchesApi.getAll(tournamentId, {
        status: options?.approvalStatus
      })
      // フィルタリング
      let filtered = matches as MatchWithDetails[]
      if (options?.date) {
        filtered = filtered.filter(m => m.match_date === options.date)
      }
      if (options?.venueId) {
        filtered = filtered.filter(m => m.venue_id === options.venueId)
      }
      set({ matches: filtered, isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : '試合データの取得に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
    }
  },

  /**
   * 試合を選択
   */
  selectMatch: (match) => {
    set({ selectedMatch: match, pendingGoals: [] })
  },

  /**
   * 試合スコアを更新
   */
  updateMatchScore: async (matchId, score) => {
    set({ isLoading: true, error: null })
    try {
      const data = await matchesApi.updateScore(matchId, {
        home_score_half1: score.homeScoreHalf1,
        home_score_half2: score.homeScoreHalf2,
        away_score_half1: score.awayScoreHalf1,
        away_score_half2: score.awayScoreHalf2,
        status: 'completed'
      })

      // 一覧を更新
      set((state) => ({
        matches: state.matches.map((m) =>
          m.id === matchId ? { ...m, ...data } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, ...data }
          : state.selectedMatch,
        isLoading: false,
        pendingGoals: [],
        isEditing: false,
      }))

      toast.success('試合結果を保存しました')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '試合結果の保存に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
      return false
    }
  },

  /**
   * 試合ステータスを更新
   */
  updateMatchStatus: async (matchId, status) => {
    try {
      await matchesApi.update(matchId, { status })

      set((state) => ({
        matches: state.matches.map((m) =>
          m.id === matchId ? { ...m, status } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, status }
          : state.selectedMatch,
      }))

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ステータスの更新に失敗しました'
      toast.error(message)
      return false
    }
  },

  /**
   * 保留中の得点を追加
   */
  addPendingGoal: (goal) => {
    set((state) => ({
      pendingGoals: [...state.pendingGoals, goal].sort((a, b) => {
        // ハーフ → 時間でソート
        if (a.half !== b.half) return a.half - b.half
        return a.minute - b.minute
      }),
    }))
  },

  /**
   * 保留中の得点を削除
   */
  removePendingGoal: (index) => {
    set((state) => ({
      pendingGoals: state.pendingGoals.filter((_, i) => i !== index),
    }))
  },

  /**
   * 保留中の得点を更新
   */
  updatePendingGoal: (index, goal) => {
    set((state) => ({
      pendingGoals: state.pendingGoals.map((g, i) => (i === index ? goal : g)),
    }))
  },

  /**
   * 保留中の得点をクリア
   */
  clearPendingGoals: () => {
    set({ pendingGoals: [] })
  },

  /**
   * 試合をロック
   */
  lockMatch: async (matchId) => {
    try {
      await matchesApi.update(matchId, { is_locked: true })

      set((state) => ({
        matches: state.matches.map((m) =>
          m.id === matchId ? { ...m, isLocked: true } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, isLocked: true }
          : state.selectedMatch,
      }))

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ロックに失敗しました'
      toast.error(message)
      return false
    }
  },

  /**
   * 試合のロックを解除
   */
  unlockMatch: async (matchId) => {
    try {
      await matchesApi.update(matchId, { is_locked: false })

      set((state) => ({
        matches: state.matches.map((m) =>
          m.id === matchId ? { ...m, isLocked: false } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, isLocked: false }
          : state.selectedMatch,
      }))

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ロック解除に失敗しました'
      toast.error(message)
      return false
    }
  },

  /**
   * 承認待ち試合一覧を取得
   */
  fetchPendingApprovalMatches: async (tournamentId, venueId) => {
    set({ isLoading: true, error: null })
    try {
      let query = supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, short_name),
          away_team:teams!matches_away_team_id_fkey(name, short_name),
          venue:venues(name)
        `)
        .eq('approval_status', 'pending')

      if (tournamentId) query = query.eq('tournament_id', tournamentId)
      if (venueId) query = query.eq('venue_id', venueId)

      const { data, error } = await query.order('match_date').order('match_time')
      if (error) throw error

      set({
        pendingApprovalMatches: (data || []) as MatchWithDetails[],
        pendingApprovalCount: data?.length || 0,
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '承認待ち試合の取得に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
    }
  },

  /**
   * 試合結果を承認
   */
  approveMatch: async (matchId, _userId) => {
    set({ isLoading: true, error: null })
    try {
      await matchesApi.update(matchId, {
        approval_status: 'approved',
        approved_at: new Date().toISOString()
      })

      // 承認待ち一覧から削除
      set((state) => ({
        pendingApprovalMatches: state.pendingApprovalMatches.filter(m => m.id !== matchId),
        pendingApprovalCount: state.pendingApprovalCount - 1,
        // メイン一覧も更新
        matches: state.matches.map(m =>
          m.id === matchId ? { ...m, approvalStatus: 'approved' as const } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, approvalStatus: 'approved' as const }
          : state.selectedMatch,
        isLoading: false,
      }))

      toast.success('試合結果を承認しました')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '試合の承認に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
      return false
    }
  },

  /**
   * 試合結果を却下
   */
  rejectMatch: async (matchId, _userId, reason) => {
    set({ isLoading: true, error: null })
    try {
      await matchesApi.update(matchId, {
        approval_status: 'rejected',
        rejection_reason: reason
      })

      // 承認待ち一覧から削除
      set((state) => ({
        pendingApprovalMatches: state.pendingApprovalMatches.filter(m => m.id !== matchId),
        pendingApprovalCount: state.pendingApprovalCount - 1,
        // メイン一覧も更新
        matches: state.matches.map(m =>
          m.id === matchId ? { ...m, approvalStatus: 'rejected' as const, rejectionReason: reason } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, approvalStatus: 'rejected' as const, rejectionReason: reason }
          : state.selectedMatch,
        isLoading: false,
      }))

      toast.success('試合結果を却下しました')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '試合の却下に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
      return false
    }
  },

  /**
   * 却下された試合結果を再提出
   */
  resubmitMatch: async (matchId, _userId) => {
    set({ isLoading: true, error: null })
    try {
      await matchesApi.update(matchId, {
        approval_status: 'pending',
        rejection_reason: null
      })

      // 一覧を更新
      set((state) => ({
        matches: state.matches.map(m =>
          m.id === matchId ? { ...m, approvalStatus: 'pending' as const, rejectionReason: undefined } : m
        ),
        selectedMatch: state.selectedMatch?.id === matchId
          ? { ...state.selectedMatch, approvalStatus: 'pending' as const, rejectionReason: undefined }
          : state.selectedMatch,
        isLoading: false,
      }))

      toast.success('試合結果を再提出しました')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '試合の再提出に失敗しました'
      set({ error: message, isLoading: false })
      toast.error(message)
      return false
    }
  },

  /**
   * 編集モードの切り替え
   */
  setEditing: (isEditing) => {
    set({ isEditing })
  },

  /**
   * エラーのクリア
   */
  clearError: () => {
    set({ error: null })
  },
}))
