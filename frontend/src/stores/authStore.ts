import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, UserRole, LoginRequest } from '@shared/types'
import { supabase } from '@/lib/supabase'

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
          // タイムアウト用プロミス (15秒)
          const timeoutPromise = new Promise<{ timeout: true }>((_, reject) =>
            setTimeout(() => reject(new Error('ログイン処理がタイムアウトしました。通信環境を確認してください。')), 15000)
          )

          // 実際のログイン処理
          const loginProcess = async () => {
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
              name: profile?.display_name || authData.user.email?.split('@')[0] || 'User',
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
          }

          // 処理とタイムアウトを競合させる
          await Promise.race([loginProcess(), timeoutPromise])
          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : 'ログインに失敗しました'
          console.error('Login error:', error)
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
       * タイムアウト付きで、ハングを防止
       */
      checkAuth: async () => {
        const currentState = get()
        console.log('[Auth] checkAuth started, current accessToken:', currentState.accessToken?.substring(0, 20))

        // 開発環境のバイパス: dev-token があれば Supabase を呼ばずに認証済みとする
        if (import.meta.env.DEV && currentState.accessToken === 'dev-token' && currentState.user) {
          console.log('[Auth] DEV bypass: Using cached dev user')
          set({
            isAuthenticated: true,
            isLoading: false,
          })
          return
        }

        set({ isLoading: true })

        // タイムアウト用プロミス (10秒)
        const timeoutPromise = new Promise<{ timeout: true }>((_, reject) =>
          setTimeout(() => reject(new Error('認証確認がタイムアウトしました')), 10000)
        )

        try {
          // 実際の認証確認処理
          const checkProcess = async () => {
            console.log('[Auth] Checking Supabase session...')
            // Supabaseのセッションを確認
            const { data: { session } } = await supabase.auth.getSession()
            console.log('[Auth] Session result:', session ? 'found' : 'not found')

            if (session?.user) {
              console.log('[Auth] Fetching profile...')
              // プロフィール情報を取得
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
              console.log('[Auth] Profile fetched:', profile?.username)

              const user: User = {
                id: session.user.id as any,
                username: profile?.username || session.user.email?.split('@')[0] || 'user',
                email: session.user.email || '',
                role: (profile?.role as UserRole) || 'viewer',
                name: profile?.display_name || session.user.email?.split('@')[0] || 'User',
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

            // 未認証状態
            console.log('[Auth] No session, setting unauthenticated')
            set({ isAuthenticated: false, user: null, accessToken: null, isLoading: false })
          }

          // 処理とタイムアウトを競合させる
          await Promise.race([checkProcess(), timeoutPromise])
        } catch (error) {
          console.error('[Auth] セッション確認エラー:', error)
          // エラー時・タイムアウト時も isLoading を false にする
          set({ isAuthenticated: false, user: null, accessToken: null, isLoading: false })
        }
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

// Supabase認証状態変更のリスナー（タイムアウト付き）
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] onAuthStateChange:', event)

  if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    })
  } else if (event === 'SIGNED_IN' && session?.user) {
    // タイムアウト付きでプロフィール取得
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('[Auth] Profile fetch timeout in onAuthStateChange')
        resolve(null)
      }, 5000)
    )

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => data)

      const profile = await Promise.race([profilePromise, timeoutPromise])

      const user: User = {
        id: session.user.id as any,
        username: profile?.username || session.user.email?.split('@')[0] || 'user',
        email: session.user.email || '',
        role: (profile?.role as UserRole) || 'viewer',
        name: profile?.display_name || session.user.email?.split('@')[0] || 'User',
        venueId: profile?.venue_id,
      }

      useAuthStore.setState({
        user,
        accessToken: session.access_token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      console.error('[Auth] Error in onAuthStateChange:', error)
      // エラー時でも基本的なユーザー情報で認証状態を設定
      useAuthStore.setState({
        user: {
          id: session.user.id as any,
          username: session.user.email?.split('@')[0] || 'user',
          email: session.user.email || '',
          role: 'viewer',
          name: session.user.email?.split('@')[0] || 'User',
          venueId: undefined,
        },
        accessToken: session.access_token,
        isAuthenticated: true,
        isLoading: false,
      })
    }
  }
})
