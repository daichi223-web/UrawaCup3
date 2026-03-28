// src/features/reports/api.ts
// 報告書API呼び出し - Supabase版
//
// =====================================================
// PDF生成アーキテクチャ
// =====================================================
// 【正規】バックエンドAPI (Python ReportLab)
//   - URL: VITE_CORE_API_URL/daily-report
//   - 日本語フォント対応 (YuGothic/MSGothic)
//   - 会場ごと1ページ、自動縮小対応
//
// 【緊急用】フロントエンドフォールバック (jsPDF)
//   - バックエンドAPI障害時のみ使用
//   - 制限: 日本語が文字化けする (Helveticaフォント)
//   - UI警告: 「簡易版PDF」と表示
// =====================================================
import { supabase } from '@/lib/supabase';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
applyPlugin(jsPDF);
import type { ReportGenerateInput, ReportJob, ReportRecipient, SenderSettings, SenderSettingsUpdate } from './types';

// バックエンドAPI URL（PDF生成・日程生成サーバー）
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || '';
const IS_DEV = import.meta.env.DEV;

// jsPDF autotable型定義
interface AutoTableOptions {
  startY?: number
  head?: (string | number)[][]
  body?: (string | number | null | undefined)[][]
  styles?: { fontSize?: number; cellPadding?: number }
  headStyles?: { fillColor?: number[] }
  columnStyles?: Record<number, { cellWidth?: number }>
  margin?: { left?: number }
}

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: AutoTableOptions) => jsPDF
  lastAutoTable?: { finalY: number }
}

// ================================================
// 型定義
// ================================================

// 得点者情報（PDF/Excel出力用）
interface Scorer {
  time: string
  team: string
  name: string
  assist?: string
}

// 会場別試合データ（PDF出力用）
interface VenueMatchData {
  homeTeam: { name: string }
  awayTeam: { name: string }
  kickoff: string
  homeScore1H: number | string
  homeScore2H: number | string
  awayScore1H: number | string
  awayScore2H: number | string
  scorers: Scorer[]
}

// 優秀選手APIレスポンス
interface OutstandingPlayerApiResponse {
  id: number
  award_type: 'mvp' | 'outstanding'
  player_name: string
  player_number?: number
  team_name?: string
  display_order: number
  team?: { name: string; short_name?: string }
}

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
  status?: string
  match_time?: string
  match_date?: string
  venue?: { name: string }
  venue_id?: number
  home_team?: Team
  away_team?: Team
  home_team_id?: number
  away_team_id?: number
  home_score_half1?: number | null
  home_score_half2?: number | null
  away_score_half1?: number | null
  away_score_half2?: number | null
  home_score_total?: number | null
  away_score_total?: number | null
  home_pk?: number | null
  away_pk?: number | null
  has_penalty_shootout?: boolean
  result?: string
  goals?: Goal[]
  home_seed?: string | null
  away_seed?: string | null
}

// Type for tournament query
interface TournamentInfo {
  name?: string
  start_date?: string
  end_date?: string
}

// Type for sender settings query
interface SenderSettingsQuery {
  recipient?: string
  sender_name?: string
  contact?: string
}

// Type for group query
interface GroupInfo {
  id: string
  name?: string
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
  /** グループステージの試合結果（成績表用） */
  groupMatches: Match[]
  /** 優秀選手 */
  outstandingPlayers: OutstandingPlayerData[]
}

