// src/lib/scheduleGenerator/utils/venue.ts
/**
 * 会場関連のユーティリティ
 */

import type { TeamInfo, Venue } from '../types'
import { GROUPS, GROUP_VENUES } from '../constants'

/**
 * 会場IDを取得（グループIDから）
 */
export function getVenueForGroup(venues: Venue[], groupId: string): Venue | undefined {
  // まずgroupIdまたはgroup_id（snake_case）が一致する会場を探す
  let venue = venues.find(v => (v.groupId || v.group_id) === groupId)
  if (venue) {
    console.log(`[Schedule] グループ${groupId}の会場: ${venue.name} (group_id=${venue.group_id || venue.groupId})`)
    return venue
  }

  // グループ名を含む会場を探す
  const groupVenueName = GROUP_VENUES[groupId]
  if (groupVenueName) {
    venue = venues.find(v => v.name.includes(groupVenueName.replace('高G', '')))
    if (venue) {
      console.log(`[Schedule] グループ${groupId}の会場（名前一致）: ${venue.name}`)
      return venue
    }
  }

  // それでも見つからない場合はインデックスで割り当て
  const groupIndex = GROUPS.indexOf(groupId)
  if (groupIndex >= 0 && groupIndex < venues.length) {
    venue = venues[groupIndex]
    if (venue) {
      console.log(`[Schedule] グループ${groupId}の会場（インデックス）: ${venue.name}`)
    }
  }

  // デバッグ: 見つからない場合
  if (!venue) {
    console.log(`[Schedule] グループ${groupId}の会場が見つかりません。会場一覧:`, venues.map(v => ({
      id: v.id,
      name: v.name,
      groupId: v.groupId,
      group_id: v.group_id
    })))
  }

  return venue
}

/**
 * 審判担当チームを取得（その枠で試合をしていないチーム）
 */
export function getRefereeTeams(
  groupTeams: TeamInfo[],
  homeTeamSeed: number,
  awayTeamSeed: number
): number[] {
  return groupTeams
    .filter(t => t.seedNumber !== homeTeamSeed && t.seedNumber !== awayTeamSeed)
    .map(t => t.id)
}
