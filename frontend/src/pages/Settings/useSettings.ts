// src/pages/Settings/useSettings.ts
/**
 * Settings ページのカスタムフック
 * 状態管理とデータ操作ロジックを集約
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { leaguesApi, regionsApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import type {
  TournamentForm,
  VenueForm,
  AddVenueForm,
  NewTournamentForm,
  Venue,
  Team as SettingsTeam,
  Tournament,
} from './types'
import {
  DEFAULT_TOURNAMENT_FORM,
  DEFAULT_VENUE_FORM,
  DEFAULT_ADD_VENUE_FORM,
  DEFAULT_NEW_TOURNAMENT_FORM,
} from './constants'

/**
 * Tournament データから TournamentForm に変換
 */
function tournamentToForm(tournament: Tournament): TournamentForm {
  return {
    name: tournament.name || '',
    year: tournament.year || new Date().getFullYear(),
    startDate: tournament.start_date || '',
    endDate: tournament.end_date || '',
    gameMinutes: tournament.game_minutes ?? 20,
    intervalMinutes: tournament.interval_minutes ?? 5,
    useGroupSystem: tournament.use_group_system ?? true,
    teamsPerGroup: tournament.teams_per_group ?? 6,
    matchesPerTeam: tournament.matches_per_team ?? 4,
    pointsForWin: tournament.points_for_win ?? 3,
    pointsForDraw: tournament.points_for_draw ?? 1,
    pointsForLoss: tournament.points_for_loss ?? 0,
    description: tournament.description || '',
    isSingleLeague: tournament.is_single_league ?? false,
    singleLeagueTeamCount: tournament.single_league_team_count ?? 8,
    singleLeagueMatchesPerTeam: tournament.single_league_matches_per_team ?? 7,
    finalsStartTime: tournament.finals_start_time || '09:00',
    finalsDay: tournament.finals_day ?? 2,
    preliminaryStartTime: tournament.preliminary_start_time || '09:00',
    finalsMatchDuration: tournament.finals_match_duration ?? 25,
    finalsIntervalMinutes: tournament.finals_interval_minutes ?? 5,
    dayEndTime: tournament.day_end_time || '17:00',
    day2StartTime: tournament.day2_start_time || '09:00',
    day2EndTime: tournament.day2_end_time || '17:00',
    lunchBreakStart: tournament.lunch_break_start || '12:00',
    lunchBreakEnd: tournament.lunch_break_end || '13:00',
    enableLunchBreak: tournament.enable_lunch_break ?? true,
    venue_per_group: tournament.venue_per_group ?? true,
  }
}

