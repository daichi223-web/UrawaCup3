/**
 * 得点ランキング画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useTournamentId } from '../hooks/useTournament'

interface ScorerEntry {
  rank: number
  player_id: number | null
  player_name: string
  team_name: string
  goals: number
}

export function ScorerRanking() {
  const tournamentId = useTournamentId()

  const { data: scorers, isLoading } = useQuery<ScorerEntry[]>({
    queryKey: ['scorer-ranking', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/standings/scorers`, {
        params: { tournament_id: tournamentId }
      })
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
      <h2 className="text-2xl font-bold mb-6">得点ランキング</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-16">順位</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">選手名</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">チーム</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">得点</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {scorers?.map((scorer, idx) => (
              <tr key={idx} className={scorer.rank <= 3 ? 'bg-yellow-50' : ''}>
                <td className="px-4 py-3 text-center font-bold">{scorer.rank}</td>
                <td className="px-4 py-3 font-medium">{scorer.player_name}</td>
                <td className="px-4 py-3">{scorer.team_name}</td>
                <td className="px-4 py-3 text-center font-bold text-lg">{scorer.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
