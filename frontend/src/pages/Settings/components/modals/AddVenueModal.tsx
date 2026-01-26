// src/pages/Settings/components/modals/AddVenueModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { AddVenueForm } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  form: AddVenueForm
  setForm: React.Dispatch<React.SetStateAction<AddVenueForm>>
  onSubmit: () => void
  isLoading: boolean
}

export function AddVenueModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  isLoading,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="会場を追加">
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
            placeholder="例: 浦和駒場スタジアム"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">住所</label>
          <input
            type="text"
            className="form-input w-full"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="例: 埼玉県さいたま市..."
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
            placeholder="例: 100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">備考</label>
          <textarea
            className="form-input w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="駐車場情報など..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={onSubmit}
            disabled={!form.name || isLoading}
          >
            {isLoading ? '追加中...' : '追加'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
