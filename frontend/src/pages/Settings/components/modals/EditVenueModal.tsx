// src/pages/Settings/components/modals/EditVenueModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { VenueForm, Venue } from '../../types'
import { GROUPS } from '../../constants'

interface Props {
  isOpen: boolean
  onClose: () => void
  form: VenueForm
  setForm: React.Dispatch<React.SetStateAction<VenueForm>>
  venue: Venue | null
  onSave: () => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}

export function EditVenueModal({
  isOpen,
  onClose,
  form,
  setForm,
  venue,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: Props) {
  if (!venue) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`会場編集: ${venue.name}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            会場名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="form-input w-full"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">住所</label>
          <input
            type="text"
            className="form-input w-full"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">収容人数</label>
          <input
            type="number"
            className="form-input w-full"
            value={form.capacity || ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                capacity: e.target.value ? parseInt(e.target.value) : null,
              }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">割り当てグループ</label>
          <select
            className="form-input w-full"
            value={form.assigned_group}
            onChange={(e) => setForm((prev) => ({ ...prev, assigned_group: e.target.value }))}
          >
            <option value="">未割り当て</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                グループ{g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">備考</label>
          <textarea
            className="form-input w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        <div className="flex justify-between pt-2">
          <button
            className="btn-danger"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={onClose}>
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={onSave}
              disabled={!form.name || isSaving}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
