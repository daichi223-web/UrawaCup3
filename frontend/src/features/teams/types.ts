// src/features/teams/types.ts
// チーム型定義

export type TeamType = 'local' | 'invited';

export interface Team {
  id: number;
  tournamentId: number;
  name: string;
  shortName: string;
  teamType: TeamType;
  isVenueHost: boolean;
  groupId: string;
  groupOrder: number;
  prefecture: string;
  region?: string | null;
  leagueId?: string | number;
  league_id?: string | number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  tournamentId: number;
  name: string;
  shortName?: string;
  teamType: TeamType;
  isVenueHost?: boolean;
  groupId?: string;
  groupOrder?: number;
  prefecture?: string;
  region?: string;
  leagueId?: string | number;
}

export interface UpdateTeamInput {
  name?: string;
  shortName?: string;
  teamType?: TeamType;
  isVenueHost?: boolean;
  groupId?: string;
  groupOrder?: number;
  prefecture?: string;
  region?: string;
  leagueId?: string | number;
}

export interface TeamWithPlayers extends Team {
  players: {
    id: number;
    number: number;
    name: string;
  }[];
}
