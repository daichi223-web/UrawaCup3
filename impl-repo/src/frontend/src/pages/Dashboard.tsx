/**
 * ダッシュボード画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useTournamentId, useTournament } from '../hooks/useTournament'

interface DashboardStats {
  totalTeams: number
  totalMatches: number
  completedMatches: number
  upcomingMatches: number
}

export function Dashboard() {
  const tournamentId = useTournamentId()
  const tournament = useTournament()

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/tournaments/${tournamentId}/stats`)
      return res.data
    },
    enabled: !!tournamentId,
  })

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{tournament?.name} - ダッシュボード</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">参加チーム</h3>
          <p className="text-3xl font-bold">{stats?.totalTeams ?? '-'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">総試合数</h3>
          <p className="text-3xl font-bold">{stats?.totalMatches ?? '-'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">完了試合</h3>
          <p className="text-3xl font-bold text-green-600">{stats?.completedMatches ?? '-'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm">予定試合</h3>
          <p className="text-3xl font-bold text-blue-600">{stats?.upcomingMatches ?? '-'}</p>
        </div>
      </div>
    </div>
  )
}
