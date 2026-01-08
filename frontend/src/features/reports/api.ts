// src/features/reports/api.ts
// 報告書API呼び出し - Supabase版
// クライアントサイドでPDF/Excel生成
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { ReportGenerateInput, ReportJob, ReportRecipient, SenderSettings, SenderSettingsUpdate } from './types';

// jsPDF autotable型定義
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const reportApi = {
  // 報告書生成開始（Supabase Edge Functionが必要）
  generate: async (data: ReportGenerateInput): Promise<{ jobId: string }> => {
    console.warn('Report generation requires Supabase Edge Function');
    return { jobId: 'not-implemented' };
  },

  // 生成ジョブ状態確認
  getJobStatus: async (jobId: string): Promise<ReportJob> => {
    return {
      id: jobId,
      status: 'completed',
      progress: 100,
      createdAt: new Date().toISOString(),
    };
  },

  // 報告書ダウンロード（Supabase Edge Functionが必要）
  download: async (jobId: string): Promise<Blob> => {
    console.warn('Report download requires Supabase Edge Function');
    return new Blob(['Report generation not implemented'], { type: 'text/plain' });
  },

  // 日別報告書PDFダウンロード
  downloadPdf: async (params: { tournamentId: number; date: string; venueId?: number; format?: string }): Promise<Blob> => {
    // 試合データを取得
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name),
        venue:venues(name)
      `)
      .eq('tournament_id', params.tournamentId)
      .eq('match_date', params.date)
      .order('match_time');

    if (params.venueId) {
      query = query.eq('venue_id', params.venueId);
    }

    const { data: matches, error } = await query;
    if (error) throw error;

    // PDF生成
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text(`試合結果報告書 - ${params.date}`, 14, 20);

    const tableData = (matches || []).map(m => [
      m.match_time?.slice(0, 5) || '',
      m.home_team?.short_name || m.home_team?.name || '未定',
      m.status === 'completed' ? `${m.home_score_total ?? 0} - ${m.away_score_total ?? 0}` : 'vs',
      m.away_team?.short_name || m.away_team?.name || '未定',
      m.venue?.name || '',
      m.status === 'completed' ? '終了' : m.status === 'in_progress' ? '試合中' : '予定'
    ]);

    doc.autoTable({
      startY: 30,
      head: [['時間', 'ホーム', 'スコア', 'アウェイ', '会場', '状態']],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    return doc.output('blob');
  },

  // 日別報告書Excelダウンロード
  downloadExcel: async (params: { tournamentId: number; date: string; venueId?: number; format?: string }): Promise<Blob> => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name),
        venue:venues(name)
      `)
      .eq('tournament_id', params.tournamentId)
      .eq('match_date', params.date)
      .order('match_time');

    if (params.venueId) {
      query = query.eq('venue_id', params.venueId);
    }

    const { data: matches, error } = await query;
    if (error) throw error;

    const wsData = [
      ['時間', 'ホーム', 'スコア', 'アウェイ', '会場', '状態'],
      ...(matches || []).map(m => [
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '未定',
        m.status === 'completed' ? `${m.home_score_total ?? 0} - ${m.away_score_total ?? 0}` : 'vs',
        m.away_team?.short_name || m.away_team?.name || '未定',
        m.venue?.name || '',
        m.status === 'completed' ? '終了' : m.status === 'in_progress' ? '試合中' : '予定'
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '試合結果');

    ws['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 8 }];

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 送信先一覧
  getRecipients: async (tournamentId: number): Promise<ReportRecipient[]> => {
    const { data, error } = await supabase
      .from('report_recipients')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name');
    if (error) throw error;
    return (data || []) as ReportRecipient[];
  },

  // 送信先追加
  addRecipient: async (data: Omit<ReportRecipient, 'id'>): Promise<ReportRecipient> => {
    const { data: recipient, error } = await supabase
      .from('report_recipients')
      .insert({
        tournament_id: data.tournamentId,
        name: data.name,
        email: data.email,
        role: data.role,
        is_active: data.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    return recipient as ReportRecipient;
  },

  // 送信先更新
  updateRecipient: async (id: number, data: Partial<ReportRecipient>): Promise<ReportRecipient> => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: recipient, error } = await supabase
      .from('report_recipients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return recipient as ReportRecipient;
  },

  // 送信先削除
  deleteRecipient: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('report_recipients')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // グループ順位表PDFダウンロード
  downloadGroupStandings: async (params: { tournamentId: number; groupId?: string }): Promise<Blob> => {
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', params.tournamentId)
      .order('id');

    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('グループ順位表', 14, 20);

    let yPos = 30;
    for (const group of groups || []) {
      if (params.groupId && group.id !== params.groupId) continue;

      const { data: standings } = await supabase
        .from('standings')
        .select('*, team:teams(name, short_name)')
        .eq('tournament_id', params.tournamentId)
        .eq('group_id', group.id)
        .order('rank');

      doc.setFontSize(12);
      doc.text(`${group.name}`, 14, yPos);
      yPos += 5;

      const tableData = (standings || []).map(s => [
        s.rank,
        s.team?.short_name || s.team?.name || '',
        s.played,
        s.won,
        s.drawn,
        s.lost,
        s.goals_for,
        s.goals_against,
        s.goal_difference,
        s.points
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 14 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    }

    return doc.output('blob');
  },

  // グループ順位表Excelダウンロード
  downloadGroupStandingsExcel: async (params: { tournamentId: number; groupId?: string }): Promise<Blob> => {
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', params.tournamentId)
      .order('id');

    const wb = XLSX.utils.book_new();

    for (const group of groups || []) {
      if (params.groupId && group.id !== params.groupId) continue;

      const { data: standings } = await supabase
        .from('standings')
        .select('*, team:teams(name, short_name)')
        .eq('tournament_id', params.tournamentId)
        .eq('group_id', group.id)
        .order('rank');

      const wsData = [
        ['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点'],
        ...(standings || []).map(s => [
          s.rank,
          s.team?.short_name || s.team?.name || '',
          s.played,
          s.won,
          s.drawn,
          s.lost,
          s.goals_for,
          s.goals_against,
          s.goal_difference,
          s.points
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }];
      XLSX.utils.book_append_sheet(wb, ws, group.name || group.id);
    }

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終日組み合わせ表PDFダウンロード
  downloadFinalDaySchedule: async (params: { tournamentId: number; date: string }): Promise<Blob> => {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name),
        venue:venues(name)
      `)
      .eq('tournament_id', params.tournamentId)
      .eq('match_date', params.date)
      .in('stage', ['semifinal', 'third_place', 'final', 'training'])
      .order('match_time');

    if (error) throw error;

    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text(`最終日組み合わせ表 - ${params.date}`, 14, 20);

    const tableData = (matches || []).map(m => [
      m.match_time?.slice(0, 5) || '',
      m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : m.stage === 'semifinal' ? '準決勝' : '順位リーグ',
      m.home_team?.short_name || m.home_team?.name || m.home_seed || '未定',
      'vs',
      m.away_team?.short_name || m.away_team?.name || m.away_seed || '未定',
      m.venue?.name || ''
    ]);

    doc.autoTable({
      startY: 30,
      head: [['時間', 'ステージ', 'ホーム', '', 'アウェイ', '会場']],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    return doc.output('blob');
  },

  // 最終日組み合わせ表Excelダウンロード
  downloadFinalDayScheduleExcel: async (params: { tournamentId: number; date: string }): Promise<Blob> => {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name),
        venue:venues(name)
      `)
      .eq('tournament_id', params.tournamentId)
      .eq('match_date', params.date)
      .in('stage', ['semifinal', 'third_place', 'final', 'training'])
      .order('match_time');

    if (error) throw error;

    const wsData = [
      ['時間', 'ステージ', 'ホーム', '', 'アウェイ', '会場'],
      ...(matches || []).map(m => [
        m.match_time?.slice(0, 5) || '',
        m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : m.stage === 'semifinal' ? '準決勝' : '順位リーグ',
        m.home_team?.short_name || m.home_team?.name || m.home_seed || '未定',
        'vs',
        m.away_team?.short_name || m.away_team?.name || m.away_seed || '未定',
        m.venue?.name || ''
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '最終日日程');

    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 4 }, { wch: 15 }, { wch: 15 }];

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終結果報告書PDFダウンロード
  downloadFinalResult: async (tournamentId: number): Promise<Blob> => {
    // 決勝・3位決定戦の結果を取得
    const { data: finalMatches } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['final', 'third_place'])
      .eq('status', 'completed');

    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('最終結果報告書', 14, 20);

    let yPos = 35;
    doc.setFontSize(14);

    const finalMatch = finalMatches?.find(m => m.stage === 'final');
    const thirdMatch = finalMatches?.find(m => m.stage === 'third_place');

    if (finalMatch) {
      const winner = finalMatch.result === 'home_win' ? finalMatch.home_team : finalMatch.away_team;
      const runnerUp = finalMatch.result === 'home_win' ? finalMatch.away_team : finalMatch.home_team;

      doc.text(`優勝: ${winner?.name || '未定'}`, 14, yPos);
      yPos += 10;
      doc.text(`準優勝: ${runnerUp?.name || '未定'}`, 14, yPos);
      yPos += 10;
    }

    if (thirdMatch) {
      const third = thirdMatch.result === 'home_win' ? thirdMatch.home_team : thirdMatch.away_team;
      doc.text(`第3位: ${third?.name || '未定'}`, 14, yPos);
      yPos += 15;
    }

    // 決勝戦詳細
    if (finalMatch) {
      doc.setFontSize(12);
      doc.text('【決勝戦】', 14, yPos);
      yPos += 8;
      doc.text(
        `${finalMatch.home_team?.name} ${finalMatch.home_score_total} - ${finalMatch.away_score_total} ${finalMatch.away_team?.name}`,
        14, yPos
      );
    }

    return doc.output('blob');
  },

  // 最終結果報告書Excelダウンロード
  downloadFinalResultExcel: async (tournamentId: number): Promise<Blob> => {
    const { data: finalMatches } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['final', 'third_place'])
      .eq('status', 'completed');

    const finalMatch = finalMatches?.find(m => m.stage === 'final');
    const thirdMatch = finalMatches?.find(m => m.stage === 'third_place');

    const wsData: (string | number)[][] = [['最終結果'], []];

    if (finalMatch) {
      const winner = finalMatch.result === 'home_win' ? finalMatch.home_team : finalMatch.away_team;
      const runnerUp = finalMatch.result === 'home_win' ? finalMatch.away_team : finalMatch.home_team;

      wsData.push(['優勝', winner?.name || '']);
      wsData.push(['準優勝', runnerUp?.name || '']);
    }

    if (thirdMatch) {
      const third = thirdMatch.result === 'home_win' ? thirdMatch.home_team : thirdMatch.away_team;
      wsData.push(['第3位', third?.name || '']);
    }

    wsData.push([]);
    wsData.push(['【決勝戦詳細】']);
    if (finalMatch) {
      wsData.push(['', finalMatch.home_team?.name || '', finalMatch.home_score_total ?? 0, '-', finalMatch.away_score_total ?? 0, finalMatch.away_team?.name || '']);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '最終結果');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 発信元設定取得
  getSenderSettings: async (tournamentId: number): Promise<SenderSettings> => {
    const { data, error } = await supabase
      .from('sender_settings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .single();

    if (error) {
      // デフォルト値を返す
      return {
        tournamentId,
        senderName: '',
        senderTitle: '',
        senderOrganization: '',
      };
    }
    return data as SenderSettings;
  },

  // 発信元設定更新
  updateSenderSettings: async (tournamentId: number, data: SenderSettingsUpdate): Promise<SenderSettings> => {
    const { data: settings, error } = await supabase
      .from('sender_settings')
      .upsert({
        tournament_id: tournamentId,
        sender_name: data.senderName,
        sender_title: data.senderTitle,
        sender_organization: data.senderOrganization,
      })
      .select()
      .single();

    if (error) throw error;
    return settings as SenderSettings;
  },
};
