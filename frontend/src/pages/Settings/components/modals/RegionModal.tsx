// src/pages/Settings/components/modals/RegionModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { Team, Region } from '../../types'
import { GROUP_COLORS } from '../../constants'
import type { UseMutationResult } from '@tanstack/react-query'

interface Props {
  isOpen: boolean
  onClose: () => void
  teams: Team[] | undefined
  regions: Region[] | undefined
  newRegion: string
  setNewRegion: (value: string) => void
  addRegionMutation: UseMutationResult<unknown, Error, string>
  deleteRegionMutation: UseMutationResult<unknown, Error, number>
  updateTeamRegionMutation: UseMutationResult<void, Error, { teamId: number; regionName: string | null }>
}

export function RegionModal({
  isOpen,
  onClose,
  teams,
  regions,
  newRegion,
  setNewRegion,
  addRegionMutation,
  deleteRegionMutation,
  updateTeamRegionMutation,
}: Props) {
  const handleAddRegion = () => {
    if (newRegion.trim()) {
      addRegionMutation.mutate(newRegion.trim())
      setNewRegion('')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="地域設定">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          地域マスタの登録と、チームへの地域割り当てを行います。
        </p>

        {/* 地域マスタ追加 */}
        <div className="border rounded-lg p-3 bg-gray-50">
          <h4 className="text-sm font-medium mb-2">地域を追加</h4>
          <div className="flex gap-2">
            <input
              type="text"
              className="form-input flex-1"
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              placeholder="例: さいたま市、県北、県南"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddRegion()
                }
              }}
            />
            <button className="btn-secondary text-sm" onClick={handleAddRegion}>
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {regions &&
              regions.map((region) => (
                <span
                  key={region.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                >
                  {region.name}
                  <button
                    onClick={() => deleteRegionMutation.mutate(region.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>

        {/* チーム別地域設定 */}
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
                  value={team.region_name || ''}
                  onChange={(e) =>
                    updateTeamRegionMutation.mutate({
                      teamId: team.id,
                      regionName: e.target.value || null,
                    })
                  }
                >
                  <option value="">未設定</option>
                  {regions &&
                    regions.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
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
