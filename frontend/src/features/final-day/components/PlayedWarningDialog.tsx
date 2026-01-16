// src/features/final-day/components/PlayedWarningDialog.tsx
// 対戦済みチーム警告ダイアログ（強化版）

import { AlertTriangle, X, Swords, Calendar, ShieldAlert } from 'lucide-react';

interface PlayedWarningDialogProps {
  isOpen: boolean;
  team1Name: string;
  team2Name: string;
  matchDate?: string | null;
  score?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlayedWarningDialog({
  isOpen,
  team1Name,
  team2Name,
  matchDate,
  score,
  onConfirm,
  onCancel,
}: PlayedWarningDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ（赤みがかったオーバーレイで警告感を強調） */}
      <div
        className="absolute inset-0 bg-red-900/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border-2 border-red-200 animate-in zoom-in-95 duration-200">
        {/* ヘッダー（赤系の警告色に変更） */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4 flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            <ShieldAlert className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">対戦済み警告</h3>
            <p className="text-white/80 text-sm">研修試合の組み合わせに注意が必要です</p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-white/80 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-5">
          {/* チーム対戦表示 */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 mb-4 border border-red-100">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="font-bold text-gray-800 text-lg">{team1Name}</div>
              </div>
              <div className="flex flex-col items-center">
                <Swords className="text-red-500" size={28} />
                <span className="text-xs text-red-600 font-semibold mt-1">VS</span>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-800 text-lg">{team2Name}</div>
              </div>
            </div>
          </div>

          {/* 警告メッセージ */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-amber-800 font-semibold">予選リーグで対戦済みです</p>
              <p className="text-amber-700 text-sm mt-1">
                研修試合では未対戦のチーム同士の組み合わせが推奨されます。
              </p>
            </div>
          </div>

          {/* 予選での対戦結果 */}
          {matchDate && (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <Calendar size={16} />
                予選での対戦結果
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-medium">{matchDate}</span>
                {score && (
                  <span className="bg-gray-200 px-3 py-1 rounded-full font-bold text-gray-700">
                    {score}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="bg-gray-50 px-5 py-4 flex justify-end gap-3 border-t">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-medium transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <AlertTriangle size={18} />
            強制確定する
          </button>
        </div>
      </div>
    </div>
  );
}
