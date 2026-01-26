// src/pages/Reports/hooks/useReports.ts

import { useState, useEffect, useMemo } from 'react';
import { reportApi, type FinalResultData, type FinalScheduleData } from '@/features/reports';
import { useSenderSettings, useUpdateSenderSettings } from '@/features/reports/hooks';
import { useVenuesByTournament } from '@/features/venues/hooks';
import { matchesApi, venuesApi } from '@/lib/api';
import type { Venue } from '@/lib/database.types';
import toast from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';
import type { MatchApiData, MatchPreview, ReportPreviewData, SenderFormState, DateOptions } from '../types';

export function useReports() {
  const [date, setDate] = useState('');
  const [venueId, setVenueId] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(false);
  const [specialReportLoading, setSpecialReportLoading] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 発信元設定
  const [isEditingSender, setIsEditingSender] = useState(false);
  const [senderForm, setSenderForm] = useState<SenderFormState>({
    senderOrganization: '',
    senderName: '',
    senderContact: '',
  });

  // 印刷プレビュー
  const [showPrintModal, setShowPrintModal] = useState<'result' | 'schedule' | null>(null);
  const [printData, setPrintData] = useState<FinalResultData | FinalScheduleData | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  // 優秀選手登録モーダル
  const [showOutstandingPlayersModal, setShowOutstandingPlayersModal] = useState(false);

  // appStoreから現在のトーナメントIDを取得
  const { currentTournament } = useAppStore();
  const tournamentId = currentTournament?.id || 1;

  // 発信元設定の取得
  const { data: senderSettings, isLoading: senderLoading } = useSenderSettings(tournamentId);
  const updateSenderSettings = useUpdateSenderSettings();

  // 会場データの取得
  const { data: venues = [] } = useVenuesByTournament(tournamentId);

  // 発信元設定をフォームに反映
  useEffect(() => {
    if (senderSettings) {
      setSenderForm({
        senderOrganization: senderSettings.senderOrganization || '',
        senderName: senderSettings.senderName || '',
        senderContact: senderSettings.senderContact || '',
      });
    }
  }, [senderSettings]);

  // 日付のマッピング（大会日程から動的に生成）
  const dateOptions: DateOptions = useMemo(() => {
    const formatDateLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    if (currentTournament?.startDate) {
      const start = new Date(currentTournament.startDate);
      const day1 = currentTournament.startDate;
      const day2 = new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const day3 = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return {
        map: { 'day1': day1, 'day2': day2, 'day3': day3 },
        labels: {
          'day1': `Day1 (${formatDateLabel(day1)})`,
          'day2': `Day2 (${formatDateLabel(day2)})`,
          'day3': `Day3 (${formatDateLabel(day3)})`,
        }
      };
    }
    // デフォルト（大会情報がない場合）
    return {
      map: { 'day1': '2025-03-29', 'day2': '2025-03-30', 'day3': '2025-03-31' },
      labels: { 'day1': 'Day1', 'day2': 'Day2', 'day3': 'Day3' }
    };
  }, [currentTournament?.startDate]);

  const dateMap: Record<string, string> = dateOptions.map;

  // 発信元設定の保存
  const handleSaveSenderSettings = async () => {
    try {
      await updateSenderSettings.mutateAsync({
        tournamentId,
        data: senderForm,
      });
      setIsEditingSender(false);
      toast.success('発信元設定を保存しました');
    } catch {
      toast.error('保存に失敗しました');
    }
  };

  const handleDownload = async () => {
    if (!date) {
      toast.error('日付を選択してください');
      return;
    }

    try {
      setLoading(true);
      const targetDate = dateMap[date];
      const venue = venueId ? parseInt(venueId) : undefined;

      let blob: Blob;
      let usedFallback = false;
      let filename = `report_${targetDate}`;
      if (venue) filename += `_venue${venue}`;

      if (format === 'pdf') {
        const result = await reportApi.downloadPdf({
          tournamentId,
          date: targetDate,
          venueId: venue,
          format: 'pdf'
        });
        blob = result.blob;
        usedFallback = result.usedFallback;
        filename += '.pdf';
      } else {
        blob = await reportApi.downloadExcel({
          tournamentId,
          date: targetDate,
          venueId: venue,
          format: 'excel'
        });
        filename += '.xlsx';
      }

      // ダウンロード処理
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // フォールバック使用時は警告を表示
      if (usedFallback) {
        toast('簡易版PDFを生成しました（バックエンドAPI接続失敗）\n※日本語が正しく表示されない場合があります', {
          icon: '⚠️',
          duration: 5000,
        });
      } else {
        toast.success('ダウンロードを開始しました');
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('報告書の生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // プレビューデータを取得
  const handlePreview = async () => {
    if (!date) {
      toast.error('日付を選択してください');
      return;
    }

    try {
      setPreviewLoading(true);
      const targetDate = dateMap[date];
      const venueIdNum = venueId ? parseInt(venueId) : undefined;

      // Supabase APIを使用してプレビューデータを取得
      const { matches: rawMatches } = await matchesApi.getAll(tournamentId);
      const matches = (rawMatches || []) as MatchApiData[];

      // 日付とオプションの会場でフィルタリング
      const filteredMatches = matches.filter((m) => {
        const matchDate = m.match_date === targetDate;
        const matchVenue = venueIdNum ? m.venue_id === venueIdNum : true;
        return matchDate && matchVenue;
      });

      // 会場情報を取得
      let venueInfo: Venue | null = null;
      if (venueIdNum) {
        const venueList = await venuesApi.getAll(tournamentId) as { id: number; name: string }[] | null;
        venueInfo = venueList?.find((v) => v.id === venueIdNum) as Venue | null ?? null;
      }

      // プレビュー形式に変換
      const previewMatches: MatchPreview[] = filteredMatches.map((m) => ({
        id: m.id,
        match_time: m.match_time,
        home_team: m.home_team || { name: '未定' },
        away_team: m.away_team || { name: '未定' },
        home_score: m.home_score_total,
        away_score: m.away_score_total,
        status: m.status,
      }));

      setPreviewData({
        date: targetDate,
        venue: venueInfo ? { id: venueInfo.id, name: venueInfo.name } : null,
        matches: previewMatches,
      });
      setShowPreview(true);
    } catch (err: unknown) {
      console.error(err);
      toast.error('プレビューデータの取得に失敗しました');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 特別レポートのダウンロード
  const handleDownloadSpecialReport = async (
    type: 'groupStandings' | 'finalDaySchedule' | 'finalResult',
    reportFormat: 'pdf' | 'excel' = 'pdf'
  ) => {
    try {
      setSpecialReportLoading(`${type}-${reportFormat}`);
      let blob: Blob;
      let filename: string;
      const ext = reportFormat === 'pdf' ? 'pdf' : 'xlsx';

      switch (type) {
        case 'groupStandings':
          blob = reportFormat === 'pdf'
            ? await reportApi.downloadGroupStandings({ tournamentId })
            : await reportApi.downloadGroupStandingsExcel({ tournamentId });
          filename = `group_standings_${tournamentId}.${ext}`;
          break;
        case 'finalDaySchedule':
          if (!date) {
            toast.error('日付を選択してください');
            return;
          }
          blob = reportFormat === 'pdf'
            ? await reportApi.downloadFinalDaySchedule({ tournamentId, date: dateMap[date] })
            : await reportApi.downloadFinalDayScheduleExcel({ tournamentId, date: dateMap[date] });
          filename = `final_day_schedule_${dateMap[date]}.${ext}`;
          break;
        case 'finalResult':
          blob = reportFormat === 'pdf'
            ? await reportApi.downloadFinalResult(tournamentId)
            : await reportApi.downloadFinalResultExcel(tournamentId);
          filename = `final_result_${tournamentId}.${ext}`;
          break;
      }

      // ダウンロード処理
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('ダウンロードを開始しました');
    } catch (err: unknown) {
      console.error(err);
      toast.error('レポートの生成に失敗しました');
    } finally {
      setSpecialReportLoading(null);
    }
  };

  // 印刷プレビューを開く
  const handleOpenPrintPreview = async (type: 'result' | 'schedule') => {
    try {
      setPrintLoading(true);
      if (type === 'result') {
        const data = await reportApi.getFinalResultData(tournamentId);
        setPrintData(data);
      } else {
        const targetDate = date ? dateMap[date] : undefined;
        const data = await reportApi.getFinalScheduleData(tournamentId, targetDate);
        setPrintData(data);
      }
      setShowPrintModal(type);
    } catch (err) {
      console.error(err);
      toast.error('データの取得に失敗しました');
    } finally {
      setPrintLoading(false);
    }
  };

  // 印刷実行
  const handlePrint = () => {
    window.print();
  };

  // リッチExcelダウンロード
  const handleDownloadRichExcel = async (type: 'result' | 'schedule') => {
    try {
      setSpecialReportLoading(`${type}-excel-rich`);
      let blob: Blob;
      let filename: string;

      if (type === 'result') {
        blob = await reportApi.downloadFinalResultExcelRich(tournamentId);
        filename = `final_result_${tournamentId}.xlsx`;
      } else {
        const targetDate = date ? dateMap[date] : undefined;
        blob = await reportApi.downloadFinalScheduleExcelRich(tournamentId, targetDate);
        filename = `final_schedule_${targetDate || tournamentId}.xlsx`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('ダウンロードを開始しました');
    } catch (err) {
      console.error(err);
      toast.error('Excelの生成に失敗しました');
    } finally {
      setSpecialReportLoading(null);
    }
  };

  // キャンセル編集
  const handleCancelEditSender = () => {
    setIsEditingSender(false);
    if (senderSettings) {
      setSenderForm({
        senderOrganization: senderSettings.senderOrganization || '',
        senderName: senderSettings.senderName || '',
        senderContact: senderSettings.senderContact || '',
      });
    }
  };

  // 印刷モーダルを閉じる
  const handleClosePrintModal = () => {
    setShowPrintModal(null);
    setPrintData(null);
  };

  return {
    // State
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

    // Setters
    setDate,
    setVenueId,
    setFormat,
    setShowPreview,
    setIsEditingSender,
    setSenderForm,
    setShowOutstandingPlayersModal,

    // Handlers
    handleDownload,
    handlePreview,
    handleDownloadSpecialReport,
    handleOpenPrintPreview,
    handlePrint,
    handleDownloadRichExcel,
    handleSaveSenderSettings,
    handleCancelEditSender,
    handleClosePrintModal,
  };
}
