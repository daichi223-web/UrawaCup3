// src/pages/Reports/components/SenderSettingsCard.tsx

import { Edit2, Save } from 'lucide-react';
import type { SenderFormState } from '../types';

interface SenderSettings {
  senderOrganization?: string | null;
  senderName?: string | null;
  senderContact?: string | null;
}

interface SenderSettingsCardProps {
  isEditing: boolean;
  senderForm: SenderFormState;
  senderSettings: SenderSettings | undefined;
  senderLoading: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onFormChange: (form: SenderFormState) => void;
}

export function SenderSettingsCard({
  isEditing,
  senderForm,
  senderSettings,
  senderLoading,
  isSaving,
  onEdit,
  onCancel,
  onSave,
  onFormChange,
}: SenderSettingsCardProps) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold">報告書発信元設定</h3>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            編集
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="btn btn-secondary btn-sm"
            >
              キャンセル
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="btn btn-primary btn-sm flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        )}
      </div>
      <div className="card-body">
        {senderLoading ? (
          <div className="text-center py-4 text-gray-500">読込中...</div>
        ) : isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">発信元所属</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 県立浦和高校サッカー部"
                value={senderForm.senderOrganization}
                onChange={(e) => onFormChange({ ...senderForm, senderOrganization: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">発信元氏名</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 山田太郎"
                value={senderForm.senderName}
                onChange={(e) => onFormChange({ ...senderForm, senderName: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">連絡先</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 090-XXXX-XXXX"
                value={senderForm.senderContact}
                onChange={(e) => onFormChange({ ...senderForm, senderContact: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">発信元所属:</span>
              <p className="font-medium">{senderSettings?.senderOrganization || '未設定'}</p>
            </div>
            <div>
              <span className="text-gray-500">発信元氏名:</span>
              <p className="font-medium">{senderSettings?.senderName || '未設定'}</p>
            </div>
            <div>
              <span className="text-gray-500">連絡先:</span>
              <p className="font-medium">{senderSettings?.senderContact || '未設定'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
