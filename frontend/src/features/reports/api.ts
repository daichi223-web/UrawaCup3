// src/features/reports/api.ts
// 報告書API呼び出し - Supabase版
// バックエンドAPI経由でPDF生成、フォールバックでクライアントサイド生成
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { ReportGenerateInput, ReportJob, ReportRecipient, SenderSettings, SenderSettingsUpdate } from './types';

// バックエンドAPI URL（PDF生成・日程生成サーバー）
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:8001';

// jsPDF autotable型定義
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// ================================================
// 型定義
// ================================================
interface Team {
  id: number
  name: string
  short_name?: string
  group_id?: string
}

interface Goal {
  minute: number
  half: number
  team_id: number
  player_name: string
  is_own_goal?: boolean
}

interface Match {
  id: number
  stage: string
  match_time?: string
  venue?: { name: string }
  home_team?: Team
  away_team?: Team
  home_score_half1?: number
  home_score_half2?: number
  away_score_half1?: number
  away_score_half2?: number
  home_score_total?: number
  away_score_total?: number
  home_pk?: number
  away_pk?: number
  has_penalty_shootout?: boolean
  result?: string
  goals?: Goal[]
  home_seed?: string
  away_seed?: string
}

interface Standing {
  team_id: number
  team: Team
  rank: number
  points: number
  goal_difference: number
  goals_for: number
  goals_against: number
  played: number
  won: number
  drawn: number
  lost: number
}

interface GroupStanding {
  groupId: string
  standings: Standing[]
}

interface Player {
  type: string
  name: string
  team: string
}

interface OutstandingPlayerData {
  id: number
  awardType: 'mvp' | 'outstanding'
  playerName: string
  playerNumber?: number
  teamName?: string
  displayOrder: number
}

export interface FinalResultData {
  tournamentName: string
  date: string
  ranking: (Team | null)[]
  tournament: Match[]
  training: Match[]
  players: Player[]
  outstandingPlayers: OutstandingPlayerData[]
}

export interface FinalScheduleData {
  tournamentName: string
  date: string
  standings: GroupStanding[]
  tournament: Match[]
  training: Match[]
  /** グループステージの試合結果（星取表用） */
  groupMatches: Match[]
  /** 優秀選手 */
  outstandingPlayers: OutstandingPlayerData[]
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

  // 日別報告書PDFダウンロード（バックエンドAPI経由）
  downloadPdf: async (params: { tournamentId: number; date: string; venueId?: number; format?: string }): Promise<Blob> => {
    // 試合データを取得（得点者データ含む）
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name),
        venue:venues(name),
        goals(*)
      `)
      .eq('tournament_id', params.tournamentId)
      .eq('match_date', params.date)
      .order('match_time');

    if (params.venueId) {
      query = query.eq('venue_id', params.venueId);
    }

    const { data: matches, error } = await query;
    if (error) throw error;

    // デバッグ: 試合データと会場情報を確認
    console.log('[downloadPdf] Matches count:', matches?.length || 0);
    if (matches && matches.length > 0) {
      console.log('[downloadPdf] First match venue data:', {
        venue_id: matches[0].venue_id,
        venue: matches[0].venue,
        raw: JSON.stringify(matches[0]).substring(0, 500)
      });
    }

    // 大会情報を取得
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, start_date, end_date')
      .eq('id', params.tournamentId)
      .single();

    // 発信元設定を取得
    const { data: senderSettings } = await supabase
      .from('sender_settings')
      .select('*')
      .eq('tournament_id', params.tournamentId)
      .single();

    // 日付から第N日を計算
    let day = 1;
    if (tournament?.start_date) {
      const startDate = new Date(tournament.start_date);
      const currentDate = new Date(params.date);
      day = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // 日付文字列を生成
    const dateObj = new Date(params.date);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${weekdays[dateObj.getDay()]}）`;

    // 会場ごとにグループ化
    const matchesByVenue: Record<string, any[]> = {};
    for (const match of matches || []) {
      const venueName = match.venue?.name || '未定';
      if (!matchesByVenue[venueName]) {
        matchesByVenue[venueName] = [];
      }

      // 得点者リストを作成
      const scorers = (match.goals || [])
        .sort((a: any, b: any) => (a.minute || 0) - (b.minute || 0))
        .map((goal: any) => ({
          time: String(goal.minute || ''),
          team: goal.team_id === match.home_team_id
            ? (match.home_team?.short_name || match.home_team?.name || '')
            : (match.away_team?.short_name || match.away_team?.name || ''),
          name: goal.player_name || '',
        }));

      matchesByVenue[venueName].push({
        homeTeam: { name: match.home_team?.short_name || match.home_team?.name || '---' },
        awayTeam: { name: match.away_team?.short_name || match.away_team?.name || '---' },
        kickoff: match.match_time?.slice(0, 5) || '--:--',
        homeScore1H: match.home_score_half1 ?? '',
        homeScore2H: match.home_score_half2 ?? '',
        awayScore1H: match.away_score_half1 ?? '',
        awayScore2H: match.away_score_half2 ?? '',
        scorers,
      });
    }

