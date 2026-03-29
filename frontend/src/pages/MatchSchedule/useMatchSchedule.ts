// src/pages/MatchSchedule/useMatchSchedule.ts
// 日程管理画面のカスタムフック - 状態管理・ロジック

import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { tournamentsApi, venuesApi, matchesApi, teamsApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import { venueAssignmentApi } from '@/features/venue-assignments/api'
import { matchApi } from '@/features/matches/api'
import { finalDayApi } from '@/features/final-day/api'
import { standingApi } from '@/features/standings/api'
import { useConstraintSettingsStore } from '@/stores/constraintSettingsStore'
import {
  generateUrawaCupSchedule,
  generateVenueBasedSchedule,
  validateSchedule,
  checkConsecutiveMatches,
  generateOptimalVenueAssignment,
  convertToVenueAssignmentInfos,
  type TeamInfo as ScheduleTeamInfo,
  type TeamForAssignment,
  type ConstraintScores,
} from '@/lib/urawaCupScheduleGenerator'
import type { Tournament } from '@/types'
import { TABS } from './constants'
import type {
  TabKey,
  EditFormState,
  TeamInfo,
  VenueInfo,
  MatchWithDetails,
  GenerateType,
  DeleteType,
  SelectedTeam,
  VenueApiResponse,
  TeamApiResponse,
  MatchApiResponse,
  TournamentWithConstraints,
  MutationError,
} from './types'

export function useMatchSchedule() {
  const queryClient = useQueryClient()
  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id || 1
  const [searchParams] = useSearchParams()

  // URLパラメータからタブを取得
  const initialTab = (searchParams.get('tab') as TabKey) || 'day1'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [selectedMatch, setSelectedMatch] = useState<MatchWithDetails | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateType, setGenerateType] = useState<GenerateType>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteType, setDeleteType] = useState<DeleteType>(null)
  const [editingMatch, setEditingMatch] = useState<MatchWithDetails | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [crossVenueSelectedTeam, setCrossVenueSelectedTeam] = useState<SelectedTeam | null>(null)

  // 大会情報を取得
  // 注意: Settings ページと同じクエリキーを共有するため、
  // キャッシュにsnake_case形式のデータが入っている可能性がある
  const { data: tournament, isLoading: isLoadingTournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const data = await tournamentsApi.getById(tournamentId)
      if (!data) return null
      // snake_case / camelCase 両方に対応（Settings ページとのキャッシュ共有時）
      const raw = data as Record<string, unknown>
      return {
        ...data,
        startDate: data.startDate || raw.start_date as string || '',
        endDate: data.endDate || raw.end_date as string || '',
        matchDuration: data.matchDuration || raw.match_duration as number || 50,
        intervalMinutes: data.intervalMinutes || raw.interval_minutes as number || 15,
        preliminaryStartTime: data.preliminaryStartTime || raw.preliminary_start_time as string || '09:00',
      } as Tournament
    },
    enabled: !!tournamentId,
  })

  // 会場一覧を取得
  const { data: venuesData } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: async () => {
      const data = await venuesApi.getAll(tournamentId)
      return (data || []).map((v: VenueApiResponse) => ({
        ...v,
        groupId: v.group_id,
        group_id: v.group_id,
        maxMatchesPerDay: v.max_matches_per_day,
        forPreliminary: v.for_preliminary,
        forFinalDay: v.for_final_day,
        isFinalsVenue: v.is_finals_venue,
      }))
    },
    enabled: !!tournamentId,
    staleTime: 0,
    refetchOnMount: true,
  })
  const venues: VenueInfo[] = Array.isArray(venuesData) ? venuesData : []

  // 大会形式
  const tournamentExt = tournament as (Tournament & TournamentWithConstraints) | undefined
  const useGroupSystem = tournamentExt?.use_group_system ?? true

  // DBから制約設定を読み込んでZustandストアに反映
  const setConstraintSettings = useConstraintSettingsStore(state => state.setSettings)
  useEffect(() => {
    if (tournamentExt) {
      if (tournamentExt.avoid_local_vs_local !== undefined || tournamentExt.avoid_same_region !== undefined || tournamentExt.avoid_same_league !== undefined) {
        setConstraintSettings({
          avoidLocalVsLocal: tournamentExt.avoid_local_vs_local ?? false,
          avoidSameRegion: tournamentExt.avoid_same_region ?? false,
          avoidSameLeague: tournamentExt.avoid_same_league ?? false,
          avoidConsecutive: tournamentExt.avoid_consecutive ?? true,
          warnDailyGameLimit: tournamentExt.warn_daily_game_limit ?? true,
          warnTotalGameLimit: tournamentExt.warn_total_game_limit ?? true,
        })
      }
    }
  }, [tournamentExt, setConstraintSettings])

  // チーム一覧を取得
  const teamsBackupRef = useRef<TeamApiResponse[]>([])
  const { data: teamsData } = useQuery({
    queryKey: ['teams', tournamentId],
    queryFn: async () => {
      const data = await teamsApi.getAll(tournamentId)
      return (data?.teams || []) as TeamApiResponse[]
    },
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (Array.isArray(teamsData) && teamsData.length > 0) {
      teamsBackupRef.current = teamsData
    }
  }, [teamsData])

  const allTeams: TeamInfo[] = useMemo(() => {
    const sourceData = (Array.isArray(teamsData) && teamsData.length > 0)
      ? teamsData
      : teamsBackupRef.current

    if (!Array.isArray(sourceData) || sourceData.length === 0) return []

    return sourceData.map((t: TeamApiResponse) => ({
      id: t.id,
      name: t.name,
      shortName: t.short_name,
      groupId: t.group_id,
      teamType: t.team_type,
      region: t.region,
      leagueId: t.league_id,
    }))
  }, [teamsData])

  // 試合一覧を取得
  const { data: matchData, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: async () => matchesApi.getAll(tournamentId),
    enabled: !!tournamentId,
  })

  // 試合データを変換
  const allMatches: MatchWithDetails[] = useMemo(() => {
    if (!matchData?.matches) return []
    return matchData.matches.map((m: MatchApiResponse) => ({
      ...m,
      matchDate: m.match_date,
      matchTime: m.match_time,
      venueId: m.venue_id,
      venue_id: m.venue_id,
      matchOrder: m.match_order,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeScoreTotal: m.home_score_total,
      awayScoreTotal: m.away_score_total,
      groupId: m.group_id,
      group_id: m.group_id,
    })) as MatchWithDetails[]
  }, [matchData])

  // 日付文字列を取得
  const getDateString = (dayOffset: number) => {
    if (!tournament?.startDate) return ''
    const startDate = new Date(tournament.startDate)
    const targetDate = new Date(startDate)
    targetDate.setDate(targetDate.getDate() + dayOffset)
    return targetDate.toISOString().split('T')[0]
  }

  // タブに対応する試合をフィルタリング
  const filteredMatches = useMemo(() => {
    if (!tournament || allMatches.length === 0) return []
    const tabInfo = TABS.find(t => t.key === activeTab)
    if (!tabInfo) return []
    const targetDateStr = getDateString(tabInfo.dayOffset)
    return allMatches.filter(match => match.matchDate === targetDateStr).sort((a, b) => {
      if (a.venueId !== b.venueId) return (a.venueId || 0) - (b.venueId || 0)
      return (a.matchOrder || 0) - (b.matchOrder || 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches, activeTab, tournament])

  // Day1とDay2の試合
  const day1Matches = useMemo(() => {
    if (!tournament?.startDate) return []
    const day1DateStr = getDateString(0)
    return allMatches.filter(m => m.matchDate === day1DateStr).sort((a, b) => {
      if (a.venueId !== b.venueId) return (a.venueId || 0) - (b.venueId || 0)
      return (a.matchOrder || 0) - (b.matchOrder || 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches, tournament])

  const day2Matches = useMemo(() => {
    if (!tournament?.startDate) return []
    const day2DateStr = getDateString(1)
    return allMatches.filter(m => m.matchDate === day2DateStr).sort((a, b) => {
      if (a.venueId !== b.venueId) return (a.venueId || 0) - (b.venueId || 0)
      return (a.matchOrder || 0) - (b.matchOrder || 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches, tournament])

  // 連戦チェック
  const consecutiveMatchTeams = useMemo(() => {
    const teamsWithConsecutive = new Set<number>()
    const checkDayMatches = (matches: MatchWithDetails[]) => {
      for (const groupId of ['A', 'B', 'C', 'D']) {
        const groupMatches = matches
          .filter(m => (m.groupId || m.group_id) === groupId)
          .sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
        const slotsByTeam: Record<number, number[]> = {}
        for (const match of groupMatches) {
          const homeId = match.homeTeamId || match.home_team_id
          const awayId = match.awayTeamId || match.away_team_id
          const slot = match.matchOrder || 0
          if (homeId) {
            if (!slotsByTeam[homeId]) slotsByTeam[homeId] = []
            slotsByTeam[homeId].push(slot)
          }
          if (awayId) {
            if (!slotsByTeam[awayId]) slotsByTeam[awayId] = []
            slotsByTeam[awayId].push(slot)
          }
        }
        for (const [teamId, slots] of Object.entries(slotsByTeam)) {
          const sortedSlots = [...slots].sort((a, b) => a - b)
          for (let i = 0; i < sortedSlots.length - 1; i++) {
            if (sortedSlots[i + 1] - sortedSlots[i] === 1) {
              teamsWithConsecutive.add(Number(teamId))
            }
          }
        }
      }
    }
    checkDayMatches(day1Matches)
    checkDayMatches(day2Matches)
    return teamsWithConsecutive
  }, [day1Matches, day2Matches])

  // 制約違反チェック
  const localVsLocalMatches = useMemo(() => {
    const matches: MatchWithDetails[] = []
    const check = (dayMatches: MatchWithDetails[]) => {
      for (const match of dayMatches) {
        const homeId = match.homeTeamId || match.home_team_id
        const awayId = match.awayTeamId || match.away_team_id
        const homeTeam = allTeams.find(t => t.id === homeId)
        const awayTeam = allTeams.find(t => t.id === awayId)
        if (homeTeam?.teamType === 'local' && awayTeam?.teamType === 'local') {
          matches.push(match)
        }
      }
    }
    check(day1Matches)
    check(day2Matches)
    return matches
  }, [day1Matches, day2Matches, allTeams])

  const sameRegionMatches = useMemo(() => {
    const matches: MatchWithDetails[] = []
    const check = (dayMatches: MatchWithDetails[]) => {
      for (const match of dayMatches) {
        const homeId = match.homeTeamId || match.home_team_id
        const awayId = match.awayTeamId || match.away_team_id
        const homeTeam = allTeams.find(t => t.id === homeId)
        const awayTeam = allTeams.find(t => t.id === awayId)
        if (homeTeam?.region && awayTeam?.region && homeTeam.region === awayTeam.region) {
          matches.push(match)
        }
      }
    }
    check(day1Matches)
    check(day2Matches)
    return matches
  }, [day1Matches, day2Matches, allTeams])

  const sameLeagueMatches = useMemo(() => {
    const matches: MatchWithDetails[] = []
    const check = (dayMatches: MatchWithDetails[]) => {
      for (const match of dayMatches) {
        const homeId = match.homeTeamId || match.home_team_id
        const awayId = match.awayTeamId || match.away_team_id
        const homeTeam = allTeams.find(t => t.id === homeId)
        const awayTeam = allTeams.find(t => t.id === awayId)
        if (homeTeam?.leagueId && awayTeam?.leagueId && homeTeam.leagueId === awayTeam.leagueId) {
          matches.push(match)
        }
      }
    }
    check(day1Matches)
    check(day2Matches)
    return matches
  }, [day1Matches, day2Matches, allTeams])

  const day1RepeatPairs = useMemo(() => {
    const day1Pairs = new Set<string>()
    for (const match of day1Matches) {
      const homeId = match.homeTeamId || match.home_team_id
      const awayId = match.awayTeamId || match.away_team_id
      if (homeId && awayId) {
        const pairKey = [homeId, awayId].sort((a, b) => a - b).join('-')
        day1Pairs.add(pairKey)
      }
    }
    const repeatMatches: MatchWithDetails[] = []
    for (const match of day2Matches) {
      const homeId = match.homeTeamId || match.home_team_id
      const awayId = match.awayTeamId || match.away_team_id
      if (homeId && awayId) {
        const pairKey = [homeId, awayId].sort((a, b) => a - b).join('-')
        if (day1Pairs.has(pairKey)) {
          repeatMatches.push(match)
        }
      }
    }
    return repeatMatches
  }, [day1Matches, day2Matches])

  // 各ステージの存在確認
  const hasPreliminaryMatches = useMemo(() => allMatches.some(m => m.stage === 'preliminary'), [allMatches])
  const hasFinalsMatches = useMemo(() => allMatches.some(m => m.stage === 'semifinal' || m.stage === 'third_place' || m.stage === 'final'), [allMatches])
  const hasTrainingMatches = useMemo(() => allMatches.some(m => m.stage === 'training'), [allMatches])
  const finalsMatches = useMemo(() => allMatches.filter(m => m.stage === 'semifinal' || m.stage === 'third_place' || m.stage === 'final'), [allMatches])

  // 予選リーグ日程生成ミューテーション
  const generatePreliminaryMutation = useMutation({
    mutationFn: async () => {
      // snake_case / camelCase 両方をチェック（Settings ページとのキャッシュ共有対策）
      const raw = tournament as Record<string, unknown> | undefined
      const startDate = tournament?.startDate || (raw?.start_date as string) || ''
      if (!startDate) {
        throw new Error('大会の開始日が設定されていません。大会設定を確認してください。')
      }
      const teamsResult = await teamsApi.getAll(tournamentId)
      const teams = teamsResult.teams || []
      const day1Date = startDate
      const day2DateObj = new Date(day1Date)
      day2DateObj.setDate(day2DateObj.getDate() + 1)
      const day2Date = day2DateObj.toISOString().split('T')[0]
      const venuesResult = await venuesApi.getAll(tournamentId)
      const fetchedVenues = venuesResult || []
      const preliminaryVenues = fetchedVenues.filter((v: VenueApiResponse) => v.for_preliminary === true)
      const targetVenues = preliminaryVenues.length > 0 ? preliminaryVenues : fetchedVenues
      const venueList = targetVenues.map((v: VenueApiResponse) => ({ id: v.id, name: v.name, groupId: v.group_id }))
      const tExt = tournament as Tournament & TournamentWithConstraints
      const scheduleConfig = {
        startTime: tournament.preliminaryStartTime || tExt.preliminary_start_time || '09:00',
        matchDuration: tournament.matchDuration || tExt.match_duration || 50,
        intervalMinutes: tournament.intervalMinutes || tExt.interval_minutes || 15,
        matchesPerTeamPerDay: tExt.matches_per_team_per_day || 2,
      }

      let result
      const teamInfoList: ScheduleTeamInfo[] = []
      let validationErrors: string[] = []

      if (!useGroupSystem) {
        if (teams.length < 2) throw new Error('チームが2チーム以上必要です')
        const constraintScores: ConstraintScores = { alreadyPlayed: 200, sameLeague: 100, sameRegion: 50, localTeams: 30 }
        const teamsForAssignment: TeamForAssignment[] = teams.map((t: TeamApiResponse) => ({
          id: t.id, name: t.name, shortName: t.short_name, region: t.region, leagueId: t.league_id, teamType: t.team_type,
        }))
        const venueIds = targetVenues.map((v: VenueApiResponse) => v.id)
        const teamsPerVenue = 4
        const day1OptResult = generateOptimalVenueAssignment(teamsForAssignment, venueIds, teamsPerVenue, constraintScores, undefined, 5)
        const day2OptResult = generateOptimalVenueAssignment(teamsForAssignment, venueIds, teamsPerVenue, constraintScores, day1OptResult.assignments, 5)
        const optimizationWarnings: string[] = []
        if (day1OptResult.details.sameLeaguePairs > 0) optimizationWarnings.push(`Day1: 同リーグペア ${day1OptResult.details.sameLeaguePairs}組`)
        if (day1OptResult.details.sameRegionPairs > 0) optimizationWarnings.push(`Day1: 同地域ペア ${day1OptResult.details.sameRegionPairs}組`)
        if (day1OptResult.details.localVsLocalPairs > 0) optimizationWarnings.push(`Day1: 地元同士 ${day1OptResult.details.localVsLocalPairs}組`)
        if (day2OptResult.details.sameLeaguePairs > 0) optimizationWarnings.push(`Day2: 同リーグペア ${day2OptResult.details.sameLeaguePairs}組`)
        if (day2OptResult.details.sameRegionPairs > 0) optimizationWarnings.push(`Day2: 同地域ペア ${day2OptResult.details.sameRegionPairs}組`)
        if (day2OptResult.details.localVsLocalPairs > 0) optimizationWarnings.push(`Day2: 地元同士 ${day2OptResult.details.localVsLocalPairs}組`)
        if (day2OptResult.details.day1RepeatPairs > 0) optimizationWarnings.push(`Day2: Day1再戦ペア ${day2OptResult.details.day1RepeatPairs}組（避けられず）`)
        const venueNames = new Map<number, string>()
        targetVenues.forEach((v: VenueApiResponse) => venueNames.set(v.id, v.name))
        const day1AssignmentInfos = convertToVenueAssignmentInfos(day1OptResult.assignments, venueNames, 1)
        const day2AssignmentInfos = convertToVenueAssignmentInfos(day2OptResult.assignments, venueNames, 2)
        await venueAssignmentApi.deleteByTournament(tournamentId)
        const day1DbAssignments = day1AssignmentInfos.map((a) => ({ tournament_id: tournamentId, venue_id: a.venueId, team_id: a.teamId, match_day: 1, slot_order: a.slotOrder }))
        if (day1DbAssignments.length > 0) await venueAssignmentApi.bulkInsert(day1DbAssignments)
        const day2DbAssignments = day2AssignmentInfos.map((a) => ({ tournament_id: tournamentId, venue_id: a.venueId, team_id: a.teamId, match_day: 2, slot_order: a.slotOrder }))
        if (day2DbAssignments.length > 0) await venueAssignmentApi.bulkInsert(day2DbAssignments)
        result = generateVenueBasedSchedule(day1AssignmentInfos, day2AssignmentInfos, venueList, day1Date, day2Date, scheduleConfig)
        if (!result.success || result.matches.length === 0) throw new Error('日程生成に失敗しました: ' + result.warnings.join(', '))
        result.warnings = [...result.warnings, ...optimizationWarnings]
        if (optimizationWarnings.length > 0) optimizationWarnings.forEach(w => toast(w, { icon: '⚠️', duration: 4000 }))
      } else {
        const groupTeams = teams.filter((t: TeamApiResponse) => t.group_id) as (TeamApiResponse & { group_id: string })[]
        if (groupTeams.length === 0) throw new Error('グループに所属するチームが登録されていません')
        const groupedTeams: Record<string, (TeamApiResponse & { group_id: string })[]> = {}
        for (const team of groupTeams) {
          const groupId = team.group_id
          if (!groupedTeams[groupId]) groupedTeams[groupId] = []
          groupedTeams[groupId].push(team)
        }
        for (const [groupId, gTeams] of Object.entries(groupedTeams)) {
          gTeams.sort((a, b) => (a.seed_number || a.id) - (b.seed_number || b.id))
          gTeams.forEach((team, index) => {
            teamInfoList.push({ id: team.id, name: team.name, shortName: team.short_name, groupId: groupId, seedNumber: team.seed_number || (index + 1) })
          })
        }
        result = generateUrawaCupSchedule(teamInfoList, venueList, day1Date, day2Date, scheduleConfig)
        if (!result.success || result.matches.length === 0) throw new Error('日程生成に失敗しました: ' + result.warnings.join(', '))
        validationErrors = validateSchedule(result.matches, teamInfoList)
        const consecutiveWarnings = checkConsecutiveMatches(result.matches)
        if (consecutiveWarnings.length > 0) validationErrors = [...validationErrors, ...consecutiveWarnings]
      }

      await matchApi.deleteByStage(tournamentId, 'preliminary')
      await standingApi.clearStandings(tournamentId)
      const matchesToInsert = result.matches.map((m, index) => ({
        tournament_id: tournamentId, group_id: m.groupId, home_team_id: m.homeTeamId, away_team_id: m.awayTeamId,
        venue_id: m.venueId, match_date: m.matchDate, match_time: m.matchTime, match_order: index + 1, stage: 'preliminary', status: 'scheduled', is_b_match: 'isBMatch' in m ? (m as { isBMatch?: boolean }).isBMatch || false : false,
      }))
      await matchApi.bulkInsert(matchesToInsert)
      return { created: matchesToInsert.length, warnings: [...result.warnings, ...validationErrors] }
    },
    onSuccess: (data) => {
      toast.success(`予選リーグ ${data.created}試合を生成しました`)
      if (data.warnings?.length) data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }))
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['standings'] })
      queryClient.invalidateQueries({ queryKey: ['public-standings'] })
      queryClient.invalidateQueries({ queryKey: ['overall-standings'] })
      queryClient.invalidateQueries({ queryKey: ['public-overall-standings'] })
      setShowGenerateModal(false)
    },
    onError: (error: MutationError) => toast.error(error.message || '日程生成に失敗しました'),
  })

  // 最終日生成（決勝トーナメント＋研修試合を同時生成）
  const generateFinalsMutation = useMutation({
    mutationFn: async (options?: { qualificationRule?: 'group_based' | 'overall_ranking' }) => {
      const createdMatches = await finalDayApi.generateFinalDaySchedule(tournamentId, options)
      return { created: createdMatches.length, warnings: [] as string[] }
    },
    onSuccess: (data) => {
      toast.success(`最終日 ${data.created}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: MutationError) => toast.error(error.message || '日程生成に失敗しました'),
  })

  // 研修試合生成
  const generateTrainingMutation = useMutation({
    mutationFn: async () => {
      const createdMatches = await finalDayApi.generateTrainingMatches(tournamentId)
      return { created: createdMatches.length, warnings: [] as string[] }
    },
    onSuccess: (data) => {
      toast.success(`研修試合 ${data.created}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: MutationError) => toast.error(error.message || '日程生成に失敗しました'),
  })

  // 日程削除
  const deleteMatchesMutation = useMutation({
    mutationFn: async (stage: 'preliminary' | 'finals' | 'training' | 'all') => {
      if (stage === 'finals') {
        // 最終日削除: 決勝トーナメント＋研修試合を両方削除
        const r1 = await matchApi.deleteByStage(tournamentId, 'finals')
        const r2 = await matchApi.deleteByStage(tournamentId, 'training')
        return { deleted: (r1.deleted || 0) + (r2.deleted || 0), stage }
      }
      const result = await matchApi.deleteByStage(tournamentId, stage)
      if (stage === 'preliminary' || stage === 'all') {
        await standingApi.clearStandings(tournamentId)
        await standingApi.recalculateAll(tournamentId)
      }
      return { deleted: result.deleted, stage }
    },
    onSuccess: (data) => {
      const stageLabel = data.stage === 'preliminary' ? '予選リーグ' : data.stage === 'finals' ? '最終日' : data.stage === 'training' ? '研修試合' : '全試合'
      toast.success(`${stageLabel}の日程を削除しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      if (data.stage === 'preliminary' || data.stage === 'all') {
        queryClient.invalidateQueries({ queryKey: ['standings'] })
        queryClient.invalidateQueries({ queryKey: ['public-standings'] })
        queryClient.invalidateQueries({ queryKey: ['overall-standings'] })
        queryClient.invalidateQueries({ queryKey: ['public-overall-standings'] })
      }
      setShowDeleteModal(false)
      setDeleteType(null)
    },
    onError: (error: MutationError) => toast.error(error.message || '削除に失敗しました'),
  })

  // 組み合わせ更新（準決勝結果から3位決定戦・決勝を更新）
  const updateBracketMutation = useMutation({
    mutationFn: async () => {
      return await finalDayApi.updateFinalsBracket(tournamentId)
    },
    onSuccess: () => {
      toast.success('組み合わせを更新しました')
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
    },
    onError: (error: MutationError) => toast.error(error?.message || '組み合わせ更新に失敗しました'),
  })

  // 試合情報更新
  const updateMatchMutation = useMutation({
    mutationFn: async (data: { matchId: number; matchDate: string; matchTime: string; venueId: number; matchOrder: number }) => {
      return await matchesApi.update(data.matchId, { match_date: data.matchDate, match_time: data.matchTime, venue_id: data.venueId, match_order: data.matchOrder })
    },
    onSuccess: () => {
      toast.success('日程を更新しました')
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setEditingMatch(null)
      setEditForm(null)
    },
    onError: (error: MutationError) => toast.error(error?.message || '更新に失敗しました'),
  })

  // チーム入れ替え
  const swapTeamsMutation = useMutation({
    mutationFn: async (data: { matchId: number; homeTeamId: number; awayTeamId: number }) => {
      return await matchesApi.update(data.matchId, { home_team_id: data.homeTeamId, away_team_id: data.awayTeamId })
    },
    onError: (error: MutationError) => toast.error(error?.message || '更新に失敗しました'),
  })

  // 組み合わせ一括更新
  const bulkUpdateMatchesMutation = useMutation({
    mutationFn: async (changes: { matchId: number; homeTeamId: number; awayTeamId: number; refereeTeamIds?: number[] }[]) => {
      for (const change of changes) {
        await matchesApi.update(change.matchId, { home_team_id: change.homeTeamId, away_team_id: change.awayTeamId })
      }
      return { updated: changes.length }
    },
    onSuccess: (data) => {
      toast.success(`${data.updated}件の組み合わせを更新しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
    },
    onError: (error: MutationError) => toast.error(error?.message || '更新に失敗しました'),
  })

  // ハンドラー
  const swappingRef = useRef<Set<number>>(new Set())

  const handleSwapTeams = async (matchId: number, homeTeamId: number, awayTeamId: number) => {
    if (swappingRef.current.has(matchId)) return
    swappingRef.current.add(matchId)
    try {
      await swapTeamsMutation.mutateAsync({ matchId, homeTeamId, awayTeamId })
      await queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('組み合わせを更新しました')
    } finally {
      setTimeout(() => swappingRef.current.delete(matchId), 500)
    }
  }

  const handleEditorSave = async (changes: { matchId: number; homeTeamId: number; awayTeamId: number; refereeTeamIds?: number[] }[]) => {
    await bulkUpdateMatchesMutation.mutateAsync(changes)
  }

  const startEditing = (match: MatchWithDetails) => {
    setEditingMatch(match)
    setEditForm({ matchDate: match.matchDate, matchTime: match.matchTime, venueId: match.venueId, matchOrder: match.matchOrder || 1 })
  }

  const saveEdit = () => {
    if (!editingMatch || !editForm) return
    updateMatchMutation.mutate({ matchId: editingMatch.id, ...editForm })
  }

  const openGenerateModal = (type: 'preliminary' | 'finals' | 'training') => {
    setGenerateType(type)
    setShowGenerateModal(true)
  }

  const openDeleteModal = (type: 'preliminary' | 'finals' | 'training' | 'all') => {
    setDeleteType(type)
    setShowDeleteModal(true)
  }

  const handleDelete = () => {
    if (deleteType) deleteMatchesMutation.mutate(deleteType)
  }

  const handleGenerate = (options?: { qualificationRule?: 'group_based' | 'overall_ranking' }) => {
    switch (generateType) {
      case 'preliminary': generatePreliminaryMutation.mutate(); break
      case 'finals': generateFinalsMutation.mutate(options); break
      case 'training': generateTrainingMutation.mutate(); break
    }
  }

  const getVenueName = (venueId: number) => venues.find(v => v.id === venueId)?.name || `会場${venueId}`

  // 組み合わせインポート
  const [showImportModal, setShowImportModal] = useState(false)

  const importMatchesMutation = useMutation({
    mutationFn: async (csv: string) => {
      const lines = csv.trim().split('\n')
      if (lines.length < 2) throw new Error('データ行がありません')

      // チーム名→IDマップ（名前・略称の両方で検索可能に）
      const teamsResult = await teamsApi.getAll(tournamentId)
      const teams = (teamsResult.teams || []) as Array<{
        id: number; name: string; short_name?: string | null; group_id?: string | null
      }>
      const findTeam = (name: string) => {
        const n = name.trim()
        return teams.find(t =>
          t.name === n || t.short_name === n ||
          t.name.includes(n) || n.includes(t.name) ||
          (t.short_name && (t.short_name.includes(n) || n.includes(t.short_name)))
        )
      }

      // 会場名→IDマップ（見つからない場合は自動作成）
      const venuesResult = await venuesApi.getAll(tournamentId)
      const venuesList = (venuesResult || []) as Array<{ id: number; name: string }>
      const createdVenueNames: string[] = []
      const findVenue = (name: string) => {
        const n = name.trim()
        return venuesList.find(v =>
          v.name === n || v.name.includes(n) || n.includes(v.name)
        )
      }
      const findOrCreateVenue = async (name: string): Promise<{ id: number; name: string } | null> => {
        const existing = findVenue(name)
        if (existing) return existing
        // 自動作成
        try {
          const { data, error } = await supabase
            .from('venues')
            .insert({
              tournament_id: tournamentId,
              name: name.trim(),
              for_preliminary: true,
              for_final_day: false,
              is_finals_venue: false,
              max_matches_per_day: 6,
            } as never)
            .select()
            .single()
          if (error) return null
          const created = data as { id: number; name: string }
          venuesList.push(created)
          createdVenueNames.push(created.name)
          return created
        } catch {
          return null
        }
      }

      const errors: string[] = []
      const matchesToInsert: Array<{
        tournament_id: number
        group_id?: string | null
        home_team_id: number
        away_team_id: number
        venue_id: number
        match_date: string
        match_time: string
        match_order: number
        stage: string
        status: string
        is_b_match?: boolean
      }> = []

      // 会場+日付ごとの試合順序カウンター
      const orderCounters: Record<string, number> = {}

      const dataLines = lines.slice(1)
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim()
        if (!line) continue
        const cols = line.split(',').map(c => c.trim())
        if (cols.length < 5) {
          errors.push(`${i + 2}行目: カラム不足（${cols.length}列、5列以上必要）`)
          continue
        }

        const [dateStr, timeStr, venueName, homeName, awayName] = cols
        const groupId = cols[5] || ''
        const bMatchFlag = (cols[6] || '').trim().toUpperCase()
        const isBMatch = bMatchFlag === 'B' || bMatchFlag === '1' || bMatchFlag === 'TRUE' || bMatchFlag === 'B戦'
        const stageStr = (cols[7] || '').trim()

        // 日付バリデーション
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          errors.push(`${i + 2}行目: 日付形式が不正「${dateStr}」(YYYY-MM-DD)`)
          continue
        }

        // 時間正規化
        let matchTime = timeStr
        if (/^\d{1,2}:\d{2}$/.test(matchTime)) {
          const [h, m] = matchTime.split(':')
          matchTime = `${h.padStart(2, '0')}:${m}`
        }
        if (!/^\d{2}:\d{2}/.test(matchTime)) {
          errors.push(`${i + 2}行目: 時間形式が不正「${timeStr}」(HH:mm)`)
          continue
        }

        const venue = await findOrCreateVenue(venueName)
        if (!venue) {
          errors.push(`${i + 2}行目: 会場「${venueName}」の作成に失敗しました`)
          continue
        }

        // チーム未定（TBD）対応: 空欄やTBDの場合はnull
        const homeTbd = !homeName || homeName === 'TBD' || homeName === '未定'
        const awayTbd = !awayName || awayName === 'TBD' || awayName === '未定'

        const homeTeam = homeTbd ? null : findTeam(homeName)
        if (!homeTbd && !homeTeam) {
          errors.push(`${i + 2}行目: ホームチーム「${homeName}」が見つかりません`)
          continue
        }

        const awayTeam = awayTbd ? null : findTeam(awayName)
        if (!awayTbd && !awayTeam) {
          errors.push(`${i + 2}行目: アウェイチーム「${awayName}」が見つかりません`)
          continue
        }

        // ステージ解決
        const stageMap: Record<string, string> = {
          '予選': 'preliminary', '準決勝': 'semifinal', 'SF': 'semifinal',
          '3位決': 'third_place', '3決': 'third_place',
          '決勝': 'final', 'F': 'final',
          '研修': 'training',
        }
        const resolvedStage = stageMap[stageStr] || (stageStr && ['preliminary','semifinal','third_place','final','training'].includes(stageStr) ? stageStr : 'preliminary')

        // match_order: 会場+日付ごとに連番
        const orderKey = `${venue.id}-${dateStr}`
        orderCounters[orderKey] = (orderCounters[orderKey] || 0) + 1

        // グループID: CSV指定（1文字のみ有効） > チームのgroup_id
        const resolvedGroup = (groupId.length === 1 ? groupId : '') || homeTeam?.group_id || null

        matchesToInsert.push({
          tournament_id: tournamentId,
          group_id: resolvedGroup,
          home_team_id: homeTeam?.id ?? null as unknown as number,
          away_team_id: awayTeam?.id ?? null as unknown as number,
          venue_id: venue.id,
          match_date: dateStr,
          match_time: matchTime,
          match_order: orderCounters[orderKey],
          stage: resolvedStage,
          status: 'scheduled',
          is_b_match: isBMatch,
        })
      }

      if (errors.length > 0 && matchesToInsert.length === 0) {
        throw new Error(`全行エラー:\n${errors.join('\n')}`)
      }

      if (matchesToInsert.length > 0) {
        await matchApi.bulkInsert(matchesToInsert)
      }

      return { created: matchesToInsert.length, errors, createdVenues: createdVenueNames }
    },
    onSuccess: (data) => {
      let msg = `${data.created}試合をインポートしました`
      if (data.createdVenues.length > 0) {
        msg += `\n会場を自動作成: ${data.createdVenues.join(', ')}`
      }
      toast.success(msg, { duration: 5000 })
      if (data.errors.length > 0) {
        toast.error(`${data.errors.length}件のエラー:\n${data.errors.slice(0, 5).join('\n')}`, { duration: 8000 })
      }
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      if (data.createdVenues.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['venues', tournamentId] })
      }
      setShowImportModal(false)
    },
    onError: (error: Error) => {
      toast.error(`インポート失敗: ${error.message}`)
    },
  })

  const isGenerating = generatePreliminaryMutation.isPending || generateFinalsMutation.isPending || generateTrainingMutation.isPending
  const isDeleting = deleteMatchesMutation.isPending
  const isImporting = importMatchesMutation.isPending
  const isLoading = isLoadingTournament || isLoadingMatches

  return {
    // State
    activeTab, setActiveTab,
    selectedMatch, setSelectedMatch,
    showGenerateModal, setShowGenerateModal,
    generateType, setGenerateType,
    showDeleteModal, setShowDeleteModal,
    deleteType, setDeleteType,
    editingMatch, setEditingMatch,
    editForm, setEditForm,
    isEditMode, setIsEditMode,
    crossVenueSelectedTeam, setCrossVenueSelectedTeam,
    showImportModal, setShowImportModal,

    // Data
    tournament, tournamentId,
    venues, allTeams, allMatches,
    filteredMatches, day1Matches, day2Matches,
    finalsMatches,
    useGroupSystem,

    // Computed
    consecutiveMatchTeams,
    localVsLocalMatches, sameRegionMatches, sameLeagueMatches, day1RepeatPairs,
    hasPreliminaryMatches, hasFinalsMatches, hasTrainingMatches,

    // Status
    isLoading, isGenerating, isDeleting, isImporting,
    isUpdatingMatch: updateMatchMutation.isPending,
    isUpdatingBracket: updateBracketMutation.isPending,
    isBulkUpdating: bulkUpdateMatchesMutation.isPending,

    // Handlers
    handleSwapTeams, handleEditorSave,
    startEditing, saveEdit,
    openGenerateModal, openDeleteModal,
    handleDelete, handleGenerate,
    handleImportMatches: (csv: string) => importMatchesMutation.mutate(csv),
    getVenueName, getDateString,
  }
}