export function useSettings() {
  const queryClient = useQueryClient()
  const { currentTournament, setCurrentTournament } = useAppStore()
  const selectedTournamentId = currentTournament?.id ?? null

  // Form state
  const [tournamentForm, setTournamentForm] = useState<TournamentForm>(DEFAULT_TOURNAMENT_FORM)
  const [venueForm, setVenueForm] = useState<VenueForm>(DEFAULT_VENUE_FORM)
  const [addVenueForm, setAddVenueForm] = useState<AddVenueForm>(DEFAULT_ADD_VENUE_FORM)
  const [newTournamentForm, setNewTournamentForm] = useState<NewTournamentForm>(DEFAULT_NEW_TOURNAMENT_FORM)

  // Modal state
  const [showVenueModal, setShowVenueModal] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [showNewTournamentModal, setShowNewTournamentModal] = useState(false)
  const [showAddVenueModal, setShowAddVenueModal] = useState(false)
  const [showLocalTeamModal, setShowLocalTeamModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showLeagueModal, setShowLeagueModal] = useState(false)

  // Other state
  const [newRegion, setNewRegion] = useState('')
  const [newLeague, setNewLeague] = useState('')

  // Queries
  const { data: teamsData } = useQuery<SettingsTeam[]>({
    queryKey: ['teams', selectedTournamentId],
    queryFn: async () => {
      if (!selectedTournamentId) return []
      const { data, error } = await supabase
        .from('teams')
        .select('*, regions(name)')
        .eq('tournament_id', selectedTournamentId)
        .order('group_id')
        .order('seed_number')
      if (error) throw error
      interface TeamRow {
        id: number
        name: string
        short_name: string | null
        group_id: string | null
        seed_number: number | null
        is_local: boolean
        region_id: number | null
        league_id: number | null
        regions?: { name: string } | null
        [key: string]: unknown
      }
      return (data || []).map((t: TeamRow): SettingsTeam => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        group_id: t.group_id,
        seed_number: t.seed_number,
        is_local: t.is_local,
        region_id: t.region_id,
        league_id: t.league_id,
        region_name: t.regions?.name,
      }))
    },
    enabled: !!selectedTournamentId,
  })

  const { data: leaguesData } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => leaguesApi.getAll(),
  })

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll(),
  })

  const { data: tournament } = useQuery<Tournament | null>({
    queryKey: ['tournament', selectedTournamentId],
    queryFn: async () => {
      if (!selectedTournamentId) return null
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', selectedTournamentId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!selectedTournamentId,
  })

  const { data: venues } = useQuery<Venue[]>({
    queryKey: ['venues', selectedTournamentId],
    queryFn: async () => {
      if (!selectedTournamentId) return []
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('tournament_id', selectedTournamentId)
        .order('name')
      if (error) throw error
      return data || []
    },
    enabled: !!selectedTournamentId,
  })

  const { data: tournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, year')
        .order('year', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Effect to sync tournament data to form
  useEffect(() => {
    if (tournament) {
      setTournamentForm(tournamentToForm(tournament))
    }
  }, [tournament])

  // Helper to set selected tournament
  const setSelectedTournamentId = useCallback((id: number | null) => {
    if (id === null) {
      setCurrentTournament(null)
    } else {
      const found = (tournaments as unknown as { id: number }[] | undefined)?.find(t => t.id === id)
      if (found) {
        setCurrentTournament(found as unknown as import('@/shared/types').Tournament)
      }
    }
  }, [tournaments, setCurrentTournament])

  // Mutations
  const updateTournamentMutation = useMutation({
    mutationFn: async (form: TournamentForm) => {
      if (!selectedTournamentId) throw new Error('大会が選択されていません')
      // schema.sql に存在する確実なカラムのみ
      const coreData: Record<string, unknown> = {
          name: form.name,
          year: form.year,
          interval_minutes: form.intervalMinutes,
          use_group_system: form.useGroupSystem,
          teams_per_group: form.teamsPerGroup,
          preliminary_start_time: form.preliminaryStartTime,
          finals_start_time: form.finalsStartTime,
          finals_match_duration: form.finalsMatchDuration,
          finals_interval_minutes: form.finalsIntervalMinutes,
      }
      if (form.startDate) coreData.start_date = form.startDate
      if (form.endDate) coreData.end_date = form.endDate

      const { error } = await supabase
        .from('tournaments')
        .update(coreData as never)
        .eq('id', selectedTournamentId)
      if (error) throw error

      // 追加カラム（DBに存在しない場合もエラーにしない）
      try {
        await supabase
          .from('tournaments')
          .update({
            game_minutes: form.gameMinutes,
            matches_per_team: form.matchesPerTeam,
            points_for_win: form.pointsForWin,
            points_for_draw: form.pointsForDraw,
            points_for_loss: form.pointsForLoss,
            description: form.description,
            is_single_league: form.isSingleLeague,
            single_league_team_count: form.singleLeagueTeamCount,
            single_league_matches_per_team: form.singleLeagueMatchesPerTeam,
            finals_day: form.finalsDay,
            day_end_time: form.dayEndTime,
            day2_start_time: form.day2StartTime,
            day2_end_time: form.day2EndTime,
            lunch_break_start: form.lunchBreakStart,
            lunch_break_end: form.lunchBreakEnd,
            enable_lunch_break: form.enableLunchBreak,
            venue_per_group: form.venue_per_group,
          } as never)
          .eq('id', selectedTournamentId)
      } catch {
        // 追加カラムが未作成の場合は無視
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', selectedTournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
    },
  })

  const createTournamentMutation = useMutation({
    mutationFn: async (form: NewTournamentForm) => {
      if (!form.startDate || !form.endDate) {
        throw new Error('開始日と終了日は必須です')
      }
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: form.name,
          year: form.year,
          start_date: form.startDate,
          end_date: form.endDate,
          description: form.description,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      setCurrentTournament(data as unknown as import('@/shared/types').Tournament)
      setShowNewTournamentModal(false)
      setNewTournamentForm(DEFAULT_NEW_TOURNAMENT_FORM)
    },
  })

  const updateVenueMutation = useMutation({
    mutationFn: async (form: VenueForm & { id: number }) => {
      // 基本フィールド
      const { error } = await supabase
        .from('venues')
        .update({
          name: form.name,
          address: form.address,
          notes: form.notes,
          group_id: form.assigned_group || null,
        } as never)
        .eq('id', form.id)
      if (error) throw error

      // 追加フィールド（カラムが存在しなくてもモーダルは閉じる）
      try {
        await supabase
          .from('venues')
          .update({
            capacity: form.capacity,
            ground_name: form.groundName || null,
            ground_name_day2: form.groundNameDay2 || null,
            for_preliminary: form.forPreliminary,
            for_final_day: form.forFinalDay,
            is_finals_venue: form.isFinalsVenue,
            is_mixed_use: form.isMixedUse,
            finals_match_count: form.finalsMatchCount,
          } as never)
          .eq('id', form.id)
      } catch (e) {
        console.warn('追加フィールドの保存に失敗（カラム未作成の可能性）:', e)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', selectedTournamentId] })
    },
  })

  const addVenueMutation = useMutation({
    mutationFn: async (form: AddVenueForm) => {
      if (!selectedTournamentId) throw new Error('大会が選択されていません')
      const { error } = await supabase.from('venues').insert({
        tournament_id: selectedTournamentId,
        name: form.name,
        address: form.address,
        notes: form.notes,
        capacity: form.capacity,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', selectedTournamentId] })
      setShowAddVenueModal(false)
      setAddVenueForm(DEFAULT_ADD_VENUE_FORM)
    },
  })

  const deleteVenueMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('venues').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', selectedTournamentId] })
      setShowVenueModal(false)
      setSelectedVenue(null)
    },
  })

  const updateTeamTypeMutation = useMutation({
    mutationFn: async ({ teamId, isLocal }: { teamId: number; isLocal: boolean }) => {
      const { error } = await supabase
        .from('teams')
        .update({ is_local: isLocal } as never)
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', selectedTournamentId] })
    },
  })

  const updateTeamRegionMutation = useMutation({
    mutationFn: async ({ teamId, regionName }: { teamId: number; regionName: string | null }) => {
      let regionId = null
      if (regionName) {
        interface RegionData { name: string; id: number }
        const region = (regionsData as RegionData[] | undefined)?.find((r) => r.name === regionName)
        regionId = region?.id ?? null
      }
      const { error } = await supabase
        .from('teams')
        .update({ region_id: regionId } as never)
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', selectedTournamentId] })
    },
  })

  const updateTeamLeagueMutation = useMutation({
    mutationFn: async ({ teamId, leagueId }: { teamId: number; leagueId: number | null }) => {
      const { error } = await supabase
        .from('teams')
        .update({ league_id: leagueId } as never)
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', selectedTournamentId] })
    },
  })

  const addRegionMutation = useMutation({
    mutationFn: (name: string) => regionsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const deleteRegionMutation = useMutation({
    mutationFn: (id: number) => regionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const addLeagueMutation = useMutation({
    mutationFn: (name: string) => leaguesApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })

  const deleteLeagueMutation = useMutation({
    mutationFn: (id: number) => leaguesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })

  // Handlers
  const handleSaveTournament = useCallback(() => {
    updateTournamentMutation.mutate(tournamentForm)
  }, [tournamentForm, updateTournamentMutation])

  const handleCreateTournament = useCallback(() => {
    createTournamentMutation.mutate(newTournamentForm)
  }, [newTournamentForm, createTournamentMutation])

  const handleOpenVenueModal = useCallback((venue: Venue) => {
    setSelectedVenue(venue)
    setVenueForm({
      name: venue.name,
      address: venue.address || '',
      capacity: venue.capacity,
      groundName: venue.ground_name || '',
      groundNameDay2: venue.ground_name_day2 || '',
      notes: venue.notes || '',
      assigned_group: venue.assigned_group || '',
      forPreliminary: venue.for_preliminary ?? true,
      forFinalDay: venue.for_final_day ?? false,
      isFinalsVenue: venue.is_finals_venue ?? false,
      isMixedUse: venue.is_mixed_use ?? false,
      finalsMatchCount: venue.finals_match_count ?? 1,
    })
    setShowVenueModal(true)
  }, [])

  const handleSaveVenue = useCallback(() => {
    if (!selectedVenue) return
    const formData = { ...venueForm, id: selectedVenue.id }
    setShowVenueModal(false)
    setSelectedVenue(null)
    updateVenueMutation.mutate(formData)
  }, [selectedVenue, venueForm, updateVenueMutation])

  const handleDeleteVenue = useCallback(() => {
    if (!selectedVenue) return
    if (window.confirm(`会場「${selectedVenue.name}」を削除しますか？`)) {
      deleteVenueMutation.mutate(selectedVenue.id)
    }
  }, [selectedVenue, deleteVenueMutation])

  const handleAddVenue = useCallback(() => {
    addVenueMutation.mutate(addVenueForm)
  }, [addVenueForm, addVenueMutation])

  return {
    // State
    tournamentForm,
    setTournamentForm,
    venueForm,
    setVenueForm,
    addVenueForm,
    setAddVenueForm,
    newTournamentForm,
    setNewTournamentForm,
    selectedVenue,
    newRegion,
    setNewRegion,
    newLeague,
    setNewLeague,

    // Modal state
    showVenueModal,
    setShowVenueModal,
    showNewTournamentModal,
    setShowNewTournamentModal,
    showAddVenueModal,
    setShowAddVenueModal,
    showLocalTeamModal,
    setShowLocalTeamModal,
    showRegionModal,
    setShowRegionModal,
    showLeagueModal,
    setShowLeagueModal,

    // Data
    teamsData,
    leaguesData,
    regionsData,
    tournament,
    venues,
    tournaments,
    selectedTournamentId,
    setSelectedTournamentId,

    // Mutations
    updateTournamentMutation,
    createTournamentMutation,
    updateVenueMutation,
    addVenueMutation,
    deleteVenueMutation,
    updateTeamTypeMutation,
    updateTeamRegionMutation,
    updateTeamLeagueMutation,
    addRegionMutation,
    deleteRegionMutation,
    addLeagueMutation,
    deleteLeagueMutation,

    // Handlers
    handleSaveTournament,
    handleCreateTournament,
    handleOpenVenueModal,
    handleSaveVenue,
    handleDeleteVenue,
    handleAddVenue,
  }
}
