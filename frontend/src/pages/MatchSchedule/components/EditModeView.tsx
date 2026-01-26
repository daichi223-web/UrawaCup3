// src/pages/MatchSchedule/components/EditModeView.tsx
// 編集モード: 二日間同時表示
import MatchScheduleEditor from '@/components/MatchScheduleEditor'
import { GROUP_COLORS, VENUE_COLORS_LIST } from '../constants'
import type { MatchWithDetails, VenueInfo, TeamInfo } from '../types'

interface EditModeViewProps {
  useGroupSystem: boolean
  venues: VenueInfo[]
  allTeams: TeamInfo[]
  allMatches: MatchWithDetails[]
  day1Matches: MatchWithDetails[]
  day2Matches: MatchWithDetails[]
  consecutiveMatchTeams: Set<number>
  getDateString: (dayOffset: number) => string
  onEditorSave: (changes: { matchId: number; homeTeamId: number; awayTeamId: number; refereeTeamIds?: number[] }[]) => Promise<void>
  isBulkUpdating: boolean
}

export function EditModeView({
  useGroupSystem,
  venues,
  allTeams,
  allMatches,
  day1Matches,
  day2Matches,
  consecutiveMatchTeams,
  getDateString,
  onEditorSave,
  isBulkUpdating,
}: EditModeViewProps) {
  return (
    <div className="space-y-4">
      {/* 日付ヘッダー */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <h3 className="font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
          <span>Day1 ({getDateString(0)})</span>
          {day1Matches.some(m => {
            const homeId = m.homeTeamId || m.home_team_id
            const awayId = m.awayTeamId || m.away_team_id
            return (homeId && consecutiveMatchTeams.has(homeId)) || (awayId && consecutiveMatchTeams.has(awayId))
          }) && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">⚠ 連戦あり</span>
          )}
        </h3>
        <h3 className="font-semibold text-gray-700 border-b pb-2 flex items-center gap-2">
          <span>Day2 ({getDateString(1)})</span>
          {day2Matches.some(m => {
            const homeId = m.homeTeamId || m.home_team_id
            const awayId = m.awayTeamId || m.away_team_id
            return (homeId && consecutiveMatchTeams.has(homeId)) || (awayId && consecutiveMatchTeams.has(awayId))
          }) && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">⚠ 連戦あり</span>
          )}
        </h3>
      </div>

      {useGroupSystem ? (
        /* グループ制：グループごとに横並び表示 */
        ['A', 'B', 'C', 'D'].map(groupId => {
          const day1GroupMatches = day1Matches.filter(m => (m.groupId || m.group_id) === groupId)
          const day2GroupMatches = day2Matches.filter(m => (m.groupId || m.group_id) === groupId)
          const allGroupMatches = allMatches.filter(m => (m.groupId || m.group_id) === groupId && m.stage === 'preliminary')
          const colors = GROUP_COLORS[groupId]

          return (
            <div key={groupId} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-3 py-1.5 ${colors.header} font-medium text-sm`}>
                  {groupId}グループ
                </div>
                <div className="p-2 bg-white">
                  <MatchScheduleEditor
                    matches={day1GroupMatches}
                    allGroupMatches={allGroupMatches}
                    teams={allTeams}
                    groupId={groupId}
                    day={1}
                    onSave={onEditorSave}
                    disabled={isBulkUpdating}
                  />
                </div>
              </div>
              <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-3 py-1.5 ${colors.header} font-medium text-sm`}>
                  {groupId}グループ
                </div>
                <div className="p-2 bg-white">
                  <MatchScheduleEditor
                    matches={day2GroupMatches}
                    allGroupMatches={allGroupMatches}
                    teams={allTeams}
                    groupId={groupId}
                    day={2}
                    onSave={onEditorSave}
                    disabled={isBulkUpdating}
                  />
                </div>
              </div>
            </div>
          )
        })
      ) : (
        /* 1リーグ制：会場ごとに横並び表示 */
        venues.filter(v => v.forPreliminary || v.for_preliminary).map((venue, idx) => {
          const day1VenueMatches = day1Matches.filter(m => (m.venueId || m.venue_id) === venue.id)
          const day2VenueMatches = day2Matches.filter(m => (m.venueId || m.venue_id) === venue.id)
          const allVenueMatches = allMatches.filter(m => (m.venueId || m.venue_id) === venue.id && m.stage === 'preliminary')
          const colors = VENUE_COLORS_LIST[idx % VENUE_COLORS_LIST.length]

          if (day1VenueMatches.length === 0 && day2VenueMatches.length === 0) return null

          return (
            <div key={venue.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-3 py-1.5 ${colors.header} font-medium text-sm`}>
                  {venue.name}
                </div>
                <div className="p-2 bg-white">
                  <MatchScheduleEditor
                    matches={day1VenueMatches}
                    allGroupMatches={allVenueMatches}
                    teams={allTeams}
                    groupId={`venue-${venue.id}`}
                    day={1}
                    onSave={onEditorSave}
                    disabled={isBulkUpdating}
                  />
                </div>
              </div>
              <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-3 py-1.5 ${colors.header} font-medium text-sm`}>
                  {venue.name}
                </div>
                <div className="p-2 bg-white">
                  <MatchScheduleEditor
                    matches={day2VenueMatches}
                    allGroupMatches={allVenueMatches}
                    teams={allTeams}
                    groupId={`venue-${venue.id}`}
                    day={2}
                    onSave={onEditorSave}
                    disabled={isBulkUpdating}
                  />
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default EditModeView
