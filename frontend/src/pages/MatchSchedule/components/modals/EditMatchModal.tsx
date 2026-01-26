// src/pages/MatchSchedule/components/modals/EditMatchModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { MatchWithDetails, VenueInfo, EditFormState } from '../../types'

interface EditMatchModalProps {
  match: MatchWithDetails | null
  editForm: EditFormState | null
  venues: VenueInfo[]
  isUpdating: boolean
  onClose: () => void
  onFormChange: (form: EditFormState) => void
  onSave: () => void
}

export function EditMatchModal({
  match,
  editForm,
  venues,
  isUpdating,
  onClose,
  onFormChange,
  onSave,
}: EditMatchModalProps) {
  if (!match || !editForm) return null

  return (
    <Modal isOpen={!!match} onClose={onClose} title="日程編集">
      <div className="space-y-4">
        <div className="text-center mb-4">
          <div className="font-bold">
            {match.homeTeam?.name} vs {match.awayTeam?.name}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日付
            </label>
            <input
              type="date"
              className="form-input"
              value={editForm.matchDate}
              onChange={(e) => onFormChange({ ...editForm, matchDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始時間
            </label>
            <input
              type="time"
              className="form-input"
              value={editForm.matchTime}
              onChange={(e) => onFormChange({ ...editForm, matchTime: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              会場
            </label>
            <select
              className="form-input"
              value={editForm.venueId}
              onChange={(e) => onFormChange({ ...editForm, venueId: parseInt(e.target.value) })}
            >
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              試合順
            </label>
            <input
              type="number"
              className="form-input"
              min={1}
              value={editForm.matchOrder}
              onChange={(e) => onFormChange({ ...editForm, matchOrder: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={isUpdating}
          >
            {isUpdating ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default EditMatchModal
