// src/pages/Standings/components/GroupStandingsView.tsx
import StarTable from '@/components/StarTable'
import type { GroupStandings } from '@/features/standings'

interface TeamData {
  id: number
  name: string
  short_name?: string
  shortName?: string
  group_id?: string
  groupId?: string
}

interface MatchData {
  id: number
  group_id?: string
  groupId?: string
  stage?: string
  status?: string
}

interface TeamsResponse {
  teams: TeamData[]
}

interface MatchesResponse {
  matches: MatchData[]
}

interface GroupStandingsViewProps {
  groupStandings: GroupStandings[]
  teamsData: TeamsResponse | undefined
  matchesData: MatchesResponse | undefined
  overallRankingsMap: Map<number, number> | undefined
  recentlyUpdated: boolean
}

export function GroupStandingsView({
  groupStandings,
  teamsData,
  matchesData,
  overallRankingsMap,
  recentlyUpdated,
}: GroupStandingsViewProps) {
  return (
    <div className={`standings-grid grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity duration-300 ${
      recentlyUpdated ? 'opacity-80' : 'opacity-100'
    }`}>
      {groupStandings.map((groupData) => {
        const groupTeams = (teamsData?.teams || []).filter(
          (t) => (t.group_id || t.groupId) === groupData.groupId
        )
        const groupMatches = (matchesData?.matches || []).filter(
          (m) => (m.group_id || m.groupId) === groupData.groupId
        )

        return (
          <div key={groupData.groupId} className={`card transition-shadow ${
            recentlyUpdated ? 'shadow-lg ring-2 ring-green-200' : ''
          }`}>
            <div className={`card-header group-${groupData.groupId.toLowerCase()} flex justify-between items-center`}>
              <h3 className="text-lg font-semibold">{groupData.groupId}グループ 成績表</h3>
            </div>
            <div className="card-body p-4">
              {groupTeams.length > 0 ? (
                <StarTable
                  teams={groupTeams as unknown as import('@/types').Team[]}
                  matches={groupMatches as unknown as import('@/types').MatchWithDetails[]}
                  groupId={groupData.groupId}
                  overallRankings={overallRankingsMap}
                  showOverallRank={true}
                />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  チームデータを読み込み中...
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GroupStandingsView
