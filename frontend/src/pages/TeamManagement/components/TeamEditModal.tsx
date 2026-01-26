// src/pages/TeamManagement/components/TeamEditModal.tsx

import { Modal } from '@/components/ui/Modal'
import { useConstraintSettingsStore } from '@/stores/constraintSettingsStore'
import type { League, EditFormState } from '../types'

interface TeamEditModalProps {
  isOpen: boolean
  onClose: () => void
  editForm: EditFormState
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>
  leagues: League[]
  useGroupSystem: boolean
  saving: boolean
  onSave: () => void
}

export function TeamEditModal({
  isOpen,
  onClose,
  editForm,
  setEditForm,
  leagues,
  useGroupSystem,
  saving,
  onSave,
}: TeamEditModalProps) {
  const { settings: constraintSettings, masterData } = useConstraintSettingsStore()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="チーム編集">
      <div className="space-y-4">
        <div>
          <label className="form-label">チーム名</label>
          <input
            type="text"
            className="form-input"
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
        {useGroupSystem && (
          <div>
            <label className="form-label">グループ</label>
            <select
              className="form-input"
              value={editForm.groupId}
              onChange={(e) => setEditForm(prev => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">未設定</option>
              <option value="A">Aグループ</option>
              <option value="B">Bグループ</option>
              <option value="C">Cグループ</option>
              <option value="D">Dグループ</option>
            </select>
          </div>
        )}
        <div>
          <label className="form-label">チーム区分</label>
          <select
            className="form-input"
            value={editForm.teamType}
            onChange={(e) => setEditForm(prev => ({ ...prev, teamType: e.target.value }))}
          >
            <option value="invited">招待チーム</option>
            <option value="local">地元チーム</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isVenueHost"
            checked={editForm.isVenueHost}
            onChange={(e) => setEditForm(prev => ({ ...prev, isVenueHost: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="isVenueHost" className="text-sm text-gray-700">
            会場担当チーム
          </label>
        </div>

        {(constraintSettings.avoidSameRegion || constraintSettings.avoidLocalVsLocal) && (
          <div>
            <label className="form-label">地域</label>
            <select
              className="form-input"
              value={editForm.region}
              onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
            >
              <option value="">未設定</option>
              {masterData.regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">同地域チームの対戦回避に使用</p>
          </div>
        )}
        {constraintSettings.avoidSameLeague && (
          <div>
            <label className="form-label">所属リーグ</label>
            <select
              className="form-input"
              value={editForm.leagueId}
              onChange={(e) => setEditForm(prev => ({ ...prev, leagueId: e.target.value }))}
            >
              <option value="">未設定</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">同リーグチームの対戦回避に使用</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
