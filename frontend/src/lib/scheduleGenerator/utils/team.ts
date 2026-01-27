// src/lib/scheduleGenerator/utils/team.ts
/**
 * チーム関連のユーティリティ
 */

import type { TeamInfo } from '../types'

/**
 * チームをシード番号でソートしてグループ内の順位を取得
 */
export function getTeamSeedNumber(teams: TeamInfo[], teamId: number): number {
  const team = teams.find(t => t.id === teamId)
  return team?.seedNumber || 0
}

/**
 * グループ内のチームをシード番号順に取得
 */
export function getTeamsByGroup(teams: TeamInfo[], groupId: string): TeamInfo[] {
  return teams
    .filter(t => t.groupId === groupId)
    .sort((a, b) => a.seedNumber - b.seedNumber)
}
