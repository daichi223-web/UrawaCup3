// src/pages/Settings/components/modals/LocalTeamModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { Team } from '../../types'
import { GROUP_COLORS } from '../../constants'
import type { UseMutationResult } from '@tanstack/react-query'

interface Props {
  isOpen: boolean
  onClose: () => void
  teams: Team[] | undefined
  updateTeamTypeMutation: UseMutationResult<void, Error, { teamId: number; isLocal: boolean }>
}

export function LocalTeamModal({
  isOpen,
  onClose,
  teams,
  updateTeamTypeMutation,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="地元チーム設定">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          地元チームをONにすると、組み合わせ生成時に優先的に主催チームとして割り当てられます。
        </p>
        <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
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
                  <span className="font-medium">{team.short_name || team.name}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={team.is_local}
                    onChange={(e) =>
                      updateTeamTypeMutation.mutate({
                        teamId: team.id,
                        isLocal: e.target.checked,
                      })
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
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