    // デバッグ: 会場別グループ化結果
    console.log('[downloadPdf] Venues found:', Object.keys(matchesByVenue));
    console.log('[downloadPdf] Matches per venue:', Object.fromEntries(
      Object.entries(matchesByVenue).map(([k, v]) => [k, (v as any[]).length])
    ));

    // バックエンドAPIを呼び出し
    try {
      const response = await fetch(`${CORE_API_URL}/daily-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day,
          dateStr,
          reportConfig: {
            recipient: senderSettings?.recipient || '埼玉県サッカー協会 御中',
            sender: senderSettings?.sender_name || '県立浦和高校',
            contact: senderSettings?.contact || '',
          },
          matchData: matchesByVenue,
        }),
      });

      if (response.ok) {
        return await response.blob();
      }
      console.warn('Backend API failed, falling back to local generation');
    } catch (e) {
      console.warn('Backend API error, falling back to local generation:', e);
    }

    // フォールバック: ローカルでPDF生成（会場ごとに1ページ）
    const doc = new jsPDF();
    doc.setFont('helvetica');

    const venueNames = Object.keys(matchesByVenue);

    // 会場ごとにページを生成
    venueNames.forEach((venueName, venueIndex) => {
      if (venueIndex > 0) {
        doc.addPage();
      }

      const venueMatches = matchesByVenue[venueName];

      // ヘッダー
      doc.setFontSize(16);
      doc.text(`試合結果報告書`, 14, 15);
      doc.setFontSize(12);
      doc.text(`${dateStr} - ${venueName}`, 14, 25);

      // 発信元情報
      doc.setFontSize(10);
      doc.text(`発信: ${senderSettings?.sender_name || ''}`, 14, 33);

      // 試合データをテーブル形式に変換
      const tableData = venueMatches.map((m: any) => {
        // 数値かどうかをチェック（0も有効な値として扱う）
        const hasHomeScore = typeof m.homeScore1H === 'number' && typeof m.homeScore2H === 'number';
        const hasAwayScore = typeof m.awayScore1H === 'number' && typeof m.awayScore2H === 'number';

        const homeScore = hasHomeScore
          ? `${m.homeScore1H}-${m.homeScore2H}`
          : '';
        const awayScore = hasAwayScore
          ? `${m.awayScore1H}-${m.awayScore2H}`
          : '';
        const totalHome = hasHomeScore
          ? m.homeScore1H + m.homeScore2H
          : '';
        const totalAway = hasAwayScore
          ? m.awayScore1H + m.awayScore2H
          : '';

        // 得点者リスト
        const scorersList = (m.scorers || [])
          .map((s: any) => `${s.time}' ${s.team} ${s.name}`)
          .join(', ');

        return [
          m.kickoff,
          m.homeTeam?.name || '---',
          homeScore,
          totalHome !== '' && totalAway !== '' ? `${totalHome} - ${totalAway}` : 'vs',
          awayScore,
          m.awayTeam?.name || '---',
          scorersList || '-'
        ];
      });

      doc.autoTable({
        startY: 40,
        head: [['時間', 'ホーム', '前後半', 'スコア', '前後半', 'アウェイ', '得点者']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          0: { cellWidth: 15 },  // 時間
          1: { cellWidth: 30 },  // ホーム
          2: { cellWidth: 15 },  // 前後半
          3: { cellWidth: 20 },  // スコア
          4: { cellWidth: 15 },  // 前後半
          5: { cellWidth: 30 },  // アウェイ
          6: { cellWidth: 55 },  // 得点者
        },
      });

