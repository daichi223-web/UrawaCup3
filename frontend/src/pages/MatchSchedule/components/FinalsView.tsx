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
  // 決勝試合を会場別に分類
  const finalsByVenue: Record<number, MatchWithDetails[]> = {}
  finalsMatches.forEach(m => {
    const vid = m.venueId || m.venue_id
    if (vid === undefined) return
    if (!finalsByVenue[vid]) finalsByVenue[vid] = []
    finalsByVenue[vid].push(m)
  })
  Object.values(finalsByVenue).forEach(matches => {
    matches.sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
  })

  // 研修試合を会場別に分類
  const trainingMatches = allMatches.filter(m => m.stage === 'training')
  const trainingByVenue: Record<number, MatchWithDetails[]> = {}
  trainingMatches.forEach(m => {
    const vid = m.venueId || m.venue_id
    if (vid === undefined) return
    if (!trainingByVenue[vid]) trainingByVenue[vid] = []
    trainingByVenue[vid].push(m)
  })
  Object.values(trainingByVenue).forEach(matches => {
    matches.sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
  })

  const finalsVenueEntries = Object.entries(finalsByVenue)
  const trainingVenueEntries = Object.entries(trainingByVenue)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      {finalsMatches.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">最終日</h3>
          <button
            className="btn-secondary text-sm"
            onClick={onUpdateBracket}
            disabled={isUpdatingBracket}
          >
            {isUpdatingBracket ? '更新中...' : '組み合わせ更新'}
          </button>
        </div>
      )}

      {/* 全会場を3列グリッドで表示（決勝＋研修） */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 決勝会場カード */}
        {finalsVenueEntries.map(([venueId, matches]) => {
          const venue = venues.find(v => v.id === Number(venueId))
          return (
            <div key={`finals-${venueId}`} className="rounded border-2 border-blue-300 bg-blue-50 overflow-hidden">
              <div className="px-2 py-1 bg-blue-600 text-white font-medium text-xs flex items-center gap-1">
                <span>{venue?.name || `会場${venueId}`}</span>
                <span className="px-1 py-0.5 bg-blue-500 text-blue-100 text-[10px] rounded ml-1">決勝</span>
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

        {/* 研修会場カード */}
        {trainingVenueEntries.map(([venueId, matches], idx) => {
          const venue = venues.find(v => v.id === Number(venueId))
          const colors = VENUE_COLORS_LIST[idx % VENUE_COLORS_LIST.length]
          return (
            <div key={`training-${venueId}`} className={`rounded border ${colors.border} ${colors.bg} overflow-hidden`}>
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
    </div>
  )
}

export default FinalsView
