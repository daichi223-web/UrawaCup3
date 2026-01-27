// src/pages/MatchSchedule/components/FinalsView.tsx
import DraggableMatchList from '@/components/DraggableMatchList'
import type { MatchWithDetails, VenueInfo, TeamInfo } from '../types'
import { VENUE_COLORS_LIST } from '../constants'

interface FinalsViewProps {
  finalsMatches: MatchWithDetails[]
  allMatches: MatchWithDetails[]
  venues: VenueInfo[]
  allTeams: TeamInfo[]
  hasTrainingMatches: boolean
  isUpdatingBracket: boolean
  onSwapTeams: (matchId: number, homeTeamId: number, awayTeamId: number) => Promise<void>
  onUpdateBracket: () => void
}

export function FinalsView({
  finalsMatches,
  allMatches,
  venues,
  allTeams,
  hasTrainingMatches,
  isUpdatingBracket,
  onSwapTeams,
  onUpdateBracket,
}: FinalsViewProps) {
  return (
    <div className="space-y-6">
      {/* 決勝トーナメント */}
      {finalsMatches.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">決勝トーナメント</h3>
            <button
              className="btn-secondary text-sm"
              onClick={onUpdateBracket}
              disabled={isUpdatingBracket}
            >
              {isUpdatingBracket ? '更新中...' : '組み合わせ更新'}
            </button>
          </div>
          {(() => {
            const matchesByVenue: Record<number, MatchWithDetails[]> = {}
            finalsMatches.forEach(m => {
              const vid = m.venueId || m.venue_id
              if (vid === undefined) return
              if (!matchesByVenue[vid]) matchesByVenue[vid] = []
              matchesByVenue[vid].push(m)
            })
            Object.values(matchesByVenue).forEach(matches => {
              matches.sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
            })
            const venueEntries = Object.entries(matchesByVenue)
            return (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {venueEntries.map(([venueId, matches]) => {
                  const venue = venues.find(v => v.id === Number(venueId))
                  return (
                    <div key={venueId} className="rounded border-2 border-blue-300 bg-blue-50 overflow-hidden">
                      <div className="px-2 py-1 bg-blue-600 text-white font-medium text-xs flex items-center gap-1">
                        <span>{venue?.name || `会場${venueId}`}</span>
                        <span className="ml-auto opacity-75">{matches.length}試合</span>
                      </div>
                      <div className="p-1 bg-white">
                        <DraggableMatchList
                          matches={matches}
                          onSwapTeams={onSwapTeams}
                          title=""
                          emptyMessage="決勝トーナメントがありません"
                          teams={allTeams}
                          compact
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}

      {/* 研修試合 */}
      {hasTrainingMatches && (
        <div className="mt-4">
          <h3 className="font-semibold text-gray-900 mb-3">順位リーグ（研修試合）</h3>
          {(() => {
            const trainingMatches = allMatches.filter(m => m.stage === 'training')
            const matchesByVenue: Record<number, MatchWithDetails[]> = {}
            trainingMatches.forEach(m => {
              const vid = m.venueId || m.venue_id
              if (vid === undefined) return
              if (!matchesByVenue[vid]) matchesByVenue[vid] = []
              matchesByVenue[vid].push(m)
            })
            Object.values(matchesByVenue).forEach(matches => {
              matches.sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
            })
            const venueEntries = Object.entries(matchesByVenue)
            return (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {venueEntries.map(([venueId, matches], idx) => {
                  const venue = venues.find(v => v.id === Number(venueId))
                  const colors = VENUE_COLORS_LIST[idx % VENUE_COLORS_LIST.length]
                  return (
                    <div key={venueId} className={`rounded border ${colors.border} ${colors.bg} overflow-hidden`}>
                      <div className={`px-2 py-1 ${colors.header} font-medium text-xs`}>
                        {venue?.name || `会場${venueId}`}
                      </div>
                      <div className="p-1 bg-white">
                        <DraggableMatchList
                          matches={matches}
                          onSwapTeams={onSwapTeams}
                          title=""
                          emptyMessage="研修試合がありません"
                          teams={allTeams}
                          enableConstraintCheck
                          compact
                          venueGroupId={String.fromCharCode(65 + idx)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default FinalsView
