/**
 * メインアプリケーション
 * TASK-003: tournamentIdのコンテキスト化完了
 * 全13画面を実装
 */

import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Layout } from './components/Layout'
import {
  Dashboard,
  TeamManagement,
  PlayerManagement,
  Standings,
  ScorerRanking,
  ExclusionSettings,
  Reports,
  Settings,
  Login,
  MatchSchedule,
  MatchResult,
  MatchApproval,
  FinalDaySchedule,
} from './pages'

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
      {/* ログイン画面（レイアウト外） */}
      <Route path="/login" element={<Login />} />

      {/* メインレイアウト内のルート */}
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/teams" element={<TeamManagement />} />
              <Route path="/players" element={<PlayerManagement />} />
              <Route path="/schedule" element={<MatchSchedule />} />
              <Route path="/results" element={<MatchResult />} />
              <Route path="/approval" element={<MatchApproval />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/scorer-ranking" element={<ScorerRanking />} />
              <Route path="/exclusion" element={<ExclusionSettings />} />
              <Route path="/final-day" element={<FinalDaySchedule />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
    </>
  )
}

export default App
