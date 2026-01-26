// src/pages/TeamManagement/components/TeamBulkAddModal.tsx

import { Modal } from '@/components/ui/Modal'

interface TeamBulkAddModalProps {
  isOpen: boolean
  onClose: () => void
  bulkText: string
  setBulkText: (text: string) => void
  bulkTeamType: 'invited' | 'local'
  setBulkTeamType: (type: 'invited' | 'local') => void
  useGroupSystem: boolean
  saving: boolean
  onBulkAdd: () => void
}

export function TeamBulkAddModal({
  isOpen,
  onClose,
  bulkText,
  setBulkText,
  bulkTeamType,
  setBulkTeamType,
  useGroupSystem,
  saving,
  onBulkAdd,
}: TeamBulkAddModalProps) {
  const handleClose = () => {
    onClose()
    setBulkText('')
    setBulkTeamType('invited')
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="チーム一括登録">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">入力形式（1行1チーム）:</p>
          <p className="text-xs">
            {useGroupSystem
              ? '略称（スペースまたはタブ）グループ'
              : '略称のみ'}
          </p>
        </div>
        <div>
          <label className="form-label">チーム区分</label>
          <select
            className="form-input"
            value={bulkTeamType}
            onChange={(e) => setBulkTeamType(e.target.value as 'invited' | 'local')}
          >
            <option value="invited">招待チーム</option>
            <option value="local">地元チーム</option>
          </select>
        </div>
        <div>
          <label className="form-label">チーム一覧 *</label>
          <textarea
            className="form-input min-h-[200px] font-mono text-sm"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={useGroupSystem
              ? `浦和南  A
市浦和  B
前橋育  A
青森山田  B
流経柏  C
静岡学園  D`
              : `浦和南
市浦和
前橋育
青森山田
流経柏
静岡学園`}
          />
          <p className="text-xs text-gray-500 mt-1">
            {bulkText.split('\n').filter(l => l.trim()).length}チーム検出
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={handleClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={onBulkAdd}
            disabled={saving || !bulkText.trim()}
          >
            {saving ? '登録中...' : '一括登録'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
