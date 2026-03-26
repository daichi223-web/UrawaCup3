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
          <label className="block text-sm font-medium mb-1">グラウンド名（Day1）</label>
          <input
            type="text"
            className="form-input w-full"
            placeholder="例: 浦和南高G"
            value={form.groundName}
            onChange={(e) => setForm((prev) => ({ ...prev, groundName: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">グラウンド名（Day2）<span className="text-gray-400 text-xs ml-1">※Day1と異なる場合のみ</span></label>
          <input
            type="text"
            className="form-input w-full"
            placeholder="空欄ならDay1と同じ"
            value={form.groundNameDay2}
            onChange={(e) => setForm((prev) => ({ ...prev, groundNameDay2: e.target.value }))}
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

        {/* 会場用途チェック */}
        <div className="space-y-2 border-t pt-3">
          <label className="block text-sm font-medium mb-1">会場用途</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary-600 rounded"
              checked={form.forPreliminary}
              onChange={(e) => setForm((prev) => ({ ...prev, forPreliminary: e.target.checked }))}
            />
            <span className="text-sm">予選リーグ会場</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary-600 rounded"
              checked={form.forFinalDay}
              onChange={(e) => setForm((prev) => ({ ...prev, forFinalDay: e.target.checked }))}
            />
            <span className="text-sm">最終日の順位リーグ会場</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary-600 rounded"
              checked={form.isFinalsVenue}
              onChange={(e) => setForm((prev) => ({ ...prev, isFinalsVenue: e.target.checked }))}
            />
            <span className="text-sm">決勝トーナメント会場（3決・決勝戦）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary-600 rounded"
              checked={form.isMixedUse}
              onChange={(e) => setForm((prev) => ({ ...prev, isMixedUse: e.target.checked }))}
            />
            <span className="text-sm">混合会場（決勝＋研修を同一会場で行う）</span>
          </label>
          {form.isMixedUse && (
            <div className="ml-6 mt-1 p-2 bg-purple-50 rounded">
              <label className="block text-sm text-gray-700 mb-1">決勝トーナメント試合数</label>
              <input
                type="number"
                className="form-input w-20"
                min={1}
                max={4}
                value={form.finalsMatchCount}
                onChange={(e) => setForm((prev) => ({ ...prev, finalsMatchCount: parseInt(e.target.value) || 1 }))}
              />
            </div>
          )}
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
