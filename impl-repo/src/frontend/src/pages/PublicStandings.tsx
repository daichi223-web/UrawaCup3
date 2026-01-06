/**
 * 公開順位表画面（認証不要）
 * F-90: 一般公開用順位表
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

interface StandingEntry {
  rank: number
  team_id: number
  team_name: string
  short_name: string | null
  is_host: boolean
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

interface StandingsData {
  tournament_id: number
  groups: Record<string, StandingEntry[]>
  last_updated: string | null
}

interface Tournament {
  id: number
  name: string
  year: number
  edition: number
}

export function PublicStandings() {
  const [tournamentId, setTournamentId] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  // 大会一覧を取得
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ['public-tournaments'],
    queryFn: async () => {
      const res = await axios.get('/api/public/tournaments')
      return res.data
    },
  })

  // 最新の大会を自動選択
  useEffect(() => {
    if (tournaments.length > 0 && !tournamentId) {
      setTournamentId(tournaments[0].id)
    }
  }, [tournaments, tournamentId])

  // 順位表を取得
  const { data: standingsData, isLoading } = useQuery<StandingsData>({
    queryKey: ['public-standings', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/public/tournaments/${tournamentId}/standings`)
      return res.data
    },
    enabled: !!tournamentId,
    refetchInterval: 30000, // 30秒ごとに更新
  })

  const groups = ['A', 'B', 'C', 'D']
  const currentTournament = tournaments.find(t => t.id === tournamentId)

  const renderStandingsTable = (standings: StandingEntry[], groupId: string) => (
    <div key={groupId} className="mb-8">
      <h3 className="text-lg font-bold mb-3 text-gray-800">
        グループ {groupId}
      </h3>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-red-600 text-white">
            <tr>
              <th className="px-2 py-3 text-center text-sm font-medium w-12">順位</th>
              <th className="px-3 py-3 text-left text-sm font-medium">チーム</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">試</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">勝</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">分</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">負</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">得</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">失</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-10">差</th>
              <th className="px-2 py-3 text-center text-sm font-medium w-12 bg-red-700">勝点</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {standings.map((entry) => (
              <tr
                key={entry.team_id}
                className={`${
                  entry.rank === 1
                    ? 'bg-yellow-50'
                    : entry.rank <= 2
                    ? 'bg-green-50'
                    : ''
                } hover:bg-gray-50`}
              >
                <td className="px-2 py-3 text-center font-bold text-lg">
                  {entry.rank === 1 && '🥇'}
                  {entry.rank === 2 && '🥈'}
                  {entry.rank === 3 && '🥉'}
                  {entry.rank > 3 && entry.rank}
                </td>
                <td className="px-3 py-3 font-medium">
                  {entry.is_host && <span className="text-red-600 mr-1">🏠</span>}
                  {entry.short_name || entry.team_name}
                </td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.played}</td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.won}</td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.drawn}</td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.lost}</td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.goals_for}</td>
                <td className="px-2 py-3 text-center text-gray-600">{entry.goals_against}</td>
                <td className="px-2 py-3 text-center text-gray-600">
                  {entry.goal_difference > 0 ? `+${entry.goal_difference}` : entry.goal_difference}
                </td>
                <td className="px-2 py-3 text-center font-bold text-lg text-red-600">
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-red-600 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold">🏆 浦和カップ 順位表</h1>
          {currentTournament && (
            <p className="text-sm opacity-90 mt-1">
              第{currentTournament.edition}回 {currentTournament.name}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* グループフィルター */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedGroup('all')}
            className={`px-4 py-2 rounded-full font-medium transition ${
              selectedGroup === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            全グループ
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                selectedGroup === g
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              グループ{g}
            </button>
          ))}
        </div>

        {/* 順位表 */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mb-4"></div>
            <p>読み込み中...</p>
          </div>
        ) : standingsData ? (
          <>
            {selectedGroup === 'all'
              ? groups.map((g) =>
                  standingsData.groups[g] &&
                  renderStandingsTable(standingsData.groups[g], g)
                )
              : standingsData.groups[selectedGroup] &&
                renderStandingsTable(standingsData.groups[selectedGroup], selectedGroup)}

            {/* 最終更新時刻 */}
            {standingsData.last_updated && (
              <p className="text-sm text-gray-500 text-center mt-4">
                最終更新: {new Date(standingsData.last_updated).toLocaleString('ja-JP')}
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            データがありません
          </div>
        )}

        {/* 凡例 */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow text-sm text-gray-600">
          <p className="font-medium mb-2">凡例</p>
          <p>🏠 = 会場担当校</p>
          <p className="mt-1">
            <span className="inline-block w-4 h-4 bg-yellow-50 border mr-2"></span>
            1位（決勝トーナメント進出）
          </p>
          <p>
            <span className="inline-block w-4 h-4 bg-green-50 border mr-2"></span>
            2位
          </p>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-gray-800 text-white py-4 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <p>さいたま市招待高校サッカーフェスティバル</p>
          <p className="opacity-70 mt-1">浦和カップ運営事務局</p>
        </div>
      </footer>
    </div>
  )
}
