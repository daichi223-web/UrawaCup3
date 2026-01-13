/**
 * 研修試合編集ページ
 * 順位リーグ間のチーム入れ替えを行う
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'

interface Team {
  id: number
  name: string
  short_name?: string
  group_id?: string
}

interface Match {
  id: number
  home_team_id: number
  away_team_id: number
  venue_id: number
  stage: string
  match_date?: string
  start_time?: string
  home_team?: Team
  away_team?: Team
  venue?: { id: number; name: string }
}

// 順位リーグの定義
const RANK_LEAGUES = [
  { rank: 2, label: '2位リーグ', color: 'bg-blue-100 border-blue-300' },
  { rank: 3, label: '3位リーグ', color: 'bg-green-100 border-green-300' },
  { rank: 4, label: '4位リーグ', color: 'bg-yellow-100 border-yellow-300' },
  { rank: 5, label: '5位リーグ', color: 'bg-orange-100 border-orange-300' },
  { rank: 6, label: '6位リーグ', color: 'bg-red-100 border-red-300' },
]

export default function TrainingMatchEditor() {
  const queryClient = useQueryClient()
  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id || 1

  // 選択中のチーム
  const [selectedTeam, setSelectedTeam] = useState<{
    matchId: number
    teamId: number
    isHome: boolean
    leagueRank: number
  } | null>(null)

  // 研修試合を取得
  const { data: trainingMatches, isLoading } = useQuery({
    queryKey: ['training-matches', tournamentId],
    queryFn: async () => {
      // まず試合データを取得
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id, home_team_id, away_team_id, venue_id, stage, match_date, start_time')
        .eq('tournament_id', tournamentId)
        .eq('stage', 'training')
        .order('venue_id')
        .order('start_time')
      if (error) throw error
      if (!matches || matches.length === 0) return []

      // チームと会場を別途取得
      const teamIds = new Set<number>()
      const venueIds = new Set<number>()
      matches.forEach(m => {
        teamIds.add(m.home_team_id)
        teamIds.add(m.away_team_id)
        venueIds.add(m.venue_id)
      })

      const [teamsRes, venuesRes] = await Promise.all([
        supabase.from('teams').select('id, name, short_name, group_id').in('id', Array.from(teamIds)),
        supabase.from('venues').select('id, name').in('id', Array.from(venueIds))
      ])

      const teamsMap = new Map((teamsRes.data || []).map(t => [t.id, t]))
      const venuesMap = new Map((venuesRes.data || []).map(v => [v.id, v]))

      // データを結合
      return matches.map(m => ({
        ...m,
        home_team: teamsMap.get(m.home_team_id),
        away_team: teamsMap.get(m.away_team_id),
        venue: venuesMap.get(m.venue_id),
      })) as Match[]
    },
  })

  // 会場（順位リーグ）ごとにグループ化
  const matchesByVenue = useMemo(() => {
    if (!trainingMatches) return {}
    const grouped: Record<number, Match[]> = {}
    trainingMatches.forEach(m => {
      if (!grouped[m.venue_id]) grouped[m.venue_id] = []
      grouped[m.venue_id].push(m)
    })
    return grouped
  }, [trainingMatches])

  // 会場IDから順位を推定（会場名に"2位"などが含まれる場合）
  const getLeagueRank = (venueId: number, venueName?: string): number => {
    if (!venueName) return 0
    for (const league of RANK_LEAGUES) {
      if (venueName.includes(`${league.rank}位`)) {
        return league.rank
      }
    }
    // 会場順でランク推定
    const venueIds = Object.keys(matchesByVenue).map(Number).sort((a, b) => a - b)
    const index = venueIds.indexOf(venueId)
    return index >= 0 && index < RANK_LEAGUES.length ? RANK_LEAGUES[index].rank : 0
  }

  // チーム入れ替えミューテーション
  const swapTeamsMutation = useMutation({
    mutationFn: async (params: {
      match1Id: number
      match1IsHome: boolean
      team1Id: number
      match2Id: number
      match2IsHome: boolean
      team2Id: number
    }) => {
      const { match1Id, match1IsHome, team1Id, match2Id, match2IsHome, team2Id } = params

      // 2つの試合を同時に更新
      const updates = []

      // Match1のチームをteam2Idに更新
      updates.push(
        supabase
          .from('matches')
          .update(match1IsHome ? { home_team_id: team2Id } : { away_team_id: team2Id })
          .eq('id', match1Id)
      )

      // Match2のチームをteam1Idに更新
      updates.push(
        supabase
          .from('matches')
          .update(match2IsHome ? { home_team_id: team1Id } : { away_team_id: team1Id })
          .eq('id', match2Id)
      )

      const results = await Promise.all(updates)
      results.forEach(r => {
        if (r.error) throw r.error
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-matches', tournamentId] })
      toast.success('チームを入れ替えました')
      setSelectedTeam(null)
    },
    onError: (error: Error) => {
      toast.error(`入れ替えに失敗しました: ${error.message}`)
    },
  })

  // チームクリック処理
  const handleTeamClick = (matchId: number, teamId: number, isHome: boolean, leagueRank: number) => {
    if (selectedTeam === null) {
      // 最初のチームを選択
      setSelectedTeam({ matchId, teamId, isHome, leagueRank })
    } else if (selectedTeam.matchId === matchId && selectedTeam.isHome === isHome) {
      // 同じチームをクリックしたら選択解除
      setSelectedTeam(null)
    } else if (selectedTeam.teamId === teamId) {
      // 同じチームIDなら何もしない
      setSelectedTeam(null)
    } else {
      // 2つ目のチームをクリック → 入れ替え実行
      swapTeamsMutation.mutate({
        match1Id: selectedTeam.matchId,
        match1IsHome: selectedTeam.isHome,
        team1Id: selectedTeam.teamId,
        match2Id: matchId,
        match2IsHome: isHome,
        team2Id: teamId,
      })
    }
  }

  // 選択解除
  const clearSelection = () => {
    setSelectedTeam(null)
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  const venueIds = Object.keys(matchesByVenue).map(Number).sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">研修試合編集</h1>
          <p className="text-gray-600 mt-1">
            チームをクリックして選択し、別のチームをクリックして入れ替えます
          </p>
        </div>
        <Link to="/schedule" className="btn-secondary">
          日程管理に戻る
        </Link>
      </div>

      {/* 選択中の表示 */}
      {selectedTeam && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="font-medium text-amber-800">
              入れ替え対象を選択中:
            </span>
            <span className="ml-2 px-2 py-1 bg-amber-200 rounded font-bold">
              {trainingMatches?.find(m =>
                (m.id === selectedTeam.matchId && selectedTeam.isHome && m.home_team_id === selectedTeam.teamId) ||
                (m.id === selectedTeam.matchId && !selectedTeam.isHome && m.away_team_id === selectedTeam.teamId)
              )?.[selectedTeam.isHome ? 'home_team' : 'away_team']?.short_name ||
               trainingMatches?.find(m =>
                (m.id === selectedTeam.matchId && selectedTeam.isHome && m.home_team_id === selectedTeam.teamId) ||
                (m.id === selectedTeam.matchId && !selectedTeam.isHome && m.away_team_id === selectedTeam.teamId)
              )?.[selectedTeam.isHome ? 'home_team' : 'away_team']?.name}
            </span>
          </div>
          <button
            onClick={clearSelection}
            className="text-amber-700 hover:text-amber-900"
          >
            選択解除
          </button>
        </div>
      )}

      {/* 順位リーグ一覧 */}
      {venueIds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>研修試合がありません</p>
          <p className="text-sm mt-2">日程管理画面から研修試合を生成してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {venueIds.map((venueId, index) => {
            const matches = matchesByVenue[venueId]
            const venueName = matches[0]?.venue?.name || `会場${venueId}`
            const leagueRank = getLeagueRank(venueId, venueName)
            const leagueInfo = RANK_LEAGUES.find(l => l.rank === leagueRank) || RANK_LEAGUES[index]

            // このリーグに参加しているチームを抽出
            const teamsInLeague = new Set<number>()
            matches.forEach(m => {
              teamsInLeague.add(m.home_team_id)
              teamsInLeague.add(m.away_team_id)
            })

            return (
              <div
                key={venueId}
                className={`border-2 rounded-lg overflow-hidden ${leagueInfo?.color || 'bg-gray-100 border-gray-300'}`}
              >
                {/* リーグヘッダー */}
                <div className="px-3 py-2 bg-white bg-opacity-50 border-b font-bold text-center">
                  {leagueInfo?.label || venueName}
                  <div className="text-xs font-normal text-gray-500">{venueName}</div>
                </div>

                {/* チーム一覧 */}
                <div className="p-2 space-y-1">
                  <div className="text-xs text-gray-600 mb-2 text-center">
                    参加チーム ({teamsInLeague.size}チーム)
                  </div>
                  {matches.map(match => (
                    <div key={match.id} className="bg-white rounded p-2 text-sm">
                      <div className="text-xs text-gray-400 mb-1">
                        {match.start_time?.slice(0, 5) || '--:--'}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* ホームチーム */}
                        <button
                          onClick={() => handleTeamClick(match.id, match.home_team_id, true, leagueRank)}
                          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                            selectedTeam?.matchId === match.id && selectedTeam?.isHome
                              ? 'bg-amber-400 text-white ring-2 ring-amber-500'
                              : selectedTeam !== null
                                ? 'bg-gray-100 hover:bg-amber-100 cursor-pointer'
                                : 'bg-gray-100 hover:bg-blue-100 cursor-pointer'
                          }`}
                          disabled={swapTeamsMutation.isPending}
                        >
                          <span className="text-[10px] text-gray-400 mr-1">
                            {match.home_team?.group_id || ''}
                          </span>
                          {match.home_team?.short_name || match.home_team?.name || `ID:${match.home_team_id}`}
                        </button>

                        <span className="text-gray-400 text-xs">vs</span>

                        {/* アウェイチーム */}
                        <button
                          onClick={() => handleTeamClick(match.id, match.away_team_id, false, leagueRank)}
                          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                            selectedTeam?.matchId === match.id && !selectedTeam?.isHome
                              ? 'bg-amber-400 text-white ring-2 ring-amber-500'
                              : selectedTeam !== null
                                ? 'bg-gray-100 hover:bg-amber-100 cursor-pointer'
                                : 'bg-gray-100 hover:bg-blue-100 cursor-pointer'
                          }`}
                          disabled={swapTeamsMutation.isPending}
                        >
                          <span className="text-[10px] text-gray-400 mr-1">
                            {match.away_team?.group_id || ''}
                          </span>
                          {match.away_team?.short_name || match.away_team?.name || `ID:${match.away_team_id}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 操作説明 */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">使い方</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>入れ替えたいチームをクリックして選択（黄色でハイライト）</li>
          <li>入れ替え先のチームをクリック</li>
          <li>2つのチームが入れ替わります</li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          ※ 異なる順位リーグ間でも入れ替え可能です
        </p>
      </div>
    </div>
  )
}
