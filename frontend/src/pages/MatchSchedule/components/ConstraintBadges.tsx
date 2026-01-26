// src/pages/MatchSchedule/components/ConstraintBadges.tsx
import type { MatchWithDetails } from '../types'

interface ConstraintBadgesProps {
  consecutiveMatchTeams: Set<number>
  localVsLocalMatches: MatchWithDetails[]
  sameRegionMatches: MatchWithDetails[]
  sameLeagueMatches: MatchWithDetails[]
  day1RepeatPairs: MatchWithDetails[]
}

export function ConstraintBadges({
  consecutiveMatchTeams,
  localVsLocalMatches,
  sameRegionMatches,
  sameLeagueMatches,
  day1RepeatPairs,
}: ConstraintBadgesProps) {
  return (
    <>
      {consecutiveMatchTeams.size > 0 && (
        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
          ⚠ 連戦: {consecutiveMatchTeams.size}チーム
        </span>
      )}
      {localVsLocalMatches.length > 0 && (
        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
          ⚠ 地元同士: {localVsLocalMatches.length}試合
        </span>
      )}
      {sameRegionMatches.length > 0 && (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
          ⚠ 同地区: {sameRegionMatches.length}試合
        </span>
      )}
      {sameLeagueMatches.length > 0 && (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
          ⚠ 同リーグ: {sameLeagueMatches.length}試合
        </span>
      )}
      {day1RepeatPairs.length > 0 && (
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
          ⚠ Day1再戦: {day1RepeatPairs.length}試合
        </span>
      )}
    </>
  )
}

export default ConstraintBadges
