// src/pages/Standings/useStandings.ts
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { standingApi, type GroupStandings } from '@/features/standings'
import type { OverallStandings } from '@/features/standings/types'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useAppStore } from '@/stores/appStore'
import { matchesApi, teamsApi, venuesApi } from '@/lib/api'
import type { ViewMode, StandingsEntry, TeamStats, TeamsResponse, MatchesResponse } from './types'
import { exportOverallStandingsExcel, exportGroupStandingsExcel } from './utils/exportStandingsExcel'
import toast from 'react-hot-toast'

export function useStandings() {
  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id

  const [viewMode, setViewMode] = useState<ViewMode>('star')
  const [recentlyUpdated, setRecentlyUpdated] = useState(false)

  // リアルタイム更新
  const { connectionState } = useRealtimeUpdates({
    tournamentId,
    showNotifications: true,
  })
  const isConnected = connectionState === 'connected'

  // グループ別順位
  const {
    data: groupStandings = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<GroupStandings[]>({
    queryKey: ['standings', tournamentId],
    queryFn: () => standingApi.getStandingsByGroup(tournamentId!),
    refetchOnWindowFocus: false,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    enabled: !!tournamentId,
  })

  // 試合データ
  const { data: matchesData, isLoading: isLoadingMatches } = useQuery<MatchesResponse>({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const result = await matchesApi.getAll(tournamentId!)
      return result as unknown as MatchesResponse
    },
    staleTime: 30000,
    enabled: !!tournamentId,
  })

  // チームデータ
  const { data: teamsData, isLoading: isLoadingTeams } = useQuery<TeamsResponse>({
    queryKey: ['teams', tournamentId],
    queryFn: async () => {
      const result = await teamsApi.getAll(tournamentId!)
      return result as unknown as TeamsResponse
    },
    staleTime: 30000,
    enabled: !!tournamentId,
  })

  // 大会形式
  const tournamentData = currentTournament as { use_group_system?: boolean; useGroupSystem?: boolean } | undefined
  const useGroupSystem = tournamentData?.use_group_system ?? tournamentData?.useGroupSystem ?? true

  // 会場データ
  const { data: venuesData } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: () => venuesApi.getAll(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId && !useGroupSystem,
  })

  // 総合順位
  const isOverallRanking = (currentTournament as unknown as { qualification_rule?: string } | undefined)?.qualification_rule === 'overall_ranking' || !useGroupSystem
  const { data: overallStandings, isLoading: isLoadingOverall, refetch: refetchOverall } = useQuery<OverallStandings>({
    queryKey: ['overall-standings', tournamentId],
    queryFn: () => standingApi.getOverallStandings(tournamentId!),
    staleTime: 30000,
    enabled: !!tournamentId,
  })

  // ローカル計算による総合順位（フォールバック用）
  const calculatedOverallRankings = useMemo(() => {
    const teams = teamsData?.teams || []
    const matches = matchesData?.matches?.filter(m => m.stage === 'preliminary' && m.status === 'completed' && !m.is_b_match && !m.isBMatch) || []
    if (teams.length === 0 || matches.length === 0) return undefined

    const statsMap = new Map<number, { teamId: number; points: number; goalDiff: number; goalsFor: number; played: number }>()
    teams.forEach(t => statsMap.set(t.id, { teamId: t.id, points: 0, goalDiff: 0, goalsFor: 0, played: 0 }))

    matches.forEach(m => {
      const homeId = m.homeTeamId ?? m.home_team_id
      const awayId = m.awayTeamId ?? m.away_team_id
      const homeScore = m.homeScoreTotal ?? m.home_score_total ?? 0
      const awayScore = m.awayScoreTotal ?? m.away_score_total ?? 0
      if (!homeId || !awayId) return

      const homeStats = statsMap.get(homeId)
      const awayStats = statsMap.get(awayId)
      if (!homeStats || !awayStats) return

      homeStats.played++; awayStats.played++
      homeStats.goalsFor += homeScore; awayStats.goalsFor += awayScore
      homeStats.goalDiff += (homeScore - awayScore); awayStats.goalDiff += (awayScore - homeScore)

      if (homeScore > awayScore) homeStats.points += 3
      else if (homeScore < awayScore) awayStats.points += 3
      else { homeStats.points += 1; awayStats.points += 1 }
    })

    const sorted = Array.from(statsMap.values()).filter(s => s.played > 0).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })

    const map = new Map<number, number>()
    sorted.forEach((stats, index) => map.set(stats.teamId, index + 1))
    return map
  }, [teamsData, matchesData])

  // 総合順位マップ（DB優先）
  const overallRankingsMap = useMemo(() => {
    if (overallStandings?.entries && overallStandings.entries.length > 0) {
      const map = new Map<number, number>()
      overallStandings.entries.forEach(entry => map.set(entry.teamId, entry.overallRank))
      return map
    }
    return calculatedOverallRankings
  }, [overallStandings, calculatedOverallRankings])

  // 総合順位表エントリ（DB優先、なければローカル計算）
  const displayOverallEntries = useMemo((): StandingsEntry[] => {
    if (overallStandings?.entries && overallStandings.entries.length > 0) {
      return overallStandings.entries
    }

    const teams = teamsData?.teams || []
    const matches = matchesData?.matches?.filter(m => m.stage === 'preliminary' && m.status === 'completed' && !m.is_b_match && !m.isBMatch) || []
    if (teams.length === 0 || matches.length === 0) return []

    const statsMap = new Map<number, TeamStats>()
    teams.forEach(t => {
      statsMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        shortName: t.short_name || t.shortName || t.name,
        groupId: t.group_id || t.groupId || '',
        points: 0, goalDiff: 0, goalsFor: 0, goalsAgainst: 0,
        played: 0, won: 0, drawn: 0, lost: 0,
      })
    })

    matches.forEach(m => {
      const homeId = m.homeTeamId ?? m.home_team_id
      const awayId = m.awayTeamId ?? m.away_team_id
      const homeScore = m.homeScoreTotal ?? m.home_score_total ?? 0
      const awayScore = m.awayScoreTotal ?? m.away_score_total ?? 0
      if (!homeId || !awayId) return

      const homeStats = statsMap.get(homeId)
      const awayStats = statsMap.get(awayId)
      if (!homeStats || !awayStats) return

      homeStats.played++; awayStats.played++
      homeStats.goalsFor += homeScore; homeStats.goalsAgainst += awayScore
      awayStats.goalsFor += awayScore; awayStats.goalsAgainst += homeScore
      homeStats.goalDiff += (homeScore - awayScore); awayStats.goalDiff += (awayScore - homeScore)

      if (homeScore > awayScore) { homeStats.points += 3; homeStats.won++; awayStats.lost++ }
      else if (homeScore < awayScore) { awayStats.points += 3; awayStats.won++; homeStats.lost++ }
      else { homeStats.points += 1; awayStats.points += 1; homeStats.drawn++; awayStats.drawn++ }
    })

    const sorted = Array.from(statsMap.values()).filter(s => s.played > 0).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })

    return sorted.map((stats, index) => ({
      overallRank: index + 1,
      groupId: stats.groupId,
      groupRank: 0,
      teamId: stats.teamId,
      teamName: stats.teamName,
      shortName: stats.shortName,
      points: stats.points,
      goalDifference: stats.goalDiff,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      played: stats.played,
      won: stats.won,
      drawn: stats.drawn,
      lost: stats.lost,
    }))
  }, [overallStandings, teamsData, matchesData])

  // 更新アニメーション
  useEffect(() => {
    if (dataUpdatedAt) {
      setRecentlyUpdated(true)
      const timer = setTimeout(() => setRecentlyUpdated(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [dataUpdatedAt])

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ja-JP') : null

  const [isExporting, setIsExporting] = useState(false)

  const [isPdfExporting, setIsPdfExporting] = useState(false)

  const handlePrint = useCallback(async () => {
    if (displayOverallEntries.length === 0) { window.print(); return }
    setIsPdfExporting(true)
    try {
      const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || ''
      if (!CORE_API_URL) throw new Error('API未設定')

      const pdfPayload = {
        title: `${currentTournament?.name || '浦和カップ'} 順位表`,
        groups: [{
          groupId: 'all',
          groupName: '',
          standings: displayOverallEntries.map((e) => ({
            rank: e.overallRank,
            teamName: e.shortName || e.teamName,
            played: e.played,
            won: e.won,
            drawn: e.drawn,
            lost: e.lost,
            goalsFor: e.goalsFor,
            goalsAgainst: (e.goalsFor ?? 0) - (e.goalDifference ?? 0),
            goalDifference: e.goalDifference,
            points: e.points,
          })),
        }],
      }

      const res = await fetch(`${CORE_API_URL}/standings-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfPayload),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentTournament?.name || '順位表'}_順位表.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch (err) {
      console.error('PDF download failed:', err)
      toast.error('PDF生成に失敗しました。印刷機能にフォールバックします。')
      window.print()
    } finally {
      setIsPdfExporting(false)
    }
  }, [displayOverallEntries, currentTournament])
  const handleRefresh = () => { refetch(); refetchOverall() }

  const handleExcelDownload = useCallback(async () => {
    setIsExporting(true)
    try {
      const tournamentName = currentTournament?.name || ''
      if (viewMode === 'star' && useGroupSystem) {
        await exportGroupStandingsExcel(groupStandings, tournamentName)
      } else {
        const qualifyingCount = overallStandings?.qualifyingCount || 4
        await exportOverallStandingsExcel(
          displayOverallEntries,
          qualifyingCount,
          useGroupSystem,
          tournamentName,
        )
      }
      toast.success('Excelをダウンロードしました')
    } catch (e) {
      console.error('Excel export error:', e)
      toast.error('Excelの生成に失敗しました')
    } finally {
      setIsExporting(false)
    }
  }, [viewMode, useGroupSystem, groupStandings, displayOverallEntries, overallStandings, currentTournament])

  return {
    // State
    viewMode, setViewMode,
    recentlyUpdated,

    // Data
    tournamentId,
    currentTournament,
    groupStandings,
    matchesData,
    teamsData,
    venuesData,
    overallStandings,
    displayOverallEntries,
    overallRankingsMap,

    // Flags
    useGroupSystem,
    isOverallRanking,
    isConnected,
    isLoading: isLoading || isLoadingTeams || isLoadingMatches,
    isLoadingOverall,
    isFetching,
    isError,
    error,
    lastUpdated,

    // Handlers
    handlePrint,
    handleRefresh,
    handleExcelDownload,
    isExporting,
    isPdfExporting,
    refetch,
  }
}
