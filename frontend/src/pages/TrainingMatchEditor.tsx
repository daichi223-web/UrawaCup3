/**
 * 研修試合編集ページ
 * 順位リーグ間のチーム入れ替えを行う
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Clock, Plus, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'

interface Team {
  id: number
  name: string
  short_name?: string
  group_id?: string
  region?: string
  league_id?: number
  team_type?: 'local' | 'invited'
}

interface Match {
  id: number
  home_team_id: number
  away_team_id: number
  venue_id: number
  stage: string
  match_date?: string
  match_time?: string
  home_team?: Team
  away_team?: Team
  venue?: { id: number; name: string }
}

interface Venue {
  id: number
  name: string
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

  // 会場ごとのキックオフ時間編集状態
  const [venueTimeEdits, setVenueTimeEdits] = useState<Record<number, string>>({})

  // 全チームを取得（試合追加時に使用）
  const { data: allTeams } = useQuery({
    queryKey: ['all-teams', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, short_name, group_id')
        .eq('tournament_id', tournamentId)
      if (error) throw error
      return data || []
    },
  })

  // 全会場を取得
  const { data: allVenues } = useQuery({
    queryKey: ['all-venues', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name')
        .eq('tournament_id', tournamentId)
        .order('id')
      if (error) throw error
      return data || []
    },
  })

  // リーグ一覧を取得（リーグ名表示用）
  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name')
      if (error) throw error
      return data || []
    },
  })

  // リーグIDから名前を取得
  const getLeagueName = (leagueId?: number): string => {
    if (!leagueId) return ''
    return leagues?.find(l => l.id === leagueId)?.name || ''
  }

  // 過去の対戦履歴を取得（対戦済みチェック用）
  const { data: pastMatches } = useQuery({
    queryKey: ['past-matches', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('tournament_id', tournamentId)
        .neq('stage', 'training')
      if (error) throw error
      return data || []
    },
  })

  // 対戦済みかチェック
  const hasPlayedBefore = (teamA: number, teamB: number): boolean => {
    if (!pastMatches) return false
    return pastMatches.some(
      m => (m.home_team_id === teamA && m.away_team_id === teamB) ||
           (m.home_team_id === teamB && m.away_team_id === teamA)
    )
  }

  // 試合の警告をチェック（表示用 - 各試合カードに表示）
  const getMatchWarnings = (match: Match, allMatchesInVenue: Match[]): string[] => {
    const warnings: string[] = []
    const homeTeam = match.home_team
    const awayTeam = match.away_team

    if (!homeTeam || !awayTeam) return warnings

    // 対戦済みチェック
    if (hasPlayedBefore(match.home_team_id, match.away_team_id)) {
      warnings.push('対戦済')
    }

    // 同地域チェック（地元同士も含む）
    if (homeTeam.team_type === 'local' && awayTeam.team_type === 'local') {
      warnings.push('地元同士')
    } else if (homeTeam.region && awayTeam.region && homeTeam.region === awayTeam.region) {
      warnings.push(`同地域(${homeTeam.region})`)
    }

    // 同リーグチェック
    if (homeTeam.league_id && awayTeam.league_id && homeTeam.league_id === awayTeam.league_id) {
      const leagueName = getLeagueName(homeTeam.league_id)
      warnings.push(`同リーグ${leagueName ? `(${leagueName})` : ''}`)
    }

    // 別会場出場チェック（同じチームが別会場の試合にも出ている）
    const otherVenueMatches = trainingMatches?.filter(m => m.venue_id !== match.venue_id) || []
    const homeInOtherVenue = otherVenueMatches.find(
      m => m.home_team_id === match.home_team_id || m.away_team_id === match.home_team_id
    )
    if (homeInOtherVenue) {
      const otherVenueName = homeInOtherVenue.venue?.name || `会場${homeInOtherVenue.venue_id}`
      warnings.push(`別会場(${homeTeam.short_name || homeTeam.name}→${otherVenueName})`)
    }
    const awayInOtherVenue = otherVenueMatches.find(
      m => m.home_team_id === match.away_team_id || m.away_team_id === match.away_team_id
    )
    if (awayInOtherVenue) {
      const otherVenueName = awayInOtherVenue.venue?.name || `会場${awayInOtherVenue.venue_id}`
      warnings.push(`別会場(${awayTeam.short_name || awayTeam.name}→${otherVenueName})`)
    }

    // 連戦チェック（同じ会場で連続して出場するチーム - 後ろの試合にのみ表示）
    const matchIndex = allMatchesInVenue.findIndex(m => m.id === match.id)
    if (matchIndex > 0) {
      const prevMatch = allMatchesInVenue[matchIndex - 1]
      const prevTeamIds = [prevMatch.home_team_id, prevMatch.away_team_id]
      if (prevTeamIds.includes(match.home_team_id)) {
        warnings.push(`連戦(${homeTeam.short_name || homeTeam.name})`)
      }
      if (prevTeamIds.includes(match.away_team_id)) {
        warnings.push(`連戦(${awayTeam.short_name || awayTeam.name})`)
      }
    }

    return [...new Set(warnings)] // 重複除去
  }

  // 研修試合を取得
  const { data: trainingMatches, isLoading } = useQuery({
    queryKey: ['training-matches', tournamentId],
    queryFn: async () => {
      // まず試合データを取得
      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('stage', 'training')
        .order('venue_id')
        .order('match_time')
      if (error) {
        console.error('[TrainingMatchEditor] Query error:', error)
        throw error
      }
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
        supabase.from('teams').select('id, name, short_name, group_id, region, league_id, team_type').in('id', Array.from(teamIds)),
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

  // 会場（順位リーグ）ごとにグループ化（時間順でソート）
  const matchesByVenue = useMemo(() => {
    if (!trainingMatches) return {}
    const grouped: Record<number, Match[]> = {}
    trainingMatches.forEach(m => {
      if (!grouped[m.venue_id]) grouped[m.venue_id] = []
      grouped[m.venue_id].push(m)
    })
    // 各会場内で時間順にソート
    Object.values(grouped).forEach(matches => {
      matches.sort((a, b) => (a.match_time || '').localeCompare(b.match_time || ''))
    })
    return grouped
  }, [trainingMatches])

  // 全体の警告数をカウント（ユニークな問題数と内訳）
  const warningStats = useMemo(() => {
    const stats = {
      played: 0,      // 対戦済み
      region: 0,      // 同地域 + 地元同士
      league: 0,      // 同リーグ
      venue: 0,       // 別会場
      consecutive: 0, // 連戦
      total: 0,
    }
    if (!trainingMatches) return stats

    const uniqueWarnings = {
      played: new Set<string>(),
      region: new Set<string>(),
      league: new Set<string>(),
      venue: new Set<string>(),
      consecutive: new Set<string>(),
    }

    trainingMatches.forEach(match => {
      const homeTeam = match.home_team
      const awayTeam = match.away_team
      if (!homeTeam || !awayTeam) return

      // 対戦済み（チームペアでユニーク）
      if (hasPlayedBefore(match.home_team_id, match.away_team_id)) {
        const pairKey = [match.home_team_id, match.away_team_id].sort().join('-')
        uniqueWarnings.played.add(pairKey)
      }

      // 同地域（地元同士も含む、チームペアでユニーク）
      if (homeTeam.team_type === 'local' && awayTeam.team_type === 'local') {
        const pairKey = [match.home_team_id, match.away_team_id].sort().join('-')
        uniqueWarnings.region.add(`local:${pairKey}`)
      } else if (homeTeam.region && awayTeam.region && homeTeam.region === awayTeam.region) {
        const pairKey = [match.home_team_id, match.away_team_id].sort().join('-')
        uniqueWarnings.region.add(`region:${pairKey}`)
      }

      // 同リーグ（チームペアでユニーク）
      if (homeTeam.league_id && awayTeam.league_id && homeTeam.league_id === awayTeam.league_id) {
        const pairKey = [match.home_team_id, match.away_team_id].sort().join('-')
        uniqueWarnings.league.add(pairKey)
      }

      // 別会場（チームごとにユニーク）
      const otherVenueMatches = trainingMatches.filter(m => m.venue_id !== match.venue_id)
      if (otherVenueMatches.some(m => m.home_team_id === match.home_team_id || m.away_team_id === match.home_team_id)) {
        uniqueWarnings.venue.add(String(match.home_team_id))
      }
      if (otherVenueMatches.some(m => m.home_team_id === match.away_team_id || m.away_team_id === match.away_team_id)) {
        uniqueWarnings.venue.add(String(match.away_team_id))
      }
    })

    // 連戦（会場×チームでユニーク）
    const venueIds = [...new Set(trainingMatches.map(m => m.venue_id))]
    venueIds.forEach(venueId => {
      const matchesInVenue = trainingMatches.filter(m => m.venue_id === venueId)
      for (let i = 1; i < matchesInVenue.length; i++) {
        const prevMatch = matchesInVenue[i - 1]
        const currMatch = matchesInVenue[i]
        const prevTeamIds = [prevMatch.home_team_id, prevMatch.away_team_id]
        if (prevTeamIds.includes(currMatch.home_team_id)) {
          uniqueWarnings.consecutive.add(`${venueId}:${currMatch.home_team_id}`)
        }
        if (prevTeamIds.includes(currMatch.away_team_id)) {
          uniqueWarnings.consecutive.add(`${venueId}:${currMatch.away_team_id}`)
        }
      }
    })

    stats.played = uniqueWarnings.played.size
    stats.region = uniqueWarnings.region.size
    stats.league = uniqueWarnings.league.size
    stats.venue = uniqueWarnings.venue.size
    stats.consecutive = uniqueWarnings.consecutive.size
    stats.total = stats.played + stats.region + stats.league + stats.venue + stats.consecutive

    return stats
  }, [trainingMatches, pastMatches])

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
      // 関連するすべてのクエリを無効化
      queryClient.invalidateQueries({ queryKey: ['training-matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('チームを入れ替えました')
      setSelectedTeam(null)
    },
    onError: (error: Error) => {
      toast.error(`入れ替えに失敗しました: ${error.message}`)
    },
  })

  // 会場のキックオフ時間を一括更新
  const updateVenueTimeMutation = useMutation({
    mutationFn: async ({ venueId, startTime }: { venueId: number; startTime: string }) => {
      const matchesToUpdate = trainingMatches?.filter(m => m.venue_id === venueId) || []
      if (matchesToUpdate.length === 0) return

      const { error } = await supabase
        .from('matches')
        .update({ match_time: startTime })
        .eq('tournament_id', tournamentId)
        .eq('venue_id', venueId)
        .eq('stage', 'training')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('キックオフ時間を更新しました')
    },
    onError: (error: Error) => {
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // 試合を追加
  const addMatchMutation = useMutation({
    mutationFn: async ({ venueId, startTime }: { venueId: number; startTime?: string }) => {
      // 未割り当てチームを取得
      const assignedTeamIds = new Set<number>()
      trainingMatches?.forEach(m => {
        assignedTeamIds.add(m.home_team_id)
        assignedTeamIds.add(m.away_team_id)
      })

      const unassignedTeams = (allTeams || []).filter(t => !assignedTeamIds.has(t.id))
      if (unassignedTeams.length < 2) {
        throw new Error('割り当て可能なチームが足りません')
      }

      // 試合日を取得（既存の試合から）
      const existingMatch = trainingMatches?.find(m => m.venue_id === venueId)
      const matchDate = existingMatch?.match_date || trainingMatches?.[0]?.match_date

      const { error } = await supabase
        .from('matches')
        .insert({
          tournament_id: tournamentId,
          home_team_id: unassignedTeams[0].id,
          away_team_id: unassignedTeams[1].id,
          venue_id: venueId,
          stage: 'training',
          match_date: matchDate,
          match_time: startTime || '09:00',
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('試合を追加しました')
    },
    onError: (error: Error) => {
      toast.error(`追加に失敗しました: ${error.message}`)
    },
  })

  // 試合を削除（会場の最後の試合を削除）
  const removeMatchMutation = useMutation({
    mutationFn: async ({ venueId }: { venueId: number }) => {
      const matchesInVenue = trainingMatches?.filter(m => m.venue_id === venueId) || []
      if (matchesInVenue.length === 0) {
        throw new Error('削除する試合がありません')
      }

      // 最後の試合を削除
      const lastMatch = matchesInVenue[matchesInVenue.length - 1]
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', lastMatch.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('試合を削除しました')
    },
    onError: (error: Error) => {
      toast.error(`削除に失敗しました: ${error.message}`)
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
    <div className="space-y-4 w-full max-w-none">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">研修試合編集</h1>
          <p className="text-gray-600 mt-1">
            チームをクリックして選択し、別のチームをクリックして入れ替えます
          </p>
        </div>
        <Link to="/schedule?tab=day3" className="btn-secondary">
          日程管理に戻る
        </Link>
      </div>

      {/* 警告サマリー */}
      {warningStats.total > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-orange-800">
              警告: {warningStats.total}件
            </span>
            <span className="text-orange-600 text-sm">内訳:</span>
            {warningStats.played > 0 && (
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                対戦済 {warningStats.played}
              </span>
            )}
            {warningStats.region > 0 && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                同地域/地元 {warningStats.region}
              </span>
            )}
            {warningStats.league > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                同リーグ {warningStats.league}
              </span>
            )}
            {warningStats.venue > 0 && (
              <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full">
                別会場 {warningStats.venue}
              </span>
            )}
            {warningStats.consecutive > 0 && (
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                連戦 {warningStats.consecutive}
              </span>
            )}
          </div>
        </div>
      )}

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
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ minWidth: '100%' }}>
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
                className={`border-2 rounded-lg overflow-hidden flex-1 min-w-[200px] max-w-[280px] ${leagueInfo?.color || 'bg-gray-100 border-gray-300'}`}
              >
                {/* リーグヘッダー */}
                <div className="px-3 py-2 bg-white bg-opacity-50 border-b">
                  <div className="font-bold text-center">
                    {leagueInfo?.label || venueName}
                  </div>
                  <div className="text-xs font-normal text-gray-500 text-center">{venueName}</div>

                  {/* キックオフ時間設定 */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <input
                      type="time"
                      value={venueTimeEdits[venueId] ?? matches[0]?.match_time?.slice(0, 5) ?? '09:00'}
                      onChange={(e) => setVenueTimeEdits(prev => ({ ...prev, [venueId]: e.target.value }))}
                      className="text-xs px-1 py-0.5 border rounded w-20"
                    />
                    <button
                      onClick={() => {
                        const time = venueTimeEdits[venueId] ?? matches[0]?.match_time?.slice(0, 5) ?? '09:00'
                        updateVenueTimeMutation.mutate({ venueId, startTime: time })
                      }}
                      disabled={updateVenueTimeMutation.isPending}
                      className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      設定
                    </button>
                  </div>

                  {/* 試合数調整 */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-600">試合数: {matches.length}</span>
                    <button
                      onClick={() => removeMatchMutation.mutate({ venueId })}
                      disabled={removeMatchMutation.isPending || matches.length <= 1}
                      className="p-0.5 rounded bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="試合を減らす"
                    >
                      <Minus className="w-3 h-3 text-red-600" />
                    </button>
                    <button
                      onClick={() => {
                        const time = venueTimeEdits[venueId] ?? matches[0]?.match_time?.slice(0, 5) ?? '09:00'
                        addMatchMutation.mutate({ venueId, startTime: time })
                      }}
                      disabled={addMatchMutation.isPending}
                      className="p-0.5 rounded bg-green-100 hover:bg-green-200 disabled:opacity-50"
                      title="試合を追加"
                    >
                      <Plus className="w-3 h-3 text-green-600" />
                    </button>
                  </div>
                </div>

                {/* チーム一覧 */}
                <div className="p-2 space-y-1">
                  <div className="text-xs text-gray-600 mb-2 text-center">
                    参加チーム ({teamsInLeague.size}チーム)
                  </div>
                  {matches.map(match => {
                    const warnings = getMatchWarnings(match, matches)
                    return (
                    <div key={match.id} className={`bg-white rounded p-2 text-sm ${warnings.length > 0 ? 'ring-2 ring-orange-300' : ''}`}>
                      <div className="text-xs text-gray-400 mb-1">
                        {match.match_time?.slice(0, 5) || '--:--'}
                      </div>
                      {/* 警告バッジ */}
                      {warnings.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {warnings.map((warning, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                warning.startsWith('対戦済')
                                  ? 'bg-red-100 text-red-700'
                                  : warning.startsWith('同地域') || warning.startsWith('地元同士')
                                    ? 'bg-purple-100 text-purple-700'
                                    : warning.startsWith('同リーグ')
                                      ? 'bg-blue-100 text-blue-700'
                                      : warning.startsWith('別会場')
                                        ? 'bg-pink-100 text-pink-700'
                                        : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
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
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 操作説明 */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">使い方</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-800 mb-1">チーム入れ替え</h4>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>入れ替えたいチームをクリックして選択（黄色でハイライト）</li>
              <li>入れ替え先のチームをクリック</li>
              <li>2つのチームが入れ替わります</li>
            </ol>
            <p className="mt-1 text-xs text-gray-500">
              ※ 異なる順位リーグ間でも入れ替え可能です
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">会場設定</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>時間入力欄でキックオフ時間を変更し「設定」ボタンで適用</li>
              <li>+/−ボタンで試合数を調整</li>
              <li>変更は日程管理画面にも反映されます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
