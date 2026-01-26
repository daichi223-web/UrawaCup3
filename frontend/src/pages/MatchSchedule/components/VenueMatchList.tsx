// src/pages/MatchSchedule/components/VenueMatchList.tsx
// 通常の試合一覧（会場別カード表示）
import DraggableMatchList from '@/components/DraggableMatchList'
import { GROUP_COLORS } from '../constants'
import type { MatchWithDetails, VenueInfo, TeamInfo } from '../types'

interface VenueMatchListProps {
  filteredMatches: MatchWithDetails[]
  venues: VenueInfo[]
  allTeams: TeamInfo[]
  useGroupSystem: boolean
  consecutiveMatchTeams: Set<number>
  onSwapTeams: (matchId: number, homeTeamId: number, awayTeamId: number) => Promise<void>
}

export function VenueMatchList({
  filteredMatches,
  venues,
  allTeams,
  useGroupSystem,
  consecutiveMatchTeams,
  onSwapTeams,
}: VenueMatchListProps) {
  return (
    <div className="space-y-6">
      {venues.map((venue, venueIndex) => {
        const venueMatches = filteredMatches.filter(m => (m.venueId || m.venue_id) === venue.id)
        if (venueMatches.length === 0) return null

        const venueGroupId = String.fromCharCode(65 + venueIndex)
        const colors = GROUP_COLORS[venueGroupId] || GROUP_COLORS.default

        return (
          <div key={venue.id} className={`rounded-lg border-2 ${colors.border} ${colors.bg} overflow-hidden`}>
            <div className={`px-4 py-2 ${colors.header} font-semibold flex items-center gap-2`}>
              <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
              <span>{venue.name}</span>
              {useGroupSystem && venueGroupId && <span className="text-xs opacity-75">({venueGroupId}グループ)</span>}
              <span className="ml-auto text-xs font-normal opacity-75">{venueMatches.length}試合</span>
            </div>
            <div className="p-3">
              <DraggableMatchList
                matches={venueMatches}
                onSwapTeams={onSwapTeams}
                title=""
                emptyMessage="試合がありません"
                consecutiveMatchTeams={consecutiveMatchTeams}
                teams={useGroupSystem ? allTeams.filter(t => t.groupId === venueGroupId) : allTeams}
                enableConstraintCheck
                venueGroupId={venueGroupId}
              />
            </div>
          </div>
        )
      })}
      <div className="text-xs text-gray-500 text-center">
        ※ チームをクリックして組み合わせを変更できます。⚠マークは連戦チームです。
      </div>
    </div>
  )
}

export default VenueMatchList
