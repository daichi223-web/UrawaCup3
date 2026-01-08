console.log('[App] 1. Starting App imports...')
import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
console.log('[App] 2. React Router imported')
import Layout from './components/Layout'
console.log('[App] 3. Layout imported')
import LoadingSpinner from './components/common/LoadingSpinner'
import { RequireAdmin, RequireVenueManager } from './components/auth'
console.log('[App] 4. Auth components imported')
import { useAuthStore } from './stores/authStore'
console.log('[App] 5. authStore imported')
import { isSupabaseConfigured } from './lib/supabase'
console.log('[App] 6. supabase imported')

// PWAコンポーネント
import { UpdatePrompt, InstallPrompt, ConflictResolver } from './components/pwa'
import { useSyncState } from './hooks/usePWA'
console.log('[App] 7. PWA components imported')

// ページコンポーネントを遅延読み込み
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TeamManagement = lazy(() => import('./pages/TeamManagement'))
const MatchSchedule = lazy(() => import('./pages/MatchSchedule'))
const MatchResult = lazy(() => import('./pages/MatchResult'))
const Standings = lazy(() => import('./pages/Standings'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const PublicLayout = lazy(() => import('./components/PublicLayout'))
const PublicMatchList = lazy(() => import('./pages/public/PublicMatchList'))
const PublicStandings = lazy(() => import('./pages/public/PublicStandings'))
const PublicScorerRanking = lazy(() => import('./pages/public/PublicScorerRanking'))
// SupabaseTest は開発環境のみで使用
const SupabaseTest = lazy(() => import('./pages/public/SupabaseTest'))
const MatchApproval = lazy(() => import('./pages/MatchApproval'))
const ExclusionSettings = lazy(() => import('./pages/ExclusionSettings'))
const ScorerRanking = lazy(() => import('./pages/ScorerRanking'))
const PlayerManagement = lazy(() => import('./pages/PlayerManagement'))
const FinalDaySchedule = lazy(() => import('./pages/FinalDaySchedule'))

/**
 * 設定エラー表示コンポーネント
 */
function ConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">設定が必要です</h2>
        <div className="text-gray-600 mb-8 space-y-4">
          <p>
            アプリケーションを実行するために必要な環境変数が設定されていません。
          </p>
          <div className="text-left bg-gray-100 p-4 rounded text-sm font-mono overflow-auto">
            <p className="font-bold mb-2">Vercel Settings Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
          <p className="text-sm">
            管理者に連絡して、Vercelの環境変数設定を確認してください。
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  )
}

/**
 * メインアプリケーションコンポーネント
 * 浦和カップ トーナメント管理システム
 */
function App() {
  const { checkAuth } = useAuthStore()
  const { conflictCount } = useSyncState()
  const [showConflictResolver, setShowConflictResolver] = useState(false)

  // アプリ起動時に認証状態を確認（初回のみ）
  useEffect(() => {
    if (isSupabaseConfigured) {
      checkAuth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 競合がある場合は自動的にダイアログを表示
  useEffect(() => {
    if (conflictCount > 0) {
      setShowConflictResolver(true)
    }
  }, [conflictCount])

  // 環境設定チェック
  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />
  }

  return (
    <>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* ログインページ（レイアウトなし） */}
          <Route path="/login" element={<Login />} />

          {/* メインレイアウト内のルート（すべて認証必須） */}
          <Route element={<Layout />}>
            {/* ダッシュボード（管理者専用） */}
            <Route
              path="/"
              element={
                <RequireAdmin>
                  <Dashboard />
                </RequireAdmin>
              }
            />

            {/* 順位表（管理者専用） */}
            <Route
              path="/standings"
              element={
                <RequireAdmin>
                  <Standings />
                </RequireAdmin>
              }
            />

            {/* 得点ランキング（管理者専用） */}
            <Route
              path="/scorer-ranking"
              element={
                <RequireAdmin>
                  <ScorerRanking />
                </RequireAdmin>
              }
            />

            {/* チーム管理（管理者専用） */}
            <Route
              path="/teams"
              element={
                <RequireAdmin>
                  <TeamManagement />
                </RequireAdmin>
              }
            />

            {/* 日程管理（管理者専用） */}
            <Route
              path="/schedule"
              element={
                <RequireAdmin>
                  <MatchSchedule />
                </RequireAdmin>
              }
            />

            {/* 試合結果入力（会場担当者以上） */}
            <Route
              path="/results"
              element={
                <RequireVenueManager>
                  <MatchResult />
                </RequireVenueManager>
              }
            />

            {/* 報告書出力（管理者専用） */}
            <Route
              path="/reports"
              element={
                <RequireAdmin>
                  <Reports />
                </RequireAdmin>
              }
            />

            {/* 結果承認（管理者専用） */}
            <Route
              path="/approval"
              element={
                <RequireAdmin>
                  <MatchApproval />
                </RequireAdmin>
              }
            />

            {/* 設定（管理者専用） */}
            <Route
              path="/settings"
              element={
                <RequireAdmin>
                  <Settings />
                </RequireAdmin>
              }
            />

            {/* 対戦除外設定（管理者専用） */}
            <Route
              path="/exclusions"
              element={
                <RequireAdmin>
                  <ExclusionSettings />
                </RequireAdmin>
              }
            />

            {/* 選手管理（管理者専用） */}
            <Route
              path="/players"
              element={
                <RequireAdmin>
                  <PlayerManagement />
                </RequireAdmin>
              }
            />

            {/* 最終日組み合わせ（管理者専用） */}
            <Route
              path="/final-day"
              element={
                <RequireAdmin>
                  <FinalDaySchedule />
                </RequireAdmin>
              }
            />
          </Route>

          {/* Public Routes (No Auth Required) */}
          <Route path="/public" element={<PublicLayout />}>
            <Route index element={<Navigate to="matches" replace />} />
            <Route path="matches" element={<PublicMatchList />} />
            <Route path="standings" element={<PublicStandings />} />
            <Route path="scorers" element={<PublicScorerRanking />} />
          </Route>

          {/* Supabase接続テスト（開発環境のみ） */}
          {import.meta.env.DEV && (
            <Route path="/test" element={<SupabaseTest />} />
          )}

          {/* 404リダイレクト → 公開ページへ */}
          <Route path="*" element={<Navigate to="/public/matches" replace />} />
        </Routes>
      </Suspense>

      {/* PWAコンポーネント */}
      <UpdatePrompt />
      <InstallPrompt />

      {/* 競合解決ダイアログ */}
      {showConflictResolver && (
        <ConflictResolver
          onResolve={() => setShowConflictResolver(false)}
        />
      )}
    </>
  )
}

export default App
