// src/pages/TeamManagement/components/TeamTable.tsx

import { Link } from 'react-router-dom'
import type { Team, League } from '../types'

interface TeamTableProps {
  teams: Team[]
  leagues: League[]
  useGroupSystem: boolean
  updatingTeamId: number | null
  onInlineUpdate: (teamId: number, field: string, value: string | boolean | null) => void
  onEditClick: (team: Team) => void
  onDeleteClick: (team: Team) => void
}

export function TeamTable({
  teams,
  leagues,
  useGroupSystem,
  updatingTeamId,
  onInlineUpdate,
  onEditClick,
  onDeleteClick,
}: TeamTableProps) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {useGroupSystem && <th>グループ</th>}
            <th>番号</th>
            <th>チーム名</th>
            <th>区分</th>
            <th>会場担当</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {teams.length === 0 ? (
            <tr>
              <td colSpan={useGroupSystem ? 6 : 5} className="text-center py-8 text-gray-500">
                チームが登録されていません
              </td>
            </tr>
          ) : (
            teams.map((team) => (
              <tr key={team.id} className="hover:bg-gray-50">
                {useGroupSystem && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <select
                      className={`w-16 h-8 rounded-full font-bold text-center border-0 cursor-pointer
                        ${(team.groupId || team.group_id) === 'A' ? 'bg-red-100 text-red-800' :
                          (team.groupId || team.group_id) === 'B' ? 'bg-blue-100 text-blue-800' :
                            (team.groupId || team.group_id) === 'C' ? 'bg-green-100 text-green-800' :
                              (team.groupId || team.group_id) === 'D' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      value={team.groupId || team.group_id || ''}
                      onChange={(e) => onInlineUpdate(team.id, 'groupId', e.target.value || null)}
                      disabled={updatingTeamId === team.id}
                      style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                    >
                      <option value="">-</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{team.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-lg font-bold text-gray-900">{team.name}</div>
                  <div className="flex gap-1 mt-1">
                    {team.region && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        {team.region}
                      </span>
                    )}
                    {(team.league_id || team.leagueId) && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        {leagues.find(l => l.id === (team.league_id || team.leagueId))?.name ||
                         `リーグID:${team.league_id || team.leagueId}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer
                      ${(team.teamType || team.team_type) === 'local' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                    value={team.teamType || team.team_type || 'invited'}
                    onChange={(e) => onInlineUpdate(team.id, 'teamType', e.target.value)}
                    disabled={updatingTeamId === team.id}
                    style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                  >
                    <option value="invited">招待</option>
                    <option value="local">地元</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <input
                    type="checkbox"
                    checked={team.isVenueHost || team.is_venue_host || false}
                    onChange={(e) => onInlineUpdate(team.id, 'isVenueHost', e.target.checked)}
                    disabled={updatingTeamId === team.id}
                    className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                      onClick={() => onEditClick(team)}
                    >
                      編集
                    </button>
                    <Link
                      to={`/players?team=${team.id}`}
                      className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      選手登録
                    </Link>
                    <button
                      className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                      onClick={() => onDeleteClick(team)}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
