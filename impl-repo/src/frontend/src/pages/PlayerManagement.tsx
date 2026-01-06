/**
 * 選手管理画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useTournamentId } from '../hooks/useTournament'

interface Player {
  id: number
  team_id: number
  team_name: string
  number: number
  name: string
  grade: number | null
  position: string | null
  is_captain: boolean
}

export function PlayerManagement() {
  const tournamentId = useTournamentId()
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)

  const { data: teams } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['teams-list', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/teams`, {
        params: { tournament_id: tournamentId }
      })
      return res.data
    },
    enabled: !!tournamentId,
  })

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ['players', tournamentId, selectedTeam],
    queryFn: async () => {
      const params: Record<string, unknown> = { tournament_id: tournamentId }
      if (selectedTeam) params.team_id = selectedTeam
      const res = await axios.get(`/api/players`, { params })
      return res.data
    },
    enabled: !!tournamentId,
  })

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">選手管理</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            CSVインポート
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            選手追加
          </button>
        </div>
      </div>

      {/* チームフィルター */}
      <div className="mb-4">
        <select
          value={selectedTeam ?? ''}
          onChange={(e) => setSelectedTeam(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="px-3 py-2 border rounded"
        >
          <option value="">全チーム</option>
          {teams?.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div>読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">背番号</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">名前</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">チーム</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">学年</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ポジション</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {players?.map((player) => (
                <tr key={player.id}>
                  <td className="px-4 py-3">{player.number}</td>
                  <td className="px-4 py-3 font-medium">
                    {player.name}
                    {player.is_captain && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">C</span>}
                  </td>
                  <td className="px-4 py-3">{player.team_name}</td>
                  <td className="px-4 py-3">{player.grade ?? '-'}</td>
                  <td className="px-4 py-3">{player.position ?? '-'}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:underline mr-2">編集</button>
                    <button className="text-red-600 hover:underline">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
