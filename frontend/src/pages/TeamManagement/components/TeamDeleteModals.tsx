// src/pages/TeamManagement/components/TeamDeleteModals.tsx

import { Modal } from '@/components/ui/Modal'
import type { Team, DeleteAllValidation } from '../types'

interface TeamDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  team: Team | null
  saving: boolean
  onDelete: () => void
}

export function TeamDeleteModal({
  isOpen,
  onClose,
  team,
  saving,
  onDelete,
}: TeamDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="チーム削除の確認">
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            <span className="font-bold">「{team?.name}」</span>を削除しますか？
          </p>
          <p className="text-red-600 text-sm mt-2">
            この操作は取り消せません。チームに関連する選手データも削除される可能性があります。
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            onClick={onDelete}
            disabled={saving}
          >
            {saving ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface TeamDeleteAllModalProps {
  isOpen: boolean
  onClose: () => void
  teamsCount: number
  validation: DeleteAllValidation | null
  saving: boolean
  onDeleteAll: () => void
  onDeleteRelatedData?: () => void
}

export function TeamDeleteAllModal({
  isOpen,
  onClose,
  teamsCount,
  validation,
  saving,
  onDeleteAll,
  onDeleteRelatedData,
}: TeamDeleteAllModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="全チーム削除の確認">
      <div className="space-y-4">
        {validation && !validation.canDelete ? (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-bold">削除できません</p>
              <p className="text-yellow-700 text-sm mt-2">
                以下の関連データが存在するため、チームを削除できません。先にこれらのデータを削除してください。
              </p>
              <ul className="list-disc list-inside mt-2 text-yellow-700 text-sm">
                {validation.matchCount > 0 && (
                  <li>試合データ: {validation.matchCount}件</li>
                )}
                {validation.goalCount > 0 && (
                  <li>得点データ: {validation.goalCount}件</li>
                )}
              </ul>
            </div>
            {onDeleteRelatedData && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-800 text-sm">
                  関連する試合・得点・順位データを先に削除しますか？
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn-secondary" onClick={onClose}>
                キャンセル
              </button>
              {onDeleteRelatedData && (
                <button
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  onClick={onDeleteRelatedData}
                  disabled={saving}
                >
                  {saving ? '削除中...' : '試合データを削除'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-bold">
                全{teamsCount}チームを削除しますか？
              </p>
              <p className="text-red-600 text-sm mt-2">
                この操作は取り消せません。全チームと関連する選手データがすべて削除されます。
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn-secondary" onClick={onClose}>
                キャンセル
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                onClick={onDeleteAll}
                disabled={saving}
              >
                {saving ? '削除中...' : '全て削除する'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
