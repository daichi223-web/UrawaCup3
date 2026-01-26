// src/pages/Settings/components/modals/LeagueModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { Team, League } from '../../types'
import { GROUP_COLORS } from '../../constants'
import type { UseMutationResult } from '@tanstack/react-query'

interface Props {
  isOpen: boolean
  onClose: () => void
  teams: Team[] | undefined
  leagues: League[] | undefined
  newLeague: string
  setNewLeague: (value: string) => void
  addLeagueMutation: UseMutationResult<unknown, Error, string>
  deleteLeagueMutation: UseMutationResult<unknown, Error, number>
  updateTeamLeagueMutation: UseMutationResult<void, Error, { teamId: number; leagueId: number | null }>
}

export function LeagueModal({
  isOpen,
  onClose,
  teams,
  leagues,
  newLeague,
  setNewLeague,
  addLeagueMutation,
  deleteLeagueMutation,
  updateTeamLeagueMutation,
}: Props) {
  const handleAddLeague = () => {
    if (newLeague.trim()) {
      addLeagueMutation.mutate(newLeague.trim())
      setNewLeague('')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="リーグ設定">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          リーグマスタの登録と、チームへのリーグ割り当てを行います。
        </p>

        {/* リーグマスタ追加 */}
        <div className="border rounded-lg p-3 bg-gray-50">
          <h4 className="text-sm font-medium mb-2">リーグを追加</h4>
          <div className="flex gap-2">
            <input
              type="text"
              className="form-input flex-1"
              value={newLeague}
              onChange={(e) => setNewLeague(e.target.value)}
              placeholder="例: S1リーグ、S2リーグ、県1部"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddLeague()
                }
              }}
            />
            <button className="btn-secondary text-sm" onClick={handleAddLeague}>
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {leagues &&
              leagues.map((league) => (
                <span
                  key={league.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded"
                >
                  {league.name}
                  <button
                    onClick={() => deleteLeagueMutation.mutate(league.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>

        {/* チーム別リーグ設定 */}
        <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
          {teams && teams.length > 0 ? (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      GROUP_COLORS[team.group_id || ''] || 'bg-gray-100'
                    }`}
                  >
                    {team.group_id || '-'}
                  </span>
                  <span className="font-medium text-sm">{team.short_name || team.name}</span>
                </div>
                <select
                  className="form-input text-sm py-1 w-28"
                  value={team.league_id || ''}
                  onChange={(e) =>
                    updateTeamLeagueMutation.mutate({
                      teamId: team.id,
                      leagueId: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                >
                  <option value="">未設定</option>
                  {leagues &&
                    leagues.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-gray-500">チームが登録されていません</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  )
}
