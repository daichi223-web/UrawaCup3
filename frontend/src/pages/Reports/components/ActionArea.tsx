// src/pages/Reports/components/ActionArea.tsx

import { FileText, Download, Eye } from 'lucide-react';

interface ActionAreaProps {
  date: string;
  dateMap: Record<string, string>;
  venueId: string;
  format: 'pdf' | 'excel';
  loading: boolean;
  previewLoading: boolean;
  onPreview: () => void;
  onDownload: () => void;
}

export function ActionArea({
  date,
  dateMap,
  venueId,
  format,
  loading,
  previewLoading,
  onPreview,
  onDownload,
}: ActionAreaProps) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-lg font-semibold">出力アクション</h3>
      </div>
      <div className="card-body">
        <div className="bg-gray-50 rounded-lg p-8 flex flex-col items-center justify-center text-center">
          <FileText className={`w-16 h-16 mb-4 ${date ? 'text-primary-500' : 'text-gray-300'}`} />

          {!date ? (
            <p className="text-gray-500">
              上のフォームから出力条件（特に日付）を選択してください
            </p>
          ) : (
            <div className="space-y-4">
              <p className="font-medium text-gray-900">
                {dateMap[date]} の {venueId ? '指定会場' : '全会場'} の報告書を出力します
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={onPreview}
                  disabled={previewLoading}
                  className="btn btn-secondary flex items-center gap-2 px-6 py-3"
                >
                  {previewLoading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                      読込中...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      プレビュー
                    </>
                  )}
                </button>
                <button
                  onClick={onDownload}
                  disabled={loading}
                  className="btn btn-primary flex items-center gap-2 px-6 py-3"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      {format === 'pdf' ? 'PDF' : 'Excel'}をダウンロード
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ※ PDF生成には時間がかかる場合があります
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
