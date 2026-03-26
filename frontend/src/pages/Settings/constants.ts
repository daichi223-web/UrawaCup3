// src/pages/Settings/constants.ts
/**
 * Settings ページの定数
 */

export const GROUP_COLORS: Record<string, string> = {
  A: 'bg-red-100 text-red-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-green-100 text-green-800',
  D: 'bg-yellow-100 text-yellow-800',
}

export const GROUPS = ['A', 'B', 'C', 'D'] as const

export const DEFAULT_TOURNAMENT_FORM = {
  name: '',
  year: new Date().getFullYear(),
  gameMinutes: 20,
  intervalMinutes: 5,
  useGroupSystem: true,
  teamsPerGroup: 6,
  matchesPerTeam: 4,
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  description: '',
  isSingleLeague: false,
  singleLeagueTeamCount: 8,
  singleLeagueMatchesPerTeam: 7,
  finalsStartTime: '09:00',
  finalsDay: 2,
  preliminaryStartTime: '09:00',
  finalsMatchDuration: 25,
  finalsIntervalMinutes: 5,
  dayEndTime: '17:00',
  day2StartTime: '09:00',
  day2EndTime: '17:00',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  enableLunchBreak: true,
  venue_per_group: true,
}

export const DEFAULT_VENUE_FORM = {
  name: '',
  address: '',
  capacity: null,
  groundName: '',
  groundNameDay2: '',
  notes: '',
  assigned_group: '',
  forPreliminary: true,
  forFinalDay: false,
  isFinalsVenue: false,
  isMixedUse: false,
  finalsMatchCount: 1,
}

export const DEFAULT_ADD_VENUE_FORM = {
  name: '',
  address: '',
  notes: '',
  capacity: null,
}

export const DEFAULT_NEW_TOURNAMENT_FORM = {
  name: '',
  year: new Date().getFullYear(),
  description: '',
}
