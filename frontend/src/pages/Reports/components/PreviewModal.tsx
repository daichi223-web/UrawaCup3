// src/pages/Reports/components/PreviewModal.tsx

import { FileText, X, Clock, Download } from 'lucide-react';
import type { ReportPreviewData } from '../types';

interface PreviewModalProps {
  isOpen: boolean;
  previewData: ReportPreviewData | null;
  onClose: () => void;
  onDownload: () => void;
}

export function PreviewModal({
  isOpen,
  previewData,
  onClose,
  onDownload,
}: PreviewModalProps) {
  if (!isOpen || !previewData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            報告書プレビュー - {previewData.date}
            {previewData.venue && ` (${previewData.venue.name})`}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {previewData.matches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>この条件に該当する試合がありません</p>
              <p className="text-sm mt-2">日付や会場を確認してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                {previewData.matches.length}試合が報告書に含まれます
              </p>
              {previewData.matches.map((match) => (
                <div
                  key={match.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {match.match_time?.slice(0, 5) || '--:--'}
                      </span>
                      <span className="font-medium">
                        {match.home_team?.short_name || match.home_team?.name || '未定'}
                      </span>
                      <span className="px-3 py-1 bg-gray-100 rounded font-bold">
                        {match.status === 'completed'
                          ? `${match.home_score ?? 0} - ${match.away_score ?? 0}`
                          : 'vs'}
                      </span>
                      <span className="font-medium">
                        {match.away_team?.short_name || match.away_team?.name || '未定'}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      match.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : match.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {match.status === 'completed' ? '終了'
                        : match.status === 'in_progress' ? '試合中'
                        : '予定'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            閉じる
          </button>
          <button
            onClick={() => {
              onClose();
              onDownload();
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
}
