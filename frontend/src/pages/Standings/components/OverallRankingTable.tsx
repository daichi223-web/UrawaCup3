// src/pages/Standings/components/OverallRankingTable.tsx
import { Trophy } from 'lucide-react'
import { GROUP_COLORS } from '../constants'
import type { StandingsEntry } from '../types'

interface OverallRankingTableProps {
  entries: StandingsEntry[]
  qualifyingCount: number
  useGroupSystem: boolean
}

export function OverallRankingTable({ entries, qualifyingCount, useGroupSystem }: OverallRankingTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>順位データがありません</p>
        <p className="text-sm mt-1">試合結果が入力されると順位が表示されます</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-3 py-3 text-center w-14">順位</th>
            <th className="px-3 py-3 text-left">チーム</th>
            {useGroupSystem && <th className="px-3 py-3 text-center w-14">G</th>}
            <th className="px-3 py-3 text-center w-12">試</th>
            <th className="px-3 py-3 text-center w-12">勝</th>
            <th className="px-3 py-3 text-center w-12">分</th>
            <th className="px-3 py-3 text-center w-12">負</th>
            <th className="px-3 py-3 text-center w-12">得</th>
            <th className="px-3 py-3 text-center w-12">失</th>
            <th className="px-3 py-3 text-center w-14">得失</th>
            <th className="px-3 py-3 text-center w-14 font-bold">勝点</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isQualifying = entry.overallRank <= qualifyingCount
            return (
              <tr
                key={entry.teamId}
                className={`border-b hover:bg-gray-50 ${isQualifying ? 'bg-amber-50' : ''}`}
              >
                <td className="px-3 py-3 text-center font-bold">
                  {isQualifying ? (
                    <span className="inline-block w-7 h-7 bg-amber-500 text-white rounded-full leading-7 text-sm">
                      {entry.overallRank}
                    </span>
                  ) : (
                    entry.overallRank
                  )}
                </td>
                <td className="px-3 py-3 font-medium">
                  {entry.shortName || entry.teamName}
                </td>
                {useGroupSystem && (
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${GROUP_COLORS[entry.groupId] || 'bg-gray-100'}`}>
                      {entry.groupId}
                    </span>
                  </td>
                )}
                <td className="px-3 py-3 text-center">{entry.played}</td>
                <td className="px-3 py-3 text-center text-green-600 font-medium">{entry.won}</td>
                <td className="px-3 py-3 text-center text-gray-500">{entry.drawn}</td>
                <td className="px-3 py-3 text-center text-red-500">{entry.lost}</td>
                <td className="px-3 py-3 text-center">{entry.goalsFor}</td>
                <td className="px-3 py-3 text-center">{entry.goalsAgainst ?? (entry.goalsFor - entry.goalDifference)}</td>
                <td className="px-3 py-3 text-center">
                  <span className={entry.goalDifference > 0 ? 'text-green-600 font-medium' : entry.goalDifference < 0 ? 'text-red-500' : ''}>
                    {entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-bold text-lg">{entry.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="p-4 bg-gray-50 border-t">
        <p className="text-sm text-amber-600 font-medium">
          ※ 上位{qualifyingCount}チームが決勝トーナメント進出
        </p>
        <p className="text-xs text-gray-500 mt-1">
          順位決定: 勝点 → 得失点差 → 総得点
        </p>
      </div>
    </div>
  )
}

export default OverallRankingTable
