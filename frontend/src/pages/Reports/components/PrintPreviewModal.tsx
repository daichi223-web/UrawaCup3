// src/pages/Reports/components/PrintPreviewModal.tsx

import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { FinalResultPrintView, FinalSchedulePrintView } from '@/components/reports';
import type { FinalResultData, FinalScheduleData } from '@/features/reports';

interface PrintPreviewModalProps {
  type: 'result' | 'schedule' | null;
  printData: FinalResultData | FinalScheduleData | null;
  onClose: () => void;
  onPrint: () => void;
}

export function PrintPreviewModal({
  type,
  printData,
  onClose,
  onPrint,
}: PrintPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!type || !printData) return null;

  return (
    <div className="print-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:block">
      <div className="print-modal-content bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:block">
        {/* ヘッダー（印刷時非表示） */}
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h3 className="text-lg font-semibold">
            {type === 'result' ? '最終結果報告書' : '最終日組み合わせ表'} - 印刷プレビュー
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="btn btn-primary flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              印刷 / PDF保存
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)] print:max-h-none print:overflow-visible">
          {type === 'result' ? (
            <FinalResultPrintView ref={printRef} data={printData as unknown as Parameters<typeof FinalResultPrintView>[0]['data']} />
          ) : (
            <FinalSchedulePrintView ref={printRef} data={printData as unknown as Parameters<typeof FinalSchedulePrintView>[0]['data']} />
          )}
        </div>
      </div>
    </div>
  );
}

export const PrintStyles = () => (
  <style>{`
    @media print {
      /* 印刷時は全て非表示にしてからモーダルのみ表示 */
      body * {
        visibility: hidden;
      }
      .print-modal,
      .print-modal *,
      .print-view,
      .print-view * {
        visibility: visible !important;
      }
      .print-modal {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        padding: 0 !important;
      }
      .print-modal-content {
        max-width: none !important;
        max-height: none !important;
        width: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        overflow: visible !important;
      }
      .print-view {
        padding: 10mm !important;
      }
      .print\\:hidden {
        display: none !important;
      }
      /* 背景色を印刷 */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `}</style>
);
