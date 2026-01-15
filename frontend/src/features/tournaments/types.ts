// src/features/tournaments/types.ts
// 大会管理型定義

export type QualificationRule = 'group_based' | 'overall_ranking';

export interface Tournament {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
  matchDuration: number; // 試合時間（分）
  intervalMinutes: number; // インターバル（分）
  groupCount: number;
  teamsPerGroup: number;
  advancingTeams: number; // 決勝T進出チーム数（1-2）
  qualificationRule: QualificationRule; // 決勝進出ルール
  description: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  // 新フォーマット対応フィールド
  venueCount?: number; // 会場数
  teamsPerVenue?: number; // 会場あたりのチーム数
  matchesPerTeamPerDay?: number; // 1日あたりの各チームの試合数
  preliminaryDays?: number; // 予選日数
  bMatchSlots?: number[]; // B戦スロット（例: [3, 6]）
  useGroupSystem?: boolean; // グループ制を使用するか
}

export type TournamentStatus = 'draft' | 'active' | 'completed';

export interface CreateTournamentInput {
  name: string;
  shortName?: string;
  edition: number;
  year: number;
  startDate: string;
  endDate: string;
  matchDuration?: number;
  halfDuration?: number;
  intervalMinutes?: number;
}

export interface UpdateTournamentInput {
  id: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: TournamentStatus;
  matchDuration?: number;
  intervalMinutes?: number;
  description?: string;
  version: number;
}

export interface TournamentGroup {
  id: string;
  tournamentId: number;
  name: string;
  venueId: number | null;
  teamCount: number;
}

export interface TournamentSettings {
  tournamentId: number;
  matchDuration: number;
  intervalMinutes: number;
  halfTimeMinutes: number;
  preliminaryRounds: number;
  tiebreaker: TiebreakerRule[];
}

export type TiebreakerRule =
  | 'points'
  | 'goal_difference'
  | 'goals_scored'
  | 'head_to_head'
  | 'lottery';

export interface GenerateScheduleInput {
  tournamentId: number;
  startTime: string;
  matchesPerDay: number;
}

export interface GenerateFinalScheduleInput {
  tournamentId: number;
  finalDate: string;
  format: 'tournament' | 'ranking_league';
}

// VenueAssignment型は venue-assignments/types.ts で定義
// 重複を避けるため、ここでは再エクスポートのみ
export type { VenueAssignment } from '@/features/venue-assignments/types';
