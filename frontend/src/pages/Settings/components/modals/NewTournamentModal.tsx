// src/pages/Settings/components/modals/NewTournamentModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { NewTournamentForm } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  form: NewTournamentForm
  setForm: React.Dispatch<React.SetStateAction<NewTournamentForm>>
  onSubmit: () => void
  isLoading: boolean
}

export function NewTournamentModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  isLoading,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新規大会作成">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">大会名</label>
          <input
            type="text"
            className="form-input w-full"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="例: 第30回浦和カップ"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">開催年</label>
          <input
            type="number"
            className="form-input w-full"
            value={form.year}
            onChange={(e) => setForm((prev) => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">開始日</label>
            <input
              type="date"
              className="form-input w-full"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">終了日</label>
            <input
              type="date"
              className="form-input w-full"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">説明（任意）</label>
          <textarea
            className="form-input w-full"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="大会の詳細..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={onSubmit}
            disabled={!form.name || !form.startDate || !form.endDate || isLoading}
          >
            {isLoading ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
