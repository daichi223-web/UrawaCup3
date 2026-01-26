// src/pages/Reports/types.ts

export interface MatchApiData {
  id: number;
  match_date: string;
  match_time: string;
  venue_id: number;
  home_team?: { name: string; short_name?: string };
  away_team?: { name: string; short_name?: string };
  home_score_total?: number | null;
  away_score_total?: number | null;
  status: string;
}

export interface MatchPreview {
  id: number;
  match_time: string;
  home_team: { name: string; short_name?: string };
  away_team: { name: string; short_name?: string };
  home_score?: number | null;
  away_score?: number | null;
  status: string;
}

export interface ReportPreviewData {
  date: string;
  venue: { id: number; name: string } | null;
  matches: MatchPreview[];
}

export interface SenderFormState {
  senderOrganization: string;
  senderName: string;
  senderContact: string;
}

export interface DateOptions {
  map: Record<string, string>;
  labels: Record<string, string>;
}