export const reportApi = {
  // 報告書生成開始（Supabase Edge Functionが必要）
  generate: async (_data: ReportGenerateInput): Promise<{ jobId: string }> => {
    console.warn('Report generation requires Supabase Edge Function');
    return { jobId: 'not-implemented' };
  },

  // 生成ジョブ状態確認
  getJobStatus: async (_jobId: string): Promise<ReportJob> => {
    return {
      id: _jobId,
      status: 'completed',
      progress: 100,
      createdAt: new Date().toISOString(),
    };
  },

  // 報告書ダウンロード（Supabase Edge Functionが必要）
  download: async (_jobId: string): Promise<Blob> => {
    console.warn('Report download requires Supabase Edge Function');
    return new Blob(['Report generation not implemented'], { type: 'text/plain' });
  },

  // 日別報告書PDFダウンロード（バックエンドAPI経由）
  // 戻り値: blob = PDFデータ, usedFallback = フォールバック使用フラグ
  downloadPdf: async (params: { tournamentId: number; date: string; venueId?: number; format?: string }): Promise<{ blob: Blob; usedFallback: boolean }> => {
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

    const { data: matchesData, error } = await query;
    if (error) throw error;

    const matches = matchesData as Match[] | null;

    // デバッグ: 試合データと会場情報を確認
    IS_DEV && console.log('[downloadPdf] Matches count:', matches?.length || 0);
    if (matches && matches.length > 0) {
      IS_DEV && console.log('[downloadPdf] First match venue data:', {
        venue_id: matches[0].venue_id,
        venue: matches[0].venue,
        raw: JSON.stringify(matches[0]).substring(0, 500)
      });
    }

    // 大会情報を取得
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('name, start_date, end_date')
      .eq('id', params.tournamentId)
      .single();

    const tournament = tournamentData as TournamentInfo | null;

    // 発信元設定を取得
    const { data: senderData } = await supabase
      .from('sender_settings')
      .select('*')
      .eq('tournament_id', params.tournamentId)
      .single();

    const senderSettings = senderData as SenderSettingsQuery | null;

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
    const matchesByVenue: Record<string, VenueMatchData[]> = {};
    for (const match of matches || []) {
      const venueName = match.venue?.name || '未定';
      if (!matchesByVenue[venueName]) {
        matchesByVenue[venueName] = [];
      }

      // 得点者リストを作成
      const scorers: Scorer[] = (match.goals || [])
        .sort((a: Goal, b: Goal) => (a.minute || 0) - (b.minute || 0))
        .map((goal: Goal & { assist_player_name?: string }) => ({
          time: String(goal.minute || ''),
          team: goal.team_id === match.home_team_id
            ? (match.home_team?.short_name || match.home_team?.name || '')
            : (match.away_team?.short_name || match.away_team?.name || ''),
          name: goal.player_name || '',
          assist: goal.assist_player_name || undefined,
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
    IS_DEV && console.log('[downloadPdf] Venues found:', Object.keys(matchesByVenue));
    IS_DEV && console.log('[downloadPdf] Matches per venue:', Object.fromEntries(
      Object.entries(matchesByVenue).map(([k, v]) => [k, v.length])
    ));

    // バックエンドAPIを呼び出し（未設定時はフォールバックへ）
    if (!CORE_API_URL) {
      console.warn('[downloadPdf] VITE_CORE_API_URL not set, using local fallback');
    }
    try {
      if (!CORE_API_URL) throw new Error('CORE_API_URL not configured');
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
        IS_DEV && console.log('[downloadPdf] Backend API success');
        return { blob: await response.blob(), usedFallback: false };
      }
      console.warn('[downloadPdf] Backend API failed (status:', response.status, '), falling back to local generation');
    } catch (e) {
      console.warn('[downloadPdf] Backend API error, falling back to local generation:', e);
    }

    // フォールバック: ローカルでPDF生成（会場ごとに1ページ）
    // ⚠️ 制限事項:
    // - Helveticaフォントのため日本語が正しく表示されない
    // - バックエンドAPI (ReportLab + 日本語フォント) が正規の出力先
    // - このフォールバックはバックエンド障害時の緊急用
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
      const tableData = venueMatches.map((m: VenueMatchData) => {
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
          ? (m.homeScore1H as number) + (m.homeScore2H as number)
          : '';
        const totalAway = hasAwayScore
          ? (m.awayScore1H as number) + (m.awayScore2H as number)
          : '';

        // 得点者リスト（アシスト付き）
        const scorersList = (m.scorers || [])
          .map((s: Scorer) => {
            let text = `${s.time}' ${s.name}`;
            if ((s as Scorer & { assist?: string }).assist) {
              text += `(A:${(s as Scorer & { assist?: string }).assist})`;
            }
            return text;
          })
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

      // 得点者が多い試合があるかチェックしてフォントサイズを調整
      const maxScorersLen = Math.max(...tableData.map((row: string[]) => (row[6] || '').length), 0);
      const scorerFontSize = maxScorersLen > 80 ? 5 : maxScorersLen > 50 ? 6 : maxScorersLen > 30 ? 7 : 8;

      (doc as JsPDFWithAutoTable).autoTable({
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
          6: { cellWidth: 55, fontSize: scorerFontSize },  // 得点者（自動縮小）
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

    IS_DEV && console.log('[downloadPdf] Using fallback PDF generation');
    return { blob: doc.output('blob'), usedFallback: true };
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

    const { data: matchesData, error } = await query;
    if (error) throw error;

    const matches = matchesData as Match[] | null;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('試合結果');

    worksheet.addRow(['時間', 'ホーム', 'スコア', 'アウェイ', '会場', '状態']);
    for (const m of matches || []) {
      worksheet.addRow([
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '未定',
        m.status === 'completed' ? `${m.home_score_total ?? 0} - ${m.away_score_total ?? 0}` : 'vs',
        m.away_team?.short_name || m.away_team?.name || '未定',
        m.venue?.name || '',
        m.status === 'completed' ? '終了' : m.status === 'in_progress' ? '試合中' : '予定'
      ]);
    }

    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 10;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 8;

    const buffer = await workbook.xlsx.writeBuffer();
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
      } as never)
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
      .update(updateData as never)
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

  // グループ順位表PDFダウンロード（一グループ制対応・バックエンド日本語PDF優先）
  downloadGroupStandings: async (params: { tournamentId: number; groupId?: string }): Promise<{ blob: Blob; usedFallback: boolean }> => {
    // 大会設定を確認
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('use_group_system')
      .eq('id', params.tournamentId)
      .single();

    const useGroupSystem = (tournamentData as { use_group_system?: boolean } | null)?.use_group_system !== false;

    // 順位データを取得
    interface StandingsGroup {
      groupId: string;
      groupName: string;
      standings: {
        rank: number;
        teamName: string;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
      }[];
    }

    const groups: StandingsGroup[] = [];

    if (useGroupSystem) {
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', params.tournamentId)
        .order('id');

      for (const group of (groupsData as GroupInfo[] | null) || []) {
        if (params.groupId && group.id !== params.groupId) continue;

        const { data: standingsData } = await supabase
          .from('standings')
          .select('*, team:teams(name, short_name)')
          .eq('tournament_id', params.tournamentId)
          .eq('group_id', group.id)
          .order('rank');

        groups.push({
          groupId: group.id,
          groupName: group.name || `${group.id}グループ`,
          standings: ((standingsData as Standing[] | null) || []).map(s => ({
            rank: s.rank,
            teamName: s.team?.short_name || s.team?.name || '',
            played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
            goalsFor: s.goals_for, goalsAgainst: s.goals_against,
            goalDifference: s.goal_difference, points: s.points,
          })),
        });
      }
    } else {
      const { data: standingsData } = await supabase
        .from('standings')
        .select('*, team:teams(name, short_name)')
        .eq('tournament_id', params.tournamentId)
        .order('rank');

      groups.push({
        groupId: 'all',
        groupName: '',
        standings: ((standingsData as Standing[] | null) || []).map(s => ({
          rank: s.rank,
          teamName: s.team?.short_name || s.team?.name || '',
          played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
          goalsFor: s.goals_for, goalsAgainst: s.goals_against,
          goalDifference: s.goal_difference, points: s.points,
        })),
      });
    }

    const pdfPayload = {
      title: '成績表',
      groups,
    };

    // バックエンドAPI（日本語フォント対応）を試行（未設定時はフォールバックへ）
    if (!CORE_API_URL) {
      console.warn('[downloadGroupStandings] VITE_CORE_API_URL not set, using local fallback');
    }
    try {
      if (!CORE_API_URL) throw new Error('CORE_API_URL not configured');
      const response = await fetch(`${CORE_API_URL}/standings-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfPayload),
      });

      if (response.ok) {
        IS_DEV && console.log('[downloadGroupStandings] Backend API success');
        return { blob: await response.blob(), usedFallback: false };
      }
      console.warn('[downloadGroupStandings] Backend API failed:', response.status);
    } catch (e) {
      console.warn('[downloadGroupStandings] Backend API error, falling back:', e);
    }

    // フォールバック: jsPDF（日本語文字化けあり）
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text(useGroupSystem ? 'Group Standings' : 'Standings', 14, 20);

    let yPos = 30;

    for (const group of groups) {
      if (group.groupName) {
        doc.setFontSize(12);
        doc.text(group.groupName, 14, yPos);
        yPos += 5;
      }

      const tableData = group.standings.map(s => [
        s.rank, s.teamName,
        s.played, s.won, s.drawn, s.lost,
        s.goalsFor, s.goalsAgainst, s.goalDifference, s.points
      ]);

      (doc as JsPDFWithAutoTable).autoTable({
        startY: yPos,
        head: [['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 14 },
      });

      yPos = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? yPos + 10;
      if (yPos > 250) { doc.addPage(); yPos = 20; }
    }

    return { blob: doc.output('blob'), usedFallback: true };
  },

  // グループ順位表Excelダウンロード（一グループ制対応）
  downloadGroupStandingsExcel: async (params: { tournamentId: number; groupId?: string }): Promise<Blob> => {
    // 大会設定を確認
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('use_group_system')
      .eq('id', params.tournamentId)
      .single();

    const useGroupSystem = (tournamentData as { use_group_system?: boolean } | null)?.use_group_system !== false;

    const workbook = new ExcelJS.Workbook();

    const addStandingsSheet = (sheetName: string, standings: Standing[] | null) => {
      const worksheet = workbook.addWorksheet(sheetName);
      worksheet.addRow(['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点']);
      for (const s of standings || []) {
        worksheet.addRow([
          s.rank,
          s.team?.short_name || s.team?.name || '',
          s.played, s.won, s.drawn, s.lost,
          s.goals_for, s.goals_against, s.goal_difference, s.points
        ]);
      }
      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 15;
      for (let i = 3; i <= 10; i++) worksheet.getColumn(i).width = 6;
    };

    if (useGroupSystem) {
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', params.tournamentId)
        .order('id');

      const groups = groupsData as GroupInfo[] | null;

      for (const group of groups || []) {
        if (params.groupId && group.id !== params.groupId) continue;

        const { data: standingsData } = await supabase
          .from('standings')
          .select('*, team:teams(name, short_name)')
          .eq('tournament_id', params.tournamentId)
          .eq('group_id', group.id)
          .order('rank');

        addStandingsSheet(group.name || group.id, standingsData as Standing[] | null);
      }
    } else {
      // 一グループ制
      const { data: standingsData } = await supabase
        .from('standings')
        .select('*, team:teams(name, short_name)')
        .eq('tournament_id', params.tournamentId)
        .order('rank');

      addStandingsSheet('成績表', standingsData as Standing[] | null);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終日組み合わせ表PDFダウンロード
  downloadFinalDaySchedule: async (params: { tournamentId: number; date: string }): Promise<Blob> => {
    const { data: matchesData, error } = await supabase
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

    const matches = matchesData as Match[] | null;

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

    (doc as JsPDFWithAutoTable).autoTable({
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
    const { data: matchesData, error } = await supabase
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

    const matches = matchesData as Match[] | null;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('最終日日程');

    worksheet.addRow(['時間', 'ステージ', 'ホーム', '', 'アウェイ', '会場']);
    for (const m of matches || []) {
      worksheet.addRow([
        m.match_time?.slice(0, 5) || '',
        m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : m.stage === 'semifinal' ? '準決勝' : '順位リーグ',
        m.home_team?.short_name || m.home_team?.name || m.home_seed || '未定',
        'vs',
        m.away_team?.short_name || m.away_team?.name || m.away_seed || '未定',
        m.venue?.name || ''
      ]);
    }

    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 12;
    worksheet.getColumn(3).width = 15;
    worksheet.getColumn(4).width = 4;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 15;

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終結果報告書PDFダウンロード
  downloadFinalResult: async (tournamentId: number): Promise<Blob> => {
    // 決勝・3位決定戦の結果を取得
    const { data: finalMatchesData } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['final', 'third_place'])
      .eq('status', 'completed');

    const finalMatches = (finalMatchesData || []) as Match[];

    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('最終結果報告書', 14, 20);

    let yPos = 35;
    doc.setFontSize(14);

    const finalMatch = finalMatches.find((m) => m.stage === 'final');
    const thirdMatch = finalMatches.find((m) => m.stage === 'third_place');

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
    const { data: finalMatchesData } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(name, short_name),
        away_team:teams!matches_away_team_id_fkey(name, short_name)
      `)
      .eq('tournament_id', tournamentId)
      .in('stage', ['final', 'third_place'])
      .eq('status', 'completed');

    const finalMatches = (finalMatchesData || []) as Match[];
    const finalMatch = finalMatches.find((m) => m.stage === 'final');
    const thirdMatch = finalMatches.find((m) => m.stage === 'third_place');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('最終結果');

    worksheet.addRow(['最終結果']);
    worksheet.addRow([]);

    if (finalMatch) {
      const winner = finalMatch.result === 'home_win' ? finalMatch.home_team : finalMatch.away_team;
      const runnerUp = finalMatch.result === 'home_win' ? finalMatch.away_team : finalMatch.home_team;

      worksheet.addRow(['優勝', winner?.name || '']);
      worksheet.addRow(['準優勝', runnerUp?.name || '']);
    }

    if (thirdMatch) {
      const third = thirdMatch.result === 'home_win' ? thirdMatch.home_team : thirdMatch.away_team;
      worksheet.addRow(['第3位', third?.name || '']);
    }

    worksheet.addRow([]);
    worksheet.addRow(['【決勝戦詳細】']);
    if (finalMatch) {
      worksheet.addRow(['', finalMatch.home_team?.name || '', finalMatch.home_score_total ?? 0, '-', finalMatch.away_score_total ?? 0, finalMatch.away_team?.name || '']);
    }

    const buffer = await workbook.xlsx.writeBuffer();
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
        sender_title: (data as Record<string, unknown>).senderTitle ?? '',
        sender_organization: data.senderOrganization,
      } as never)
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
    IS_DEV && console.log('getFinalResultData: Starting for tournament', tournamentId);

    // 大会情報を取得
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('name, end_date')
      .eq('id', tournamentId)
      .single();

    const tournament = tournamentData as TournamentInfo | null;

    if (tournamentError) {
      console.error('Failed to fetch tournament:', tournamentError);
    }
    IS_DEV && console.log('Tournament:', tournament);

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
    IS_DEV && console.log('Tournament matches:', tournamentMatches?.length || 0);

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
    IS_DEV && console.log('Training matches:', trainingMatches?.length || 0);

    // 順位を計算
    const ranking: (Team | null)[] = [null, null, null, null];
    const typedTournamentMatches = (tournamentMatches || []) as Match[];
    const finalMatch = typedTournamentMatches.find((m) => m.stage === 'final');
    const thirdMatch = typedTournamentMatches.find((m) => m.stage === 'third_place');

    IS_DEV && console.log('Final match:', finalMatch?.id, 'status:', finalMatch?.status);
    IS_DEV && console.log('Third match:', thirdMatch?.id, 'status:', thirdMatch?.status);

    if (finalMatch && finalMatch.status === 'completed') {
      const homeTotal = finalMatch.home_score_total ?? 0;
      const awayTotal = finalMatch.away_score_total ?? 0;
      let winner: Team | null = null;
      let runnerUp: Team | null = null;

      if (homeTotal > awayTotal) {
        winner = finalMatch.home_team ?? null;
        runnerUp = finalMatch.away_team ?? null;
      } else if (awayTotal > homeTotal) {
        winner = finalMatch.away_team ?? null;
        runnerUp = finalMatch.home_team ?? null;
      } else if (finalMatch.has_penalty_shootout) {
        // PK戦
        const homePK = finalMatch.home_pk ?? 0;
        const awayPK = finalMatch.away_pk ?? 0;
        if (homePK > awayPK) {
          winner = finalMatch.home_team ?? null;
          runnerUp = finalMatch.away_team ?? null;
        } else {
          winner = finalMatch.away_team ?? null;
          runnerUp = finalMatch.home_team ?? null;
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
        third = thirdMatch.home_team ?? null;
        fourth = thirdMatch.away_team ?? null;
      } else if (awayTotal > homeTotal) {
        third = thirdMatch.away_team ?? null;
        fourth = thirdMatch.home_team ?? null;
      } else if (thirdMatch.has_penalty_shootout) {
        const homePK = thirdMatch.home_pk ?? 0;
        const awayPK = thirdMatch.away_pk ?? 0;
        if (homePK > awayPK) {
          third = thirdMatch.home_team ?? null;
          fourth = thirdMatch.away_team ?? null;
        } else {
          third = thirdMatch.away_team ?? null;
          fourth = thirdMatch.home_team ?? null;
        }
      }

      ranking[2] = third;
      ranking[3] = fourth;
    }

    IS_DEV && console.log('Ranking:', ranking.map(r => r?.name || 'null'));

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
    IS_DEV && console.log('Outstanding players:', outstandingPlayersData?.length || 0);

    const outstandingPlayers: OutstandingPlayerData[] = (outstandingPlayersData || []).map((p: OutstandingPlayerApiResponse) => ({
      id: p.id,
      awardType: p.award_type,
      playerName: p.player_name,
      playerNumber: p.player_number,
      teamName: p.team_name || p.team?.short_name || p.team?.name,
      displayOrder: p.display_order,
    }));

    // outstandingPlayersからplayers配列を生成（後方互換性のため）
    const players: Player[] = (outstandingPlayersData || []).map((p: OutstandingPlayerApiResponse) => ({
      type: p.award_type === 'mvp' ? '最優秀選手' : '優秀選手',
      name: p.player_name,
      team: p.team_name || p.team?.short_name || p.team?.name || '',
    }));

    IS_DEV && console.log('Players for display:', players.length);

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
    IS_DEV && console.log('getFinalScheduleData: Starting for tournament', tournamentId);

    // 大会情報を取得
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('name, end_date, use_group_system')
      .eq('id', tournamentId)
      .single();

    const tournament = tournamentData as (TournamentInfo & { use_group_system?: boolean }) | null;

    if (tournamentError) {
      console.error('Failed to fetch tournament:', tournamentError);
    }
    IS_DEV && console.log('Tournament:', tournament);

    const useGroupSystem = tournament?.use_group_system !== false;

    // グループ順位表を取得
    const standings: GroupStanding[] = [];

    if (useGroupSystem) {
      // グループ制: グループごとに成績表を作成
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('id');

      const groups = groupsData as GroupInfo[] | null;

      if (groupsError) {
        console.error('Failed to fetch groups:', groupsError);
      }
      IS_DEV && console.log('Groups:', groups?.length || 0, groups);

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
        IS_DEV && console.log(`Group ${group.id} standings:`, groupStandings?.length || 0);

        standings.push({
          groupId: group.id,
          standings: groupStandings || [],
        });
      }
    } else {
      // 一グループ制: 全チームを一つの成績表にまとめる
      const { data: allStandings, error: standingsError } = await supabase
        .from('standings')
        .select('*, team:teams(id, name, short_name, group_id)')
        .eq('tournament_id', tournamentId)
        .order('rank');

      if (standingsError) {
        console.error('Failed to fetch standings:', standingsError);
      }
      IS_DEV && console.log('Single league standings:', allStandings?.length || 0);

      standings.push({
        groupId: 'all',
        standings: allStandings || [],
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

    // グループステージの試合を取得（成績表用）
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
    IS_DEV && console.log('Group matches:', groupMatches?.length || 0);

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

    const outstandingPlayers: OutstandingPlayerData[] = (outstandingPlayersData || []).map((p: OutstandingPlayerApiResponse) => ({
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

    const workbook = new ExcelJS.Workbook();

    // シート1: 最終順位
    const wsRanking = workbook.addWorksheet('最終順位');
    wsRanking.addRow(['最終順位']);
    wsRanking.addRow(['順位', 'チーム名']);
    wsRanking.addRow(['優勝', data.ranking[0]?.name || '']);
    wsRanking.addRow(['準優勝', data.ranking[1]?.name || '']);
    wsRanking.addRow(['第3位', data.ranking[2]?.name || '']);
    wsRanking.addRow(['第4位', data.ranking[3]?.name || '']);
    wsRanking.getColumn(1).width = 10;
    wsRanking.getColumn(2).width = 20;

    // シート2: 決勝トーナメント
    const wsTournament = workbook.addWorksheet('決勝トーナメント');
    wsTournament.addRow(['決勝トーナメント結果']);
    wsTournament.addRow(['種別', '時間', 'ホーム', '前半', '後半', '合計', 'PK', 'アウェイ', '前半', '後半', '合計', 'PK']);
    for (const m of data.tournament) {
      const stageName = m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : '準決勝';
      wsTournament.addRow([
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

    // シート3: 研修試合
    const wsTraining = workbook.addWorksheet('研修試合');
    wsTraining.addRow(['研修試合結果']);
    wsTraining.addRow(['会場', '時間', 'ホーム', '前半', '後半', '合計', 'アウェイ', '前半', '後半', '合計']);
    for (const m of data.training) {
      wsTraining.addRow([
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

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  // 最終日組み合わせExcel出力（リッチデータ）
  downloadFinalScheduleExcelRich: async (tournamentId: number, date?: string): Promise<Blob> => {
    const data = await reportApi.getFinalScheduleData(tournamentId, date);

    const workbook = new ExcelJS.Workbook();

    // シート1: 順位表
    for (const group of data.standings) {
      const ws = workbook.addWorksheet(`グループ${group.groupId}`);
      ws.addRow([`グループ${group.groupId} 順位表`]);
      ws.addRow(['順位', 'チーム', '試合', '勝', '分', '負', '得点', '失点', '得失', '勝点']);
      for (const s of group.standings) {
        ws.addRow([
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
    }

    // シート: 決勝トーナメント
    const wsTournament = workbook.addWorksheet('決勝トーナメント');
    wsTournament.addRow(['決勝トーナメント組み合わせ']);
    wsTournament.addRow(['種別', '時間', '会場', 'ホーム', '', 'アウェイ']);
    for (const m of data.tournament) {
      const stageName = m.stage === 'final' ? '決勝' : m.stage === 'third_place' ? '3位決定戦' : '準決勝';
      wsTournament.addRow([
        stageName,
        m.match_time?.slice(0, 5) || '',
        m.venue?.name || '',
        m.home_team?.short_name || m.home_team?.name || m.home_seed || '未定',
        'vs',
        m.away_team?.short_name || m.away_team?.name || m.away_seed || '未定',
      ]);
    }

    // シート: 研修試合
    const wsTraining = workbook.addWorksheet('研修試合');
    wsTraining.addRow(['研修試合組み合わせ']);
    wsTraining.addRow(['会場', '時間', 'ホーム', 'シード', '', 'アウェイ', 'シード']);
    for (const m of data.training) {
      const homeSeed = m.home_team ? `${m.home_team.group_id || ''}` : '';
      const awaySeed = m.away_team ? `${m.away_team.group_id || ''}` : '';
      wsTraining.addRow([
        m.venue?.name || '',
        m.match_time?.slice(0, 5) || '',
        m.home_team?.short_name || m.home_team?.name || '未定',
        homeSeed,
        'vs',
        m.away_team?.short_name || m.away_team?.name || '未定',
        awaySeed,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },
};
