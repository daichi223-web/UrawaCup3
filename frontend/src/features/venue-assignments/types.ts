// src/features/venue-assignments/types.ts
// 会場割り当て型定義

/** 会場割り当て（スキーマ準拠） */
export interface VenueAssignment {
  id: number;
  tournamentId: number;
  venueId: number;
  teamId: number;
  matchDay: number; // 試合日（1=1日目, 2=2日目, ...）
  slotOrder: number; // 会場内の順番（1, 2, 3, 4...）
  createdAt: string;
  updatedAt: string;

  // 結合データ
  venue?: { id: number; name: string; shortName?: string };
  team?: { id: number; name: string; shortName?: string };
}

/** 会場割り当て作成入力 */
export interface CreateVenueAssignmentInput {
  tournamentId: number;
  venueId: number;
  teamId: number;
  matchDay: number;
  slotOrder: number;
}

/** 会場割り当て更新入力 */
export interface UpdateVenueAssignmentInput {
  id: number;
  venueId?: number;
  teamId?: number;
  matchDay?: number;
  slotOrder?: number;
}

/** 会場割り当て自動生成入力 */
export interface AutoGenerateVenueAssignmentsInput {
  tournamentId: number;
  matchDay: number;
  strategy?: 'balanced' | 'group_based' | 'random';
}

/** 会場割り当て自動生成結果 */
export interface AutoGenerateResult {
  created: number;
  updated: number;
  assignments: VenueAssignment[];
}
