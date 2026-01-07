import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, UserRole, LoginRequest } from '@shared/types'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'

/**
 * 認証状態の型定義
 */
interface AuthState {
  // 状態
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // アクション
  login: (credentials: LoginRequest) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
  setUser: (user: User) => void

  // 権限チェック
  hasRole: (role: UserRole) => boolean
  canEditVenue: (venueId: number) => boolean
}

/**
 * 認証状態管理ストア - Supabase Auth版
 * - ログイン/ログアウト
 * - 認証トークン管理
 * - 権限チェック
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初期状態
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * ログイン処理 - Supabase Auth
       */
      login: async (credentials: LoginRequest): Promise<boolean> => {
        set({ isLoading: true, error: null })
        try {
          // 開発環境のみ: admin/admin123 でログイン可能
          if (import.meta.env.DEV && credentials.username === 'admin' && credentials.password === 'admin123') {
            const devUser: User = {
              id: 1 as any,
              username: 'admin',
              email: 'admin@urawa-cup.local',
              role: 'admin',
              name: '管理者',
              venueId: undefined,
            }
            set({
              user: devUser,
              accessToken: 'dev-token',
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
            console.warn('[DEV] 開発用バイパスでログインしました')
            return true
          }

          // Supabase Authでログイン（usernameをemailとして使用）
          const email = credentials.username.includes('@')
            ? credentials.username
            : `${credentials.username}@urawa-cup.local`

          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: credentials.password,
          })

          if (authError) throw authError

          if (!authData.user || !authData.session) {
            throw new Error('認証に失敗しました')
          }

          // プロフィール情報を取得
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single()

          const user: User = {
            id: authData.user.id as any,
            username: profile?.username || authData.user.email?.split('@')[0] || 'user',
            email: authData.user.email || '',
            role: (profile?.role as UserRole) || 'viewer',
            name: profile?.name || authData.user.email?.split('@')[0] || 'User',
            venueId: profile?.venue_id,
          }

          set({
            user,
            accessToken: authData.session.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : 'ログインに失敗しました'
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          })
          return false
        }
      },

      /**
       * ログアウト処理
       */
      logout: async () => {
        try {
          await supabase.auth.signOut()
        } catch (error) {
          console.error('ログアウトエラー:', error)
        }

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      },

      /**
       * 認証状態の確認（セッション検証）
       */
      checkAuth: async () => {
        set({ isLoading: true })
        try {
          // Supabaseのセッションを確認
          const { data: { session } } = await supabase.auth.getSession()

          if (session?.user) {
            // プロフィール情報を取得
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            const user: User = {
              id: session.user.id as any,
              username: profile?.username || session.user.email?.split('@')[0] || 'user',
              email: session.user.email || '',
              role: (profile?.role as UserRole) || 'viewer',
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              venueId: profile?.venue_id,
            }

            set({
              user,
              accessToken: session.access_token,
              isAuthenticated: true,
              isLoading: false,
            })
            return
          }
        } catch (error) {
          console.error('セッション確認エラー:', error)
        }

        // 未認証状態
        set({ isAuthenticated: false, user: null, isLoading: false })
      },

      /**
       * エラーのクリア
       */
      clearError: () => {
        set({ error: null })
      },

      /**
       * ユーザー情報の更新
       */
      setUser: (user: User) => {
        set({ user })
      },

      /**
       * 権限チェック
       */
      hasRole: (role: UserRole): boolean => {
        const { user, isAuthenticated } = get()
        if (!isAuthenticated || !user) return false

        // 管理者は全権限を持つ
        if (user.role === 'admin') return true

        return user.role === role
      },

      /**
       * 特定会場の編集権限チェック
       */
      canEditVenue: (venueId: number): boolean => {
        const { user, isAuthenticated } = get()
        if (!isAuthenticated || !user) return false

        // 管理者は全会場を編集可能
        if (user.role === 'admin') return true

        // 会場担当者は担当会場のみ編集可能
        if (user.role === 'venue_staff' && user.venueId === venueId) return true

        return false
      },
    }),
    {
      name: 'urawa-cup-auth',
      storage: createJSONStorage(() => localStorage),
      // isAuthenticated は保存しない（起動時に必ず検証する）
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
)

// Supabase認証状態変更のリスナー
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState()

  if (event === 'SIGNED_OUT') {
    store.logout()
  } else if (event === 'SIGNED_IN' && session?.user) {
    // セッション更新時にストアも更新
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    const user: User = {
      id: session.user.id as any,
      username: profile?.username || session.user.email?.split('@')[0] || 'user',
      email: session.user.email || '',
      role: (profile?.role as UserRole) || 'viewer',
      name: profile?.name || session.user.email?.split('@')[0] || 'User',
      venueId: profile?.venue_id,
    }

    useAuthStore.setState({
      user,
      accessToken: session.access_token,
      isAuthenticated: true,
      isLoading: false,
    })
  }
})
