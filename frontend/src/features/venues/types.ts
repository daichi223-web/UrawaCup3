// src/features/venues/types.ts
// 会場管理型定義

export interface Venue {
  id: number;
  tournamentId: number;
  name: string;
  shortName: string;
  address: string | null;
  pitchCount: number; // コート数
  hostTeamId: number | null; // 会場担当チーム（旧フィールド）
  managerTeamId: number | null; // 会場責任チームID
  groupId: string | null;
  forPreliminary: boolean; // 予選リーグ会場
  forFinalDay: boolean; // 最終日の順位リーグ会場
  isFinalsVenue: boolean; // 決勝トーナメント会場
  isMixedUse: boolean; // 混合会場フラグ（決勝＋研修を同一会場で行う）
  finalsMatchCount: number; // 混合会場での決勝試合数（デフォルト: 1）
  createdAt: string;
  updatedAt: string;

  // snake_case aliases (from API response)
  group_id?: string;
  for_preliminary?: boolean;
  for_final_day?: boolean;
  is_finals_venue?: boolean;
  is_mixed_use?: boolean;
  finals_match_count?: number;
  max_matches_per_day?: number;
  maxMatchesPerDay?: number;
  manager_team_id?: number | null;

  // 結合データ
  hostTeam?: { id: number; name: string };
  managerTeam?: { id: number; name: string; shortName?: string };
}

export interface CreateVenueInput {
  tournamentId: number;
  name: string;
  shortName: string;
  address?: string;
  pitchCount?: number;
  hostTeamId?: number;
  groupId?: string;
  forPreliminary?: boolean;
  forFinalDay?: boolean;
  isFinalsVenue?: boolean;
  isMixedUse?: boolean;
  finalsMatchCount?: number;
}

export interface UpdateVenueInput {
  id: number;
  name?: string;
  shortName?: string;
  address?: string;
  pitchCount?: number;
  hostTeamId?: number;
  managerTeamId?: number | null;
  groupId?: string;
  group_id?: string;
  max_matches_per_day?: number;
  for_preliminary?: boolean;
  for_final_day?: boolean;
  is_finals_venue?: boolean;
  is_mixed_use?: boolean;
  finals_match_count?: number;
}

export interface VenueStaff {
  id: number;
  venueId: number;
  userId: number;
  role: 'manager' | 'staff';
  createdAt: string;

  // 結合データ
  user?: { id: number; username: string; name: string };
}

export interface AssignVenueStaffInput {
  venueId: number;
  userId: number;
  role: 'manager' | 'staff';
}

export interface VenueSchedule {
  venueId: number;
  date: string;
  matches: {
    id: number;
    startTime: string;
    endTime: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
  }[];
}
