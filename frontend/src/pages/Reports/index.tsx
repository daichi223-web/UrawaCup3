// src/pages/Reports/index.tsx

import { OutstandingPlayersModal } from '@/features/outstanding-players';
import { useReports } from './hooks/useReports';
import {
  OutputConditionsCard,
  ActionArea,
  SpecialReportsCard,
  OutstandingPlayersCard,
  SenderSettingsCard,
  RecipientsCard,
  PreviewModal,
  PrintPreviewModal,
  PrintStyles,
} from './components';

/**
 * 報告書出力画面
 * PDF/Excel形式での報告書生成・送信
 */
export default function Reports() {
  const {
    date,
    venueId,
    format,
    loading,
    specialReportLoading,
    showPreview,
    previewData,
    previewLoading,
    isEditingSender,
    senderForm,
    showPrintModal,
    printData,
    printLoading,
    showOutstandingPlayersModal,
    tournamentId,
    senderSettings,
    senderLoading,
    venues,
    dateOptions,
    dateMap,
    updateSenderSettings,
    setDate,
    setVenueId,
    setFormat,
    setShowPreview,
    setIsEditingSender,
    setSenderForm,
    setShowOutstandingPlayersModal,
    handleDownload,
    handlePreview,
    handleDownloadSpecialReport,
    handleOpenPrintPreview,
    handlePrint,
    handleDownloadRichExcel,
    handleSaveSenderSettings,
    handleCancelEditSender,
    handleClosePrintModal,
  } = useReports();

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">報告書出力</h1>
        <p className="text-gray-600 mt-1">
          試合結果報告書をPDF/Excel形式で出力します
        </p>
      </div>

      {/* 出力条件設定 */}
      <OutputConditionsCard
        date={date}
        setDate={setDate}
        venueId={venueId}
        setVenueId={setVenueId}
        format={format}
        setFormat={setFormat}
        venues={venues}
        dateOptions={dateOptions}
      />

      {/* 出力アクション */}
      <ActionArea
        date={date}
        dateMap={dateMap}
        venueId={venueId}
        format={format}
        loading={loading}
        previewLoading={previewLoading}
        onPreview={handlePreview}
        onDownload={handleDownload}
      />

      {/* 特別レポート出力 */}
      <SpecialReportsCard
        specialReportLoading={specialReportLoading}
        printLoading={printLoading}
        onDownloadSpecialReport={handleDownloadSpecialReport}
        onOpenPrintPreview={handleOpenPrintPreview}
        onDownloadRichExcel={handleDownloadRichExcel}
      />

      {/* 優秀選手登録 */}
      <OutstandingPlayersCard
        onOpenModal={() => setShowOutstandingPlayersModal(true)}
      />

      {/* 発信元設定 */}
      <SenderSettingsCard
        isEditing={isEditingSender}
        senderForm={senderForm}
        senderSettings={senderSettings}
        senderLoading={senderLoading}
        isSaving={updateSenderSettings.isPending}
        onEdit={() => setIsEditingSender(true)}
        onCancel={handleCancelEditSender}
        onSave={handleSaveSenderSettings}
        onFormChange={setSenderForm}
      />

      {/* 送信先一覧 */}
      <RecipientsCard />

      {/* プレビューモーダル */}
      <PreviewModal
        isOpen={showPreview}
        previewData={previewData}
        onClose={() => setShowPreview(false)}
        onDownload={handleDownload}
      />

      {/* 印刷プレビューモーダル */}
      <PrintPreviewModal
        type={showPrintModal}
        printData={printData}
        onClose={handleClosePrintModal}
        onPrint={handlePrint}
      />

      {/* 印刷時のスタイル */}
      <PrintStyles />

      {/* 優秀選手登録モーダル */}
      <OutstandingPlayersModal
        isOpen={showOutstandingPlayersModal}
        onClose={() => setShowOutstandingPlayersModal(false)}
        tournamentId={tournamentId}
      />
    </div>
  );
}
