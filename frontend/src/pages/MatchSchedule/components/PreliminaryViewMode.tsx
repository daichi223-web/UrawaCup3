// src/pages/MatchSchedule/components/PreliminaryViewMode.tsx
// 閲覧モード: コンパクトな全体表示
import DraggableMatchList, { type SelectedTeam } from '@/components/DraggableMatchList'
import { GROUP_COLORS, VENUE_COLORS_LIST } from '../constants'
import type { MatchWithDetails, VenueInfo, TeamInfo, TabKey } from '../types'

interface PreliminaryViewModeProps {
  activeTab: TabKey
  useGroupSystem: boolean
  venues: VenueInfo[]
  allTeams: TeamInfo[]
  day1Matches: MatchWithDetails[]
  day2Matches: MatchWithDetails[]
  consecutiveMatchTeams: Set<number>
  crossVenueSelectedTeam: SelectedTeam | null
  onCrossVenueSelect: (team: SelectedTeam | null) => void
  onSwapTeams: (matchId: number, homeTeamId: number, awayTeamId: number) => Promise<void>
}

export function PreliminaryViewMode({
  activeTab,
  useGroupSystem,
  venues,
  allTeams,
  day1Matches,
  day2Matches,
  consecutiveMatchTeams,
  crossVenueSelectedTeam,
  onCrossVenueSelect,
  onSwapTeams,
}: PreliminaryViewModeProps) {
  const currentDayMatches = activeTab === 'day1' ? day1Matches : day2Matches
  const uniqueTimes = [...new Set(currentDayMatches.map(m => (m.matchTime || m.match_time || '').substring(0, 5)))]
    .filter(t => t)
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="space-y-2">
      {/* 時間スケジュール一覧 */}
      {uniqueTimes.length > 0 && (
        <div className="bg-gray-100 rounded px-3 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-gray-600">時間:</span>
          {uniqueTimes.map((time, idx) => (
            <span key={time} className="text-gray-700">
              <span className="font-mono text-gray-500">{idx + 1}</span>
              <span className="mx-0.5">=</span>
              <span className="font-mono">{time}</span>
            </span>
          ))}
        </div>
      )}

      {useGroupSystem ? (
        /* グループ制：4グループ×2日を横に並べる */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {['A', 'B', 'C', 'D'].map(groupId => {
            const day1GroupMatches = day1Matches.filter(m => (m.groupId || m.group_id) === groupId)
            const day2GroupMatches = day2Matches.filter(m => (m.groupId || m.group_id) === groupId)
            const colors = GROUP_COLORS[groupId]

            return (
              <div key={groupId} className={`rounded border ${colors.border} ${colors.bg} overflow-hidden`}>
                <div className={`px-2 py-1 ${colors.header} font-medium text-xs`}>
                  {groupId}グループ
                </div>
                <div className="px-1 py-0.5 bg-gray-100 text-xs text-gray-600 font-medium">Day1</div>
                <div className="p-1 bg-white">
                  <DraggableMatchList
                    matches={day1GroupMatches}
                    onSwapTeams={onSwapTeams}
                    title=""
                    emptyMessage=""
                    consecutiveMatchTeams={consecutiveMatchTeams}
                    teams={allTeams.filter(t => t.groupId === groupId)}
                    enableConstraintCheck
                    compact
                  />
                </div>
                <div className="px-1 py-0.5 bg-gray-100 text-xs text-gray-600 font-medium">Day2</div>
                <div className="p-1 bg-white">
                  <DraggableMatchList
                    matches={day2GroupMatches}
                    onSwapTeams={onSwapTeams}
                    title=""
                    emptyMessage=""
                    consecutiveMatchTeams={consecutiveMatchTeams}
                    teams={allTeams.filter(t => t.groupId === groupId)}
                    enableConstraintCheck
                    compact
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* 1リーグ制：会場ごとにコンパクト表示 */
        <>
          {crossVenueSelectedTeam && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex-1 p-2 bg-primary-50 border border-primary-200 rounded flex items-center justify-between">
                <span className="text-sm text-primary-700">
                  「{crossVenueSelectedTeam.teamName}」を選択中
                </span>
                <button
                  onClick={() => onCrossVenueSelect(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  解除
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {venues.filter(v => v.forPreliminary || v.for_preliminary).map((venue, idx) => {
              const day1VenueMatches = day1Matches.filter(m => (m.venueId || m.venue_id) === venue.id)
              const day2VenueMatches = day2Matches.filter(m => (m.venueId || m.venue_id) === venue.id)
              const colors = VENUE_COLORS_LIST[idx % VENUE_COLORS_LIST.length]
              const venueGroupId = String.fromCharCode(65 + idx)

              if (day1VenueMatches.length === 0 && day2VenueMatches.length === 0) return null

              return (
                <div key={venue.id} className={`rounded border ${colors.border} ${colors.bg} overflow-hidden`}>
                  <div className={`px-2 py-1 ${colors.header} font-medium text-xs`}>
                    {venue.name}
                  </div>
                  <div className="px-1 py-0.5 bg-gray-100 text-xs text-gray-600 font-medium">Day1</div>
                  <div className="p-1 bg-white">
                    <DraggableMatchList
                      matches={day1VenueMatches}
                      onSwapTeams={onSwapTeams}
                      title=""
                      emptyMessage=""
                      consecutiveMatchTeams={consecutiveMatchTeams}
                      teams={allTeams}
                      enableConstraintCheck
                      compact
                      externalSelectedTeam={crossVenueSelectedTeam}
                      onExternalSelect={onCrossVenueSelect}
                      allMatches={[...day1Matches, ...day2Matches]}
                      venueGroupId={venueGroupId}
                    />
                  </div>
                  <div className="px-1 py-0.5 bg-gray-100 text-xs text-gray-600 font-medium">Day2</div>
                  <div className="p-1 bg-white">
                    <DraggableMatchList
                      matches={day2VenueMatches}
                      onSwapTeams={onSwapTeams}
                      title=""
                      emptyMessage=""
                      consecutiveMatchTeams={consecutiveMatchTeams}
                      teams={allTeams}
                      enableConstraintCheck
                      compact
                      externalSelectedTeam={crossVenueSelectedTeam}
                      onExternalSelect={onCrossVenueSelect}
                      allMatches={[...day1Matches, ...day2Matches]}
                      venueGroupId={venueGroupId}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      <div className="text-xs text-gray-400 text-center">
        ※ チームをクリックして選択後、入れ替えたいチームをクリック（会場を超えた変更可能）
      </div>
    </div>
  )
}

export default PreliminaryViewMode
