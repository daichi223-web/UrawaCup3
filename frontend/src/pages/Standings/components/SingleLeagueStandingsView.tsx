// src/pages/Standings/components/SingleLeagueStandingsView.tsx
import StarTable from '@/components/StarTable'

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
  stage?: string
  status?: string
}

interface TeamsResponse {
  teams: TeamData[]
}

interface MatchesResponse {
  matches: MatchData[]
}

interface SingleLeagueStandingsViewProps {
  teamsData: TeamsResponse | undefined
  matchesData: MatchesResponse | undefined
  overallRankingsMap: Map<number, number> | undefined
  recentlyUpdated: boolean
}

export function SingleLeagueStandingsView({
  teamsData,
  matchesData,
  overallRankingsMap,
  recentlyUpdated,
}: SingleLeagueStandingsViewProps) {
  return (
    <div className={`card transition-shadow ${
      recentlyUpdated ? 'shadow-lg ring-2 ring-green-200' : ''
    }`}>
      <div className="card-header bg-primary-600 text-white flex justify-between items-center">
        <h3 className="text-lg font-semibold">全チーム 成績表</h3>
        <span className="text-sm opacity-80">{teamsData?.teams?.length || 0}チーム</span>
      </div>
      <div className="card-body p-4 overflow-x-auto star-table-container">
        {(teamsData?.teams?.length || 0) > 0 ? (
          <StarTable
            teams={(teamsData?.teams || []) as unknown as import('@/types').Team[]}
            matches={(matchesData?.matches?.filter((m) => m.stage === 'preliminary') || []) as unknown as import('@/types').MatchWithDetails[]}
            groupId="all"
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
}

export default SingleLeagueStandingsView