      // フッター
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.text(`${venueIndex + 1} / ${venueNames.length}`, 100, pageHeight - 10);
    });

    // 会場データがない場合の処理
    if (venueNames.length === 0) {
      doc.setFontSize(14);
      doc.text(`試合結果報告書 - ${params.date}`, 14, 20);
      doc.setFontSize(10);
      doc.text('該当する試合データがありません', 14, 35);
    }

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

  // ================================================
  // 最終日レポート用データ取得
  // ================================================

  // 最終日結果データを取得（印刷ビュー用）
  getFinalResultData: async (tournamentId: number): Promise<FinalResultData> => {
    console.log('getFinalResultData: Starting for tournament', tournamentId);

    // 大会情報を取得
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('name, end_date')
      .eq('id', tournamentId)
      .single();

    if (tournamentError) {
      console.error('Failed to fetch tournament:', tournamentError);
    }
    console.log('Tournament:', tournament);

    // 決勝トーナメントの試合を取得
    const { data: tournamentMatches, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, group_id),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, group_id),
        venue:venues(name),
        goals(*)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['semifinal', 'third_place', 'final'])
      .order('match_time');

    if (matchError) {
      console.error('Failed to fetch tournament matches:', matchError);
    }
    console.log('Tournament matches:', tournamentMatches?.length || 0);

    // 研修試合を取得
    const { data: trainingMatches, error: trainingError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, group_id),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, group_id),
        venue:venues(name),
        goals(*)
      `)
      .eq('tournament_id', tournamentId)
      .eq('stage', 'training')
      .order('venue_id')
      .order('match_time');

    if (trainingError) {
      console.error('Failed to fetch training matches:', trainingError);
    }
    console.log('Training matches:', trainingMatches?.length || 0);

    // 順位を計算
    const ranking: (Team | null)[] = [null, null, null, null];
    const finalMatch = tournamentMatches?.find((m: any) => m.stage === 'final');
    const thirdMatch = tournamentMatches?.find((m: any) => m.stage === 'third_place');

    console.log('Final match:', finalMatch?.id, 'status:', finalMatch?.status);
    console.log('Third match:', thirdMatch?.id, 'status:', thirdMatch?.status);

    if (finalMatch && finalMatch.status === 'completed') {
      const homeTotal = finalMatch.home_score_total ?? 0;
      const awayTotal = finalMatch.away_score_total ?? 0;
      let winner: Team | null = null;
      let runnerUp: Team | null = null;

      if (homeTotal > awayTotal) {
        winner = finalMatch.home_team;
        runnerUp = finalMatch.away_team;
      } else if (awayTotal > homeTotal) {
        winner = finalMatch.away_team;
        runnerUp = finalMatch.home_team;
      } else if (finalMatch.has_penalty_shootout) {
        // PK戦
        const homePK = finalMatch.home_pk ?? 0;
        const awayPK = finalMatch.away_pk ?? 0;
        if (homePK > awayPK) {
          winner = finalMatch.home_team;
          runnerUp = finalMatch.away_team;
        } else {
          winner = finalMatch.away_team;
          runnerUp = finalMatch.home_team;
        }
      }

      ranking[0] = winner;
      ranking[1] = runnerUp;
    }

    if (thirdMatch && thirdMatch.status === 'completed') {
      const homeTotal = thirdMatch.home_score_total ?? 0;
      const awayTotal = thirdMatch.away_score_total ?? 0;
      let third: Team | null = null;
      let fourth: Team | null = null;

      if (homeTotal > awayTotal) {
        third = thirdMatch.home_team;
        fourth = thirdMatch.away_team;
      } else if (awayTotal > homeTotal) {
        third = thirdMatch.away_team;
        fourth = thirdMatch.home_team;
      } else if (thirdMatch.has_penalty_shootout) {
        const homePK = thirdMatch.home_pk ?? 0;
        const awayPK = thirdMatch.away_pk ?? 0;
        if (homePK > awayPK) {
          third = thirdMatch.home_team;
          fourth = thirdMatch.away_team;
        } else {
          third = thirdMatch.away_team;
          fourth = thirdMatch.home_team;
        }
      }

      ranking[2] = third;
      ranking[3] = fourth;
    }

    console.log('Ranking:', ranking.map(r => r?.name || 'null'));

    // 優秀選手データを取得
    const { data: outstandingPlayersData, error: playersError } = await supabase
      .from('outstanding_players')
      .select(`
        *,
        team:teams(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('award_type')
      .order('display_order');

    if (playersError) {
      console.error('Failed to fetch outstanding players:', playersError);
    }
    console.log('Outstanding players:', outstandingPlayersData?.length || 0);

    const outstandingPlayers: OutstandingPlayerData[] = (outstandingPlayersData || []).map((p: any) => ({
      id: p.id,
      awardType: p.award_type,
      playerName: p.player_name,
      playerNumber: p.player_number,
      teamName: p.team_name || p.team?.short_name || p.team?.name,
      displayOrder: p.display_order,
    }));

    const players: Player[] = [];

    return {
      tournamentName: tournament?.name || '浦和カップ',
      date: tournament?.end_date || '',
      ranking,
      tournament: tournamentMatches || [],
      training: trainingMatches || [],
      players,
      outstandingPlayers,
    };
  },

  // 最終日組み合わせデータを取得（印刷ビュー用）
  getFinalScheduleData: async (tournamentId: number, date?: string): Promise<FinalScheduleData> => {
    console.log('getFinalScheduleData: Starting for tournament', tournamentId);

    // 大会情報を取得
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('name, end_date')
      .eq('id', tournamentId)
      .single();

    if (tournamentError) {
      console.error('Failed to fetch tournament:', tournamentError);
    }
    console.log('Tournament:', tournament);

    // グループ順位表を取得
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('id');

    if (groupsError) {
      console.error('Failed to fetch groups:', groupsError);
    }
    console.log('Groups:', groups?.length || 0, groups);

    const standings: GroupStanding[] = [];
    for (const group of groups || []) {
      const { data: groupStandings, error: standingsError } = await supabase
        .from('standings')
        .select('*, team:teams(id, name, short_name, group_id)')
        .eq('tournament_id', tournamentId)
        .eq('group_id', group.id)
        .order('rank');

      if (standingsError) {
        console.error(`Failed to fetch standings for group ${group.id}:`, standingsError);
      }
      console.log(`Group ${group.id} standings:`, groupStandings?.length || 0);

      standings.push({
        groupId: group.id,
        standings: groupStandings || [],
      });
    }

    // 決勝トーナメントの試合を取得
    let tournamentQuery = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, group_id),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, group_id),
        venue:venues(name)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['semifinal', 'third_place', 'final'])
      .order('match_time');

    if (date) {
      tournamentQuery = tournamentQuery.eq('match_date', date);
    }

    const { data: tournamentMatches } = await tournamentQuery;

    // 研修試合を取得
    let trainingQuery = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, group_id),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, group_id),
        venue:venues(name)
      `)
      .eq('tournament_id', tournamentId)
      .eq('stage', 'training')
      .order('venue_id')
      .order('match_time');

    if (date) {
      trainingQuery = trainingQuery.eq('match_date', date);
    }

    const { data: trainingMatches } = await trainingQuery;

    // グループステージの試合を取得（星取表用）
    const { data: groupMatches, error: groupMatchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, group_id),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, group_id),
        venue:venues(name)
      `)
      .eq('tournament_id', tournamentId)
      .eq('stage', 'preliminary')
      .eq('status', 'completed')
      .order('group_id')
      .order('match_time');

    if (groupMatchError) {
      console.error('Failed to fetch group matches:', groupMatchError);
    }
    console.log('Group matches:', groupMatches?.length || 0);

    // 優秀選手データを取得
    const { data: outstandingPlayersData, error: playersError } = await supabase
      .from('outstanding_players')
      .select(`
        *,
        team:teams(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .order('award_type')
      .order('display_order');

    if (playersError) {
      console.error('Failed to fetch outstanding players:', playersError);
    }

    const outstandingPlayers: OutstandingPlayerData[] = (outstandingPlayersData || []).map((p: any) => ({
      id: p.id,
      awardType: p.award_type,
      playerName: p.player_name,
      playerNumber: p.player_number,
      teamName: p.team_name || p.team?.short_name || p.team?.name,
      displayOrder: p.display_order,
    }));

    return {
      tournamentName: tournament?.name || '浦和カップ',
      date: date || tournament?.end_date || '',
      standings,
      tournament: tournamentMatches || [],
      training: trainingMatches || [],
      groupMatches: groupMatches || [],
      outstandingPlayers,
    };
  },

  // 最終日結果Excel出力（リッチデータ）
  downloadFinalResultExcelRich: async (tournamentId: number): Promise<Blob> => {
    const data = await reportApi.getFinalResultData(tournamentId);

    const wb = XLSX.utils.book_new();

    // シート1: 最終順位
    const rankingData = [
      ['最終順位'],
      ['順位', 'チーム名'],
      ['優勝', data.ranking[0]?.name || ''],
      ['準優勝', data.ranking[1]?.name || ''],
      ['第3位', data.ranking[2]?.name || ''],
      ['第4位', data.ranking[3]?.name || ''],
    ];
    const wsRanking = XLSX.utils.aoa_to_sheet(rankingData);
    wsRanking['!cols'] = [{ wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsRanking, '最終順位');

    // シート2: 決勝トーナメント
    const tournamentData: (string | number)[][] = [
      ['決勝トーナメント結果'],
      ['種別', '時間', 'ホーム', '前半', '後半', '合計', 'PK', 'アウェイ', '前半', '後半', '合計', 'PK'],
    ];
    for (const m of data.tournament) {
      const stageName = m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : '準決勝';
      tournamentData.push([
        stageName,
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '',
        m.home_score_half1 ?? '',
        m.home_score_half2 ?? '',
        m.home_score_total ?? '',
        m.home_pk ?? '',
        m.away_team?.short_name || m.away_team?.name || '',
        m.away_score_half1 ?? '',
        m.away_score_half2 ?? '',
        m.away_score_total ?? '',
        m.away_pk ?? '',
      ]);
    }
    const wsTournament = XLSX.utils.aoa_to_sheet(tournamentData);
    XLSX.utils.book_append_sheet(wb, wsTournament, '決勝トーナメント');

    // シート3: 研修試合
    const trainingData: (string | number)[][] = [
      ['研修試合結果'],
      ['会場', '時間', 'ホーム', '前半', '後半', '合計', 'アウェイ', '前半', '後半', '合計'],
    ];
    for (const m of data.training) {
      trainingData.push([
        m.venue?.name || '',
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '',
        m.home_score_half1 ?? '',
        m.home_score_half2 ?? '',
        m.home_score_total ?? '',
        m.away_team?.short_name || m.away_team?.name || '',
        m.away_score_half1 ?? '',
        m.away_score_half2 ?? '',
        m.away_score_total ?? '',
      ]);
    }
    const wsTraining = XLSX.utils.aoa_to_sheet(trainingData);
    XLSX.utils.book_append_sheet(wb, wsTraining, '研修試合');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終日組み合わせExcel出力（リッチデータ）
  downloadFinalScheduleExcelRich: async (tournamentId: number, date?: string): Promise<Blob> => {
    const data = await reportApi.getFinalScheduleData(tournamentId, date);

    const wb = XLSX.utils.book_new();

    // シート1: 順位表
    for (const group of data.standings) {
      const standingsData: (string | number)[][] = [
        [`グループ${group.groupId} 順位表`],
        ['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点'],
      ];
      for (const s of group.standings) {
        standingsData.push([
          s.rank,
          s.team?.short_name || s.team?.name || '',
          s.played ?? 0,
          s.won ?? 0,
          s.drawn ?? 0,
          s.lost ?? 0,
          s.goals_for ?? 0,
          s.goals_against ?? 0,
          s.goal_difference ?? 0,
          s.points ?? 0,
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(standingsData);
      XLSX.utils.book_append_sheet(wb, ws, `グループ${group.groupId}`);
    }

    // シート: 決勝トーナメント
    const tournamentData: (string | number)[][] = [
      ['決勝トーナメント組み合わせ'],
      ['種別', '時間', '会場', 'ホーム', '', 'アウェイ'],
    ];
    for (const m of data.tournament) {
      const stageName = m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : '準決勝';
      tournamentData.push([
        stageName,
        m.match_time?.slice(0, 5) || '',
        m.venue?.name || '',
        m.home_team?.short_name || m.home_team?.name || m.home_seed || '未定',
        'vs',
        m.away_team?.short_name || m.away_team?.name || m.away_seed || '未定',
      ]);
    }
    const wsTournament = XLSX.utils.aoa_to_sheet(tournamentData);
    XLSX.utils.book_append_sheet(wb, wsTournament, '決勝トーナメント');

    // シート: 研修試合
    const trainingData: (string | number)[][] = [
      ['研修試合組み合わせ'],
      ['会場', '時間', 'ホーム', 'シード', '', 'アウェイ', 'シード'],
    ];
    for (const m of data.training) {
      const homeSeed = m.home_team ? `${m.home_team.group_id || ''}` : '';
      const awaySeed = m.away_team ? `${m.away_team.group_id || ''}` : '';
      trainingData.push([
        m.venue?.name || '',
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '未定',
        homeSeed,
        'vs',
        m.away_team?.short_name || m.away_team?.name || '未定',
        awaySeed,
      ]);
    }
    const wsTraining = XLSX.utils.aoa_to_sheet(trainingData);
    XLSX.utils.book_append_sheet(wb, wsTraining, '研修試合');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },
};
