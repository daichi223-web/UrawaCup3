// src/pages/Reports/components/SpecialReportsCard.tsx

import { Table, Calendar, Trophy, Printer, Download } from 'lucide-react';

interface SpecialReportsCardProps {
  specialReportLoading: string | null;
  printLoading: boolean;
  onDownloadSpecialReport: (type: 'groupStandings' | 'finalDaySchedule' | 'finalResult', format: 'pdf' | 'excel') => void;
  onOpenPrintPreview: (type: 'result' | 'schedule') => void;
  onDownloadRichExcel: (type: 'result' | 'schedule') => void;
}

export function SpecialReportsCard({
  specialReportLoading,
  printLoading,
  onDownloadSpecialReport,
  onOpenPrintPreview,
  onDownloadRichExcel,
}: SpecialReportsCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">特別レポート出力</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* グループ順位表 */}
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center text-center">
            <Table className="w-10 h-10 mb-3 text-blue-500" />
            <h4 className="font-medium mb-2">グループ順位表</h4>
            <p className="text-sm text-gray-500 mb-4">予選リーグの順位表を出力</p>
            <div className="flex gap-2">
              <button
                onClick={() => onDownloadSpecialReport('groupStandings', 'pdf')}
                disabled={specialReportLoading === 'groupStandings-pdf'}
                className="btn btn-secondary flex items-center gap-2 text-sm"
              >
                {specialReportLoading === 'groupStandings-pdf' ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                PDF
              </button>
              <button
                onClick={() => onDownloadSpecialReport('groupStandings', 'excel')}
                disabled={specialReportLoading === 'groupStandings-excel'}
                className="btn btn-success flex items-center gap-2 text-sm"
              >
                {specialReportLoading === 'groupStandings-excel' ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Excel
              </button>
            </div>
          </div>

          {/* 最終日組み合わせ表 */}
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center text-center">
            <Calendar className="w-10 h-10 mb-3 text-green-500" />
            <h4 className="font-medium mb-2">最終日組み合わせ表</h4>
            <p className="text-sm text-gray-500 mb-4">順位リーグ・決勝トーナメントの日程</p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => onOpenPrintPreview('schedule')}
                  disabled={printLoading}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  {printLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  印刷
                </button>
                <button
                  onClick={() => onDownloadRichExcel('schedule')}
                  disabled={specialReportLoading === 'schedule-excel-rich'}
                  className="btn btn-success flex items-center gap-2 text-sm"
                >
                  {specialReportLoading === 'schedule-excel-rich' ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Excel
                </button>
              </div>
            </div>
          </div>

          {/* 最終結果報告書 */}
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center text-center">
            <Trophy className="w-10 h-10 mb-3 text-yellow-500" />
            <h4 className="font-medium mb-2">最終結果報告書</h4>
            <p className="text-sm text-gray-500 mb-4">決勝トーナメント結果・最終順位</p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => onOpenPrintPreview('result')}
                  disabled={printLoading}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  {printLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  印刷
                </button>
                <button
                  onClick={() => onDownloadRichExcel('result')}
                  disabled={specialReportLoading === 'result-excel-rich'}
                  className="btn btn-success flex items-center gap-2 text-sm"
                >
                  {specialReportLoading === 'result-excel-rich' ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
