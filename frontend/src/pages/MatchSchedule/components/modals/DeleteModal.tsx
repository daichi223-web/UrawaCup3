// src/pages/MatchSchedule/components/modals/DeleteModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { DeleteType } from '../../types'

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  deleteType: DeleteType
  isDeleting: boolean
  onDelete: () => void
}

export function DeleteModal({
  isOpen,
  onClose,
  deleteType,
  isDeleting,
  onDelete,
}: DeleteModalProps) {
  const title =
    deleteType === 'preliminary' ? '予選リーグ日程削除' :
    deleteType === 'finals' ? '決勝トーナメント削除' :
    deleteType === 'training' ? '研修試合削除' :
    '全日程削除'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-gray-600">
          {deleteType === 'preliminary' && (
            <>
              <span className="text-red-600 font-semibold">予選リーグの全試合を削除します。</span>
              <br />
              <span className="text-sm text-gray-500">
                ※ この操作は取り消せません。関連する順位表データも影響を受ける可能性があります。
              </span>
            </>
          )}
          {deleteType === 'finals' && (
            <>
              <span className="text-red-600 font-semibold">決勝トーナメントの全試合を削除します。</span>
              <br />
              <span className="text-sm text-gray-500">
                ※ 準決勝・3位決定戦・決勝の試合が削除されます。
              </span>
            </>
          )}
          {deleteType === 'training' && (
            <>
              <span className="text-red-600 font-semibold">研修試合を全て削除します。</span>
              <br />
              <span className="text-sm text-gray-500">
                ※ この操作は取り消せません。
              </span>
            </>
          )}
          {deleteType === 'all' && (
            <>
              <span className="text-red-600 font-semibold">全ての試合日程を削除します。</span>
              <br />
              <span className="text-sm text-gray-500">
                ※ 予選リーグ・決勝トーナメント・研修試合の全てが削除されます。
              </span>
            </>
          )}
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-danger"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteModal
