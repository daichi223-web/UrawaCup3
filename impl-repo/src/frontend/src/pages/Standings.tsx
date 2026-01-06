/**
 * 順位表画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useTournamentId } from '../hooks/useTournament'

interface StandingEntry {
  rank: number
  team_id: number
  team_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

interface GroupStandings {
  group_id: string
  standings: StandingEntry[]
}

export function Standings() {
  const tournamentId = useTournamentId()
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  const { data: standingsData, isLoading } = useQuery<GroupStandings[]>({
    queryKey: ['standings', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/standings/by-group`, {
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

  const groups = ['A', 'B', 'C', 'D']
  const filteredData = selectedGroup === 'all'
    ? standingsData
    : standingsData?.filter((g) => g.group_id === selectedGroup)

  const renderStandingsTable = (standings: StandingEntry[], groupId: string) => (
    <div key={groupId} className="mb-6">
      <h3 className="text-lg font-bold mb-2">グループ {groupId}</h3>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">順位</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">チーム</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">試</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">勝</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">分</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">負</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">得</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">失</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-12">差</th>
              <th className="px-3 py-2 text-center text-sm font-medium text-gray-700 w-14">勝点</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {standings.map((entry) => (
              <tr key={entry.team_id} className={entry.rank <= 2 ? 'bg-green-50' : ''}>
                <td className="px-3 py-2 text-center font-bold">{entry.rank}</td>
                <td className="px-3 py-2 font-medium">{entry.team_name}</td>
                <td className="px-3 py-2 text-center">{entry.played}</td>
                <td className="px-3 py-2 text-center">{entry.won}</td>
                <td className="px-3 py-2 text-center">{entry.drawn}</td>
                <td className="px-3 py-2 text-center">{entry.lost}</td>
                <td className="px-3 py-2 text-center">{entry.goals_for}</td>
                <td className="px-3 py-2 text-center">{entry.goals_against}</td>
                <td className="px-3 py-2 text-center">{entry.goal_difference}</td>
                <td className="px-3 py-2 text-center font-bold">{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">順位表</h2>

      {/* グループフィルター */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`px-3 py-1 rounded ${selectedGroup === 'all' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
        >
          全グループ
        </button>
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-3 py-1 rounded ${selectedGroup === g ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
          >
            グループ{g}
          </button>
        ))}
      </div>

      {/* 順位表 */}
      {filteredData?.map((group) =>
        group.standings && renderStandingsTable(group.standings, group.group_id)
      )}
    </div>
  )
}
