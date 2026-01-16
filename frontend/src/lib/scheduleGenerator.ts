// src/lib/scheduleGenerator.ts
// 日程生成APIクライアント
// core/server.py の Python API を呼び出す

// Core API のベースURL（開発環境 or 本番環境）
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:8001';

interface TeamInput {
  id: number;
  name: string;
  group: string;
  rank: number;
  points?: number;
  goalDiff?: number;
  goalsFor?: number;
}

interface Venue {
  id: number;
  name: string;
}

interface ScheduleMatch {
  match_id: string;
  match_type: string;
  venue: string;
  kickoff: string;
  home_team_id: number | null;
  home_team_name: string;
  home_seed: string;
  away_team_id: number | null;
  away_team_name: string;
  away_seed: string;
  referee: string;
  warning: string;
}

interface ScheduleResult {
  success: boolean;
  tournament?: ScheduleMatch[];
  training?: ScheduleMatch[];
  warnings?: string[];
  config?: Record<string, unknown>;
}

interface PreliminaryMatch {
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  groupId: string;
  matchNumber: number;
  matchDate: string;
  matchTime: string;
  venueId: number;
  venueName: string;
  stage: string;
  status: string;
}

interface PreliminaryResult {
  success: boolean;
  matches: PreliminaryMatch[];
  total: number;
}

/**
 * 予選リーグの日程を生成
 * @param teams チーム一覧（group_id でグループを判定）
 * @param venues 会場一覧
 * @param matchDate 試合日（YYYY-MM-DD）
 * @param startTime 開始時刻（HH:MM）
 */
export async function generatePreliminarySchedule(
  teams: TeamInput[],
  venues: Venue[],
  matchDate: string,
  startTime: string = '09:30'
): Promise<PreliminaryResult> {
  const response = await fetch(`${CORE_API_URL}/generate-preliminary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teams: teams.map(t => ({
        id: t.id,
        name: t.name,
        group: t.group,
        rank: t.rank || 0,
        points: t.points || 0,
        goalDiff: t.goalDiff || 0,
        goalsFor: t.goalsFor || 0,
      })),
      venues: venues.map(v => ({ id: v.id, name: v.name })),
      matchDate,
      startTime,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 最終日組み合わせを生成（決勝トーナメント + 研修試合）
 * @param standings グループ別順位表 { A: [team1, team2, ...], B: [...], ... }
 * @param playedPairs 対戦済みペア [[team1Id, team2Id], ...]
 * @param config オプション設定
 */
export async function generateFinalDaySchedule(
  standings: Record<string, TeamInput[]>,
  playedPairs: [number, number][] = [],
  config?: {
    numGroups?: number;
    teamsPerGroup?: number;
    matchesPerTeam?: number;
    trainingVenues?: string[];
    kickoffTimes?: string[];
  }
): Promise<ScheduleResult> {
  const response = await fetch(`${CORE_API_URL}/generate-schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      standings: Object.fromEntries(
        Object.entries(standings).map(([group, teams]) => [
          group,
          teams.map(t => ({
            id: t.id,
            name: t.name,
            group: t.group,
            rank: t.rank,
            points: t.points || 0,
            goalDiff: t.goalDiff || 0,
            goalsFor: t.goalsFor || 0,
          })),
        ])
      ),
      playedPairs: playedPairs.map(([a, b]) => [a, b]),
      config,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Core API の接続確認
 */
export async function checkCoreApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CORE_API_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Core API の URL を取得
 */
export function getCoreApiUrl(): string {
  return CORE_API_URL;
}
