/**
 * 設定画面
 * 大会設定・会場設定・選手管理
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { tournamentsApi, venuesApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import type { Venue, Tournament } from '@/types'
import { useCreateVenue } from '@/features/venues/hooks'
import { useCreateTournament } from '@/features/tournaments/hooks'
import { useAppStore } from '@/stores/appStore'
import { useConstraintSettingsStore } from '@/stores/constraintSettingsStore'

// グループの色設定
const GROUP_COLORS: Record<string, string> = {
  A: 'bg-red-100 text-red-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-green-100 text-green-800',
  D: 'bg-yellow-100 text-yellow-800',
}

function Settings() {
  const queryClient = useQueryClient()
  const { currentTournament, setCurrentTournament } = useAppStore()
  const {
    settings: constraintSettings,
    setSettings: setConstraintSettings,
    masterData,
    addRegion,
    removeRegion,
    addLeague,
    removeLeague,
  } = useConstraintSettingsStore()
  // appStoreから現在のトーナメントIDを取得
  const tournamentId = currentTournament?.id || 1

  // 大会設定フォーム
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    shortName: '',
    edition: 0,
    startDate: '',
    endDate: '',
    // 大会形式
    useGroupSystem: true, // true=グループ制（旧方式）, false=1リーグ制（新方式）
    // 予選リーグ設定
    matchDuration: 50,
    intervalMinutes: 15,
    preliminaryStartTime: '09:00',
    // 決勝トーナメント設定
    finalsMatchDuration: 60,
    finalsIntervalMinutes: 20,
    finalsStartTime: '09:00',
    bracketMethod: 'seed_order' as 'diagonal' | 'seed_order',
    // チーム構成（グループ制用）
    groupCount: 4,
    teamsPerGroup: 4,
    advancingTeams: 1,
    qualificationRule: 'group_based' as 'group_based' | 'overall_ranking',
    // 新方式用設定
    venueCount: 6,
    teamsPerVenue: 4,
    matchesPerTeamPerDay: 2,
    preliminaryDays: 2,
    // 研修試合設定
    trainingMatchDuration: 40,
    trainingIntervalMinutes: 5,
    trainingMatchesPerTeam: 2,
  })

  // 会場編集モーダル
  const [showVenueModal, setShowVenueModal] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [venueForm, setVenueForm] = useState({
    name: '',
    address: '',
    groupId: '',
    maxMatchesPerDay: 6,
    forPreliminary: true,
    forFinalDay: false,
    isFinalsVenue: false,
    isMixedUse: false,
    finalsMatchCount: 1,
  })
  const [showAddVenueModal, setShowAddVenueModal] = useState(false)
  const [addVenueForm, setAddVenueForm] = useState({
    name: '',
    shortName: '',
    address: '',
    groupId: '',
    pitchCount: 1,
    forPreliminary: true,
    forFinalDay: false,
    isFinalsVenue: false,
    isMixedUse: false,
    finalsMatchCount: 1,
  })

  // 新規大会作成モーダル
  const [showNewTournamentModal, setShowNewTournamentModal] = useState(false)

  // マスタ登録用
  const [newRegion, setNewRegion] = useState('')
  const [newLeague, setNewLeague] = useState('')

  // 制約設定用モーダル
  const [showLocalTeamModal, setShowLocalTeamModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showLeagueModal, setShowLeagueModal] = useState(false)
  const [newTournamentForm, setNewTournamentForm] = useState({
    name: '',
    shortName: '',
    edition: 1,
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
    matchDuration: 50,
    halfDuration: 25,
    intervalMinutes: 15,
  })

  // チーム一覧を取得（制約設定用）
  const { data: teamsData, refetch: refetchTeams } = useQuery({
    queryKey: ['settings-teams', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, short_name, team_type, region, league_id, group_id')
        .eq('tournament_id', tournamentId)
        .order('group_id')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // リーグ一覧を取得
  const { data: leaguesData, refetch: refetchLeagues } = useQuery({
    queryKey: ['settings-leagues', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name')
      if (error) {
        // テーブルが存在しない場合は空配列を返す
        console.warn('leagues table may not exist:', error)
        return []
      }
      return data || []
    },
  })

  // 地域一覧を取得（DBから）
  const { data: regionsData, refetch: refetchRegions } = useQuery({
    queryKey: ['settings-regions', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name')
      if (error) {
        // テーブルが存在しない場合は空配列を返す
        console.warn('regions table may not exist:', error)
        return []
      }
      return data || []
    },
  })

  // 大会情報を取得
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const data = await tournamentsApi.getById(tournamentId)
      // snake_case to camelCase変換
      return {
        ...data,
        shortName: data.short_name,
        startDate: data.start_date,
        endDate: data.end_date,
      } as Tournament
    },
  })

  // 大会情報が取得できたらフォームを初期化
  useEffect(() => {
    if (tournament) {
      setTournamentForm({
        name: tournament.name || '',
        shortName: tournament.shortName || '',
        edition: tournament.edition || 0,
        startDate: tournament.startDate || '',
        endDate: tournament.endDate || '',
        // 大会形式
        useGroupSystem: (tournament as any).useGroupSystem ?? (tournament as any).use_group_system ?? true,
        // 予選リーグ設定
        matchDuration: tournament.matchDuration || 50,
        intervalMinutes: tournament.intervalMinutes || 15,
        preliminaryStartTime: (tournament as any).preliminaryStartTime || (tournament as any).preliminary_start_time || '09:00',
        // 決勝トーナメント設定
        finalsMatchDuration: (tournament as any).finalsMatchDuration || (tournament as any).finals_match_duration || 60,
        finalsIntervalMinutes: (tournament as any).finalsIntervalMinutes || (tournament as any).finals_interval_minutes || 20,
        finalsStartTime: (tournament as any).finalsStartTime || (tournament as any).finals_start_time || '09:00',
        bracketMethod: (tournament as any).bracketMethod || (tournament as any).bracket_method || 'seed_order',
        // チーム構成（グループ制用）
        groupCount: tournament.groupCount || 4,
        teamsPerGroup: tournament.teamsPerGroup || 4,
        advancingTeams: tournament.advancingTeams || 1,
        qualificationRule: (tournament as any).qualificationRule || (tournament as any).qualification_rule || 'group_based',
        // 新方式用設定
        venueCount: (tournament as any).venueCount ?? (tournament as any).venue_count ?? 6,
        teamsPerVenue: (tournament as any).teamsPerVenue ?? (tournament as any).teams_per_venue ?? 4,
        matchesPerTeamPerDay: (tournament as any).matchesPerTeamPerDay ?? (tournament as any).matches_per_team_per_day ?? 2,
        preliminaryDays: (tournament as any).preliminaryDays ?? (tournament as any).preliminary_days ?? 2,
        // 研修試合設定
        trainingMatchDuration: (tournament as any).trainingMatchDuration ?? (tournament as any).training_match_duration ?? 40,
        trainingIntervalMinutes: (tournament as any).trainingIntervalMinutes ?? (tournament as any).training_interval_minutes ?? 5,
        trainingMatchesPerTeam: (tournament as any).trainingMatchesPerTeam ?? (tournament as any).training_matches_per_team ?? 2,
      })
    }
  }, [tournament])

  // 大会設定更新
  const updateTournamentMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      shortName: string;
      edition: number;
      startDate: string;
      endDate: string;
      useGroupSystem: boolean;
      matchDuration: number;
      intervalMinutes: number;
      preliminaryStartTime: string;
      finalsMatchDuration: number;
      finalsIntervalMinutes: number;
      finalsStartTime: string;
      bracketMethod: 'diagonal' | 'seed_order';
      groupCount: number;
      teamsPerGroup: number;
      advancingTeams: number;
      qualificationRule: 'group_based' | 'overall_ranking';
      venueCount: number;
      teamsPerVenue: number;
      matchesPerTeamPerDay: number;
      preliminaryDays: number;
      trainingMatchDuration: number;
      trainingIntervalMinutes: number;
      trainingMatchesPerTeam: number;
    }) => {
      const { data: updated, error } = await supabase
        .from('tournaments')
        .update({
          name: data.name,
          short_name: data.shortName,
          start_date: data.startDate,
          end_date: data.endDate,
          use_group_system: data.useGroupSystem,
          match_duration: data.matchDuration,
          interval_minutes: data.intervalMinutes,
          preliminary_start_time: data.preliminaryStartTime,
          finals_match_duration: data.finalsMatchDuration,
          finals_interval_minutes: data.finalsIntervalMinutes,
          finals_start_time: data.finalsStartTime,
          bracket_method: data.bracketMethod,
          group_count: data.groupCount,
          teams_per_group: data.teamsPerGroup,
          advancing_teams: data.advancingTeams,
          qualification_rule: data.qualificationRule,
          venue_count: data.venueCount,
          teams_per_venue: data.teamsPerVenue,
          matches_per_team_per_day: data.matchesPerTeamPerDay,
          preliminary_days: data.preliminaryDays,
          training_match_duration: data.trainingMatchDuration,
          training_interval_minutes: data.trainingIntervalMinutes,
          training_matches_per_team: data.trainingMatchesPerTeam,
        })
        .eq('id', tournamentId)
        .select()
        .single()

      if (error) throw error
      return {
        ...updated,
        shortName: updated.short_name,
        startDate: updated.start_date,
        endDate: updated.end_date,
        useGroupSystem: updated.use_group_system,
      } as Tournament
    },
    onSuccess: (updatedTournament) => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      setCurrentTournament(updatedTournament)
      toast.success('大会設定を更新しました')
    },
    onError: (error: Error) => {
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // 大会設定を保存
  const handleSaveTournament = () => {
    updateTournamentMutation.mutate(tournamentForm)
  }

  // 会場一覧を取得（常に最新データを取得）
  const { data: venueData, isLoading: isLoadingVenues } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: async () => {
      const data = await venuesApi.getAll(tournamentId)
      return { venues: data, total: data.length }
    },
    staleTime: 0, // 常に最新データを取得
    refetchOnMount: true, // マウント時に必ず再取得
  })
  const venues = venueData?.venues ?? []

  // 日付変更時の自動保存
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    // 新しいフォーム値を作成（stale closure問題を回避）
    const updatedForm = { ...tournamentForm, [field]: value }
    setTournamentForm(updatedForm)
    // 即座に保存
    if (value) {
      updateTournamentMutation.mutate(updatedForm)
    }
  }


  // 大会作成
  const createTournamentMutation = useCreateTournament()

  // 会場作成
  const createVenueMutation = useCreateVenue()

  // 会場更新
  const updateVenueMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      address?: string | null;
      groupId?: string | null;
      maxMatchesPerDay?: number;
      forPreliminary?: boolean;
      forFinalDay?: boolean;
      isFinalsVenue?: boolean;
      isMixedUse?: boolean;
      finalsMatchCount?: number;
    }) => {
      const { id, ...rest } = data
      // snake_case でSupabaseに送信
      const updatePayload = {
        name: rest.name,
        address: rest.address,
        group_id: rest.groupId || null,
        max_matches_per_day: rest.maxMatchesPerDay,
        for_preliminary: rest.forPreliminary,
        for_final_day: rest.forFinalDay,
        is_finals_venue: rest.isFinalsVenue,
        is_mixed_use: rest.isMixedUse,
        finals_match_count: rest.finalsMatchCount,
      }
      console.log('[updateVenueMutation] Sending to Supabase:', updatePayload)
      const { data: venue, error } = await supabase
        .from('venues')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        console.error('[updateVenueMutation] Supabase error:', error)
        throw error
      }
      console.log('[updateVenueMutation] Success:', venue)
      return venue as Venue
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', tournamentId] })
      setShowVenueModal(false)
      toast.success('会場情報を更新しました')
    },
    onError: (error: Error) => {
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // 会場削除
  const deleteVenueMutation = useMutation({
    mutationFn: async (venueId: number) => {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', venueId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', tournamentId] })
      toast.success('会場を削除しました')
    },
    onError: (error: Error) => {
      toast.error(`削除に失敗しました: ${error.message}`)
    },
  })

  // チームのteam_type更新
  const updateTeamTypeMutation = useMutation({
    mutationFn: async ({ teamId, teamType }: { teamId: number; teamType: 'local' | 'invited' }) => {
      const { error } = await supabase
        .from('teams')
        .update({ team_type: teamType })
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      refetchTeams()
    },
    onError: (error: Error) => {
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // チームのregion更新
  const updateTeamRegionMutation = useMutation({
    mutationFn: async ({ teamId, region }: { teamId: number; region: string | null }) => {
      const { error } = await supabase
        .from('teams')
        .update({ region })
        .eq('id', teamId)
      if (error) throw error
    },
    onSuccess: () => {
      refetchTeams()
    },
    onError: (error: Error) => {
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // チームのleague_id更新
  const updateTeamLeagueMutation = useMutation({
    mutationFn: async ({ teamId, leagueId }: { teamId: number; leagueId: number | null }) => {
      console.log('[updateTeamLeague] teamId:', teamId, 'leagueId:', leagueId, 'type:', typeof leagueId)
      // 直接RPCで更新（スキーマキャッシュ問題を回避）
      const { error } = await supabase.rpc('update_team_league', {
        p_team_id: teamId,
        p_league_id: leagueId
      })
      if (error) {
        // RPCが存在しない場合は通常のupdateにフォールバック
        console.log('[updateTeamLeague] RPC failed, trying direct update:', error)
        const { error: updateError } = await supabase
          .from('teams')
          .update({ league_id: leagueId })
          .eq('id', teamId)
        if (updateError) throw updateError
      }
    },
    onSuccess: () => {
      refetchTeams()
      toast.success('リーグを更新しました')
    },
    onError: (error: Error) => {
      console.error('[updateTeamLeague] error:', error)
      toast.error(`更新に失敗しました: ${error.message}`)
    },
  })

  // リーグ追加
  const addLeagueMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('leagues')
        .insert({ tournament_id: tournamentId, name })
      if (error) throw error
    },
    onSuccess: () => {
      refetchLeagues()
      toast.success('リーグを追加しました')
    },
    onError: (error: Error) => {
      toast.error(`追加に失敗しました: ${error.message}`)
    },
  })

  // リーグ削除
  const deleteLeagueMutation = useMutation({
    mutationFn: async (leagueId: number) => {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId)
      if (error) throw error
    },
    onSuccess: () => {
      refetchLeagues()
      refetchTeams() // チームのleague_idがnullになる可能性
      toast.success('リーグを削除しました')
    },
    onError: (error: Error) => {
      toast.error(`削除に失敗しました: ${error.message}`)
    },
  })

  // 地域追加（DB）
  const addRegionMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('regions')
        .insert({ tournament_id: tournamentId, name })
      if (error) throw error
    },
    onSuccess: () => {
      refetchRegions()
      toast.success('地域を追加しました')
    },
    onError: (error: Error) => {
      toast.error(`追加に失敗しました: ${error.message}`)
    },
  })

  // 地域削除（DB）
  const deleteRegionMutation = useMutation({
    mutationFn: async (regionId: number) => {
      const { data: region } = await supabase
        .from('regions')
        .select('name')
        .eq('id', regionId)
        .single()

      if (region) {
        // チームの地域をクリア
        await supabase
          .from('teams')
          .update({ region: null })
          .eq('tournament_id', tournamentId)
          .eq('region', region.name)
      }

      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', regionId)
      if (error) throw error
    },
    onSuccess: () => {
      refetchRegions()
      refetchTeams()
      toast.success('地域を削除しました')
    },
    onError: (error: Error) => {
      toast.error(`削除に失敗しました: ${error.message}`)
    },
  })

  // 会場削除確認
  const handleDeleteVenue = (venue: Venue) => {
    if (window.confirm(`「${venue.name}」を削除しますか？\n※ この操作は取り消せません`)) {
      deleteVenueMutation.mutate(venue.id)
    }
  }

  // 会場編集モーダルを開く
  const openVenueModal = (venue: Venue) => {
    console.log('[openVenueModal] venue data:', venue)
    setSelectedVenue(venue)
    setVenueForm({
      name: venue.name,
      address: venue.address || '',
      groupId: venue.groupId || venue.group_id || '',
      maxMatchesPerDay: venue.maxMatchesPerDay ?? venue.max_matches_per_day ?? 6,
      forPreliminary: venue.forPreliminary ?? venue.for_preliminary ?? true,
      forFinalDay: venue.forFinalDay ?? venue.for_final_day ?? false,
      isFinalsVenue: venue.isFinalsVenue ?? venue.is_finals_venue ?? false,
      isMixedUse: (venue as any).isMixedUse ?? (venue as any).is_mixed_use ?? false,
      finalsMatchCount: (venue as any).finalsMatchCount ?? (venue as any).finals_match_count ?? 1,
    })
    setShowVenueModal(true)
  }

  // 会場を保存
  const handleSaveVenue = () => {
    if (!selectedVenue) return

    // camelCaseで明示的に送信（booleanはfalseも有効な値）
    const payload = {
      id: selectedVenue.id,
      name: venueForm.name,
      address: venueForm.address || null,
      groupId: venueForm.groupId || null,
      maxMatchesPerDay: venueForm.maxMatchesPerDay,
      forPreliminary: venueForm.forPreliminary,  // 予選会場フラグ
      forFinalDay: venueForm.forFinalDay,        // 最終日会場フラグ
      isFinalsVenue: venueForm.isFinalsVenue,    // 決勝会場フラグ
      isMixedUse: venueForm.isMixedUse,          // 混合会場フラグ
      finalsMatchCount: venueForm.finalsMatchCount, // 混合会場での決勝試合数
    }
    console.log('[handleSaveVenue] Sending payload:', payload)

    updateVenueMutation.mutate(payload)
  }

  // 新規大会を作成
  const handleCreateTournament = () => {
    if (!newTournamentForm.name.trim()) {
      toast.error('大会名を入力してください')
      return
    }
    if (!newTournamentForm.startDate || !newTournamentForm.endDate) {
      toast.error('開始日と終了日を入力してください')
      return
    }
    createTournamentMutation.mutate(
      {
        name: newTournamentForm.name,
        shortName: newTournamentForm.shortName || undefined,
        edition: newTournamentForm.edition,
        year: newTournamentForm.year,
        startDate: newTournamentForm.startDate,
        endDate: newTournamentForm.endDate,
        matchDuration: newTournamentForm.matchDuration,
        halfDuration: newTournamentForm.halfDuration,
        intervalMinutes: newTournamentForm.intervalMinutes,
      },
      {
        onSuccess: (newTournament) => {
          setShowNewTournamentModal(false)
          setNewTournamentForm({
            name: '',
            shortName: '',
            edition: 1,
            year: new Date().getFullYear(),
            startDate: '',
            endDate: '',
            matchDuration: 50,
            halfDuration: 25,
            intervalMinutes: 15,
          })
          toast.success(`大会「${newTournament.name}」を作成しました`)
          // 作成した大会に切り替える
          setCurrentTournament(newTournament)
        },
        onError: (error: Error) => {
          toast.error(`作成に失敗しました: ${error.message}`)
        },
      }
    )
  }

  // 会場を追加
  const handleAddVenue = () => {
    if (!addVenueForm.name.trim()) {
      toast.error('会場名を入力してください')
      return
    }
    createVenueMutation.mutate(
      {
        tournamentId,
        name: addVenueForm.name,
        shortName: addVenueForm.shortName || addVenueForm.name,
        address: addVenueForm.address || undefined,
        groupId: addVenueForm.groupId || undefined,
        pitchCount: addVenueForm.pitchCount,
        forPreliminary: addVenueForm.forPreliminary,
        forFinalDay: addVenueForm.forFinalDay,
        isFinalsVenue: addVenueForm.isFinalsVenue,
        isMixedUse: addVenueForm.isMixedUse,
        finalsMatchCount: addVenueForm.finalsMatchCount,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['venues', tournamentId] })
          setShowAddVenueModal(false)
          setAddVenueForm({ name: '', shortName: '', address: '', groupId: '', pitchCount: 1, forPreliminary: true, forFinalDay: false, isFinalsVenue: false, isMixedUse: false, finalsMatchCount: 1 })
          toast.success('会場を追加しました')
        },
        onError: (error: Error) => {
          toast.error(`追加に失敗しました: ${error.message}`)
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
          <p className="text-gray-600 mt-1">
            大会の基本設定を行います
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowNewTournamentModal(true)}
        >
          + 新規大会作成
        </button>
      </div>

      {/* 大会設定 */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">大会設定</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">大会名</label>
              <input
                type="text"
                className="form-input"
                value={tournamentForm.name}
                placeholder="浦和カップ高校サッカーフェスティバル"
                onChange={(e) => setTournamentForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">略称 (Short Name)</label>
              <input
                type="text"
                className="form-input"
                value={tournamentForm.shortName}
                placeholder="浦和カップ2026"
                onChange={(e) => setTournamentForm(prev => ({ ...prev, shortName: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">回数</label>
              <input
                type="number"
                className="form-input"
                value={tournamentForm.edition}
                placeholder="35"
                onChange={(e) => setTournamentForm(prev => ({ ...prev, edition: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="form-label">開始日 <span className="text-xs text-green-600">(自動保存)</span></label>
              <input
                type="date"
                className="form-input"
                value={tournamentForm.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">終了日 <span className="text-xs text-green-600">(自動保存)</span></label>
              <input
                type="date"
                className="form-input"
                value={tournamentForm.endDate}
                min={tournamentForm.startDate || undefined}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
          </div>

          {/* 予選リーグ時間設定 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">予選リーグ時間設定</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">第1試合開始時刻</label>
                <input
                  type="time"
                  className="form-input"
                  value={tournamentForm.preliminaryStartTime}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, preliminaryStartTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">試合時間（分）</label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.matchDuration}
                  placeholder="50"
                  min={10}
                  max={120}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, matchDuration: parseInt(e.target.value) || 50 }))}
                />
              </div>
              <div>
                <label className="form-label">試合間隔（分）<span className="text-xs text-gray-500 ml-1">(HT+入れ替え)</span></label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.intervalMinutes}
                  placeholder="15"
                  min={5}
                  max={60}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 15 }))}
                />
              </div>
            </div>
          </div>

          {/* 決勝トーナメント時間設定 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">決勝トーナメント時間設定</h4>
            <p className="text-xs text-gray-500 mb-3">
              ※ 最終日の準決勝・3位決定戦・決勝に適用されます
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">第1試合開始時刻</label>
                <input
                  type="time"
                  className="form-input"
                  value={tournamentForm.finalsStartTime}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, finalsStartTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">試合時間（分）</label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.finalsMatchDuration}
                  placeholder="60"
                  min={10}
                  max={120}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, finalsMatchDuration: parseInt(e.target.value) || 60 }))}
                />
              </div>
              <div>
                <label className="form-label">試合間隔（分）<span className="text-xs text-gray-500 ml-1">(HT+入れ替え)</span></label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.finalsIntervalMinutes}
                  placeholder="20"
                  min={5}
                  max={60}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, finalsIntervalMinutes: parseInt(e.target.value) || 20 }))}
                />
              </div>
              <div>
                <label className="form-label">組み合わせ方式</label>
                <select
                  className="form-input"
                  value={tournamentForm.bracketMethod}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, bracketMethod: e.target.value as 'diagonal' | 'seed_order' }))}
                >
                  <option value="seed_order">順位順（1位vs4位、2位vs3位）</option>
                  <option value="diagonal">対角線（A1vsC1、B1vsD1）</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {tournamentForm.bracketMethod === 'seed_order'
                    ? '総合順位で組み合わせ'
                    : 'グループ対角線で組み合わせ'}
                </p>
              </div>
            </div>
          </div>

          {/* 研修試合設定 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">研修試合設定</h4>
            <p className="text-xs text-gray-500 mb-3">
              ※ 最終日の研修試合（決勝進出チーム以外）に適用されます
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">試合時間（分）</label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.trainingMatchDuration}
                  placeholder="40"
                  min={10}
                  max={90}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, trainingMatchDuration: parseInt(e.target.value) || 40 }))}
                />
              </div>
              <div>
                <label className="form-label">試合間隔（分）</label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.trainingIntervalMinutes}
                  placeholder="5"
                  min={0}
                  max={30}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, trainingIntervalMinutes: parseInt(e.target.value) || 5 }))}
                />
              </div>
              <div>
                <label className="form-label">チームあたり試合数</label>
                <input
                  type="number"
                  className="form-input"
                  value={tournamentForm.trainingMatchesPerTeam}
                  placeholder="2"
                  min={1}
                  max={5}
                  onChange={(e) => setTournamentForm(prev => ({ ...prev, trainingMatchesPerTeam: parseInt(e.target.value) || 2 }))}
                />
              </div>
            </div>
          </div>

          {/* 大会形式設定 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">大会形式</h4>
            <div className="flex gap-4">
              <label className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                tournamentForm.useGroupSystem
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="tournamentFormat"
                  className="sr-only"
                  checked={tournamentForm.useGroupSystem}
                  onChange={() => setTournamentForm(prev => ({ ...prev, useGroupSystem: true }))}
                />
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    tournamentForm.useGroupSystem ? 'border-primary-500' : 'border-gray-300'
                  }`}>
                    {tournamentForm.useGroupSystem && (
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">グループリーグ制（旧方式）</div>
                    <p className="text-xs text-gray-500 mt-1">
                      A〜Dグループに分かれて総当たり → 決勝トーナメント
                    </p>
                  </div>
                </div>
              </label>
              <label className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                !tournamentForm.useGroupSystem
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="tournamentFormat"
                  className="sr-only"
                  checked={!tournamentForm.useGroupSystem}
                  onChange={() => setTournamentForm(prev => ({ ...prev, useGroupSystem: false }))}
                />
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    !tournamentForm.useGroupSystem ? 'border-primary-500' : 'border-gray-300'
                  }`}>
                    {!tournamentForm.useGroupSystem && (
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">1リーグ制（新方式）</div>
                    <p className="text-xs text-gray-500 mt-1">
                      会場ごとにチーム配置 → 全チーム総合順位で決勝進出
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* グループ制用：チーム構成設定 */}
          {tournamentForm.useGroupSystem && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 text-gray-700">チーム構成設定（グループ制）</h4>
              <p className="text-xs text-gray-500 mb-3">
                ※ グループやチームが既に登録されている場合、変更すると整合性が崩れる可能性があります
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">グループ数</label>
                  <select
                    className="form-input"
                    value={tournamentForm.groupCount}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, groupCount: parseInt(e.target.value) || 4 }))}
                  >
                    <option value={2}>2グループ</option>
                    <option value={4}>4グループ</option>
                    <option value={8}>8グループ</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">グループ内チーム数</label>
                  <select
                    className="form-input"
                    value={tournamentForm.teamsPerGroup}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, teamsPerGroup: parseInt(e.target.value) || 4 }))}
                  >
                    <option value={3}>3チーム</option>
                    <option value={4}>4チーム</option>
                    <option value={5}>5チーム</option>
                    <option value={6}>6チーム</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">決勝進出ルール</label>
                  <select
                    className="form-input"
                    value={tournamentForm.qualificationRule}
                    onChange={(e) => setTournamentForm(prev => ({
                      ...prev,
                      qualificationRule: e.target.value as 'group_based' | 'overall_ranking',
                      // 総合順位ルールの場合は進出数を4に固定
                      advancingTeams: e.target.value === 'overall_ranking' ? 1 : prev.advancingTeams
                    }))}
                  >
                    <option value="group_based">グループ順位（各グループ上位）</option>
                    <option value="overall_ranking">総合順位（上位4チーム）</option>
                  </select>
                </div>
                {tournamentForm.qualificationRule === 'group_based' && (
                  <div>
                    <label className="form-label">決勝T進出チーム数</label>
                    <select
                      className="form-input"
                      value={tournamentForm.advancingTeams}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, advancingTeams: parseInt(e.target.value) || 1 }))}
                    >
                      <option value={1}>各グループ1位のみ</option>
                      <option value={2}>各グループ1・2位</option>
                    </select>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                総チーム数: {tournamentForm.groupCount * tournamentForm.teamsPerGroup}チーム /
                決勝T参加: {tournamentForm.qualificationRule === 'overall_ranking'
                  ? '4チーム（総合1〜4位）'
                  : `${tournamentForm.groupCount * tournamentForm.advancingTeams}チーム`}
              </p>
            </div>
          )}

          {/* 新方式用：会場・チーム構成設定 */}
          {!tournamentForm.useGroupSystem && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 text-gray-700">会場・チーム構成設定（1リーグ制）</h4>
              <p className="text-xs text-gray-500 mb-3">
                ※ 各会場にチームを配置し、会場内で対戦を行います。チーム配置は「チーム配置」画面で行います。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">会場数</label>
                  <input
                    type="number"
                    className="form-input"
                    min={2}
                    max={12}
                    value={tournamentForm.venueCount}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, venueCount: parseInt(e.target.value) || 6 }))}
                  />
                </div>
                <div>
                  <label className="form-label">1会場のチーム数</label>
                  <input
                    type="number"
                    className="form-input"
                    min={3}
                    max={8}
                    value={tournamentForm.teamsPerVenue}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, teamsPerVenue: parseInt(e.target.value) || 4 }))}
                  />
                </div>
                <div>
                  <label className="form-label">1日の試合数/チーム</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    max={4}
                    value={tournamentForm.matchesPerTeamPerDay}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, matchesPerTeamPerDay: parseInt(e.target.value) || 2 }))}
                  />
                </div>
                <div>
                  <label className="form-label">予選日数</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    max={3}
                    value={tournamentForm.preliminaryDays}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, preliminaryDays: parseInt(e.target.value) || 2 }))}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                総チーム数: {tournamentForm.venueCount * tournamentForm.teamsPerVenue}チーム /
                予選試合数/チーム: {tournamentForm.matchesPerTeamPerDay * tournamentForm.preliminaryDays}試合 /
                決勝T参加: 総合順位上位4チーム
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={handleSaveTournament}
              disabled={updateTournamentMutation.isPending}
            >
              {updateTournamentMutation.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 会場設定 */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold">会場設定</h3>
          <button className="btn-secondary text-sm" onClick={() => setShowAddVenueModal(true)}>会場追加</button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>会場名</th>
                <th>担当グループ</th>
                <th>用途</th>
                <th>試合数/日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingVenues ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    会場が登録されていません
                  </td>
                </tr>
              ) : (
                venues.map((venue) => {
                  const forPreliminary = venue.forPreliminary ?? venue.for_preliminary ?? true;
                  const forFinalDay = venue.forFinalDay ?? venue.for_final_day ?? false;
                  const isFinalsVenue = venue.isFinalsVenue ?? venue.is_finals_venue ?? false;
                  const isMixedUse = (venue as any).isMixedUse ?? (venue as any).is_mixed_use ?? false;
                  const finalsMatchCount = (venue as any).finalsMatchCount ?? (venue as any).finals_match_count ?? 1;
                  return (
                    <tr key={venue.id}>
                      <td>{venue.name}</td>
                      <td>
                        {(venue.group_id || venue.groupId) ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${GROUP_COLORS[venue.group_id || venue.groupId || ''] || 'bg-gray-100 text-gray-800'}`}>
                            {venue.group_id || venue.groupId}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {forPreliminary && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              予選
                            </span>
                          )}
                          {forFinalDay && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              順位L
                            </span>
                          )}
                          {isFinalsVenue && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                              決勝
                            </span>
                          )}
                          {isMixedUse && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded" title={`決勝${finalsMatchCount}試合後に研修`}>
                              混合
                            </span>
                          )}
                          {!forPreliminary && !forFinalDay && !isFinalsVenue && !isMixedUse && (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td>{venue.maxMatchesPerDay ?? venue.max_matches_per_day}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="text-primary-600 hover:text-primary-800 text-sm"
                            onClick={() => openVenueModal(venue)}
                          >
                            編集
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 text-sm"
                            onClick={() => handleDeleteVenue(venue)}
                            disabled={deleteVenueMutation.isPending}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 選手データ管理 */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">選手データ管理</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-600 mb-4">
            各チームの選手データをExcel形式でインポートできます。
            インポートした選手名は、得点者入力時のサジェストに使用されます。
          </p>
          <div className="flex gap-2">
            <Link to="/players" className="btn-primary inline-flex items-center gap-2">
              選手管理ページへ
              <span className="text-xs">（インポート機能あり）</span>
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            ※ 選手管理ページでチームを選択し、「Excelインポート」ボタンからインポートできます
          </p>
        </div>
      </div>

      {/* 制約チェック設定 */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">対戦回避設定</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-600 mb-4">
            日程編集時の対戦チェック（警告表示）の設定を行います。
            有効にした項目は、チーム登録画面で入力欄が表示されます。
          </p>

          <div className="space-y-4">
            {/* チーム属性による回避 */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 text-gray-700">チーム属性による回避</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 rounded"
                      checked={constraintSettings.avoidLocalVsLocal}
                      onChange={(e) => setConstraintSettings({ avoidLocalVsLocal: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-medium">地元チーム同士の対戦を避ける</span>
                      <p className="text-xs text-gray-500">
                        地元校（local）同士の対戦を警告
                        {teamsData && (
                          <span className="ml-2 text-primary-600">
                            （{teamsData.filter(t => t.team_type === 'local').length}チーム登録済）
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-3 py-1"
                    onClick={() => setShowLocalTeamModal(true)}
                  >
                    設定
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 rounded"
                      checked={constraintSettings.avoidSameRegion}
                      onChange={(e) => setConstraintSettings({ avoidSameRegion: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-medium">同一地域チームの対戦を避ける</span>
                      <p className="text-xs text-gray-500">
                        同じ地域（例: 埼玉、東京）のチーム同士の対戦を警告
                        {regionsData && regionsData.length > 0 && (
                          <span className="ml-2 text-primary-600">
                            （{regionsData.length}地域登録済）
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-3 py-1"
                    onClick={() => setShowRegionModal(true)}
                  >
                    設定
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 rounded"
                      checked={constraintSettings.avoidSameLeague}
                      onChange={(e) => setConstraintSettings({ avoidSameLeague: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-medium">同一リーグチームの対戦を避ける</span>
                      <p className="text-xs text-gray-500">
                        同じリーグ（別大会）に所属するチーム同士の対戦を警告
                        {leaguesData && leaguesData.length > 0 && (
                          <span className="ml-2 text-primary-600">
                            （{leaguesData.length}リーグ登録済）
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-3 py-1"
                    onClick={() => setShowLeagueModal(true)}
                  >
                    設定
                  </button>
                </div>
              </div>
            </div>

            {/* 日程による回避 */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 text-gray-700">日程による制約</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 rounded"
                    checked={constraintSettings.avoidConsecutive}
                    onChange={(e) => setConstraintSettings({ avoidConsecutive: e.target.checked })}
                  />
                  <div>
                    <span className="text-sm font-medium">連戦を警告</span>
                    <p className="text-xs text-gray-500">同じチームが連続で試合する場合を警告</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 rounded"
                    checked={constraintSettings.warnDailyGameLimit}
                    onChange={(e) => setConstraintSettings({ warnDailyGameLimit: e.target.checked })}
                  />
                  <div>
                    <span className="text-sm font-medium">1日3試合以上を警告</span>
                    <p className="text-xs text-gray-500">同じ日に3試合以上ある場合を警告</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 rounded"
                    checked={constraintSettings.warnTotalGameLimit}
                    onChange={(e) => setConstraintSettings({ warnTotalGameLimit: e.target.checked })}
                  />
                  <div>
                    <span className="text-sm font-medium">2日間で5試合以上を警告</span>
                    <p className="text-xs text-gray-500">予選リーグ2日間で合計5試合以上ある場合を警告</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* マスタデータ登録 */}
          <div className="space-y-4 mt-6 pt-6 border-t">
            <h4 className="font-medium text-gray-700">マスタデータ登録</h4>

            {/* 地域マスタ */}
            <div className="border rounded-lg p-4">
              <h5 className="text-sm font-medium mb-2">地域</h5>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="例: 埼玉、東京、神奈川"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newRegion.trim()) {
                      addRegion(newRegion.trim())
                      setNewRegion('')
                    }
                  }}
                />
                <button
                  className="btn-secondary text-sm"
                  onClick={() => {
                    if (newRegion.trim()) {
                      addRegion(newRegion.trim())
                      setNewRegion('')
                    }
                  }}
                >
                  追加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {masterData.regions.map((region) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                  >
                    {region}
                    <button
                      onClick={() => removeRegion(region)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {masterData.regions.length === 0 && (
                  <span className="text-gray-400 text-sm">登録なし</span>
                )}
              </div>
            </div>

            {/* リーグマスタ */}
            <div className="border rounded-lg p-4">
              <h5 className="text-sm font-medium mb-2">リーグ</h5>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  value={newLeague}
                  onChange={(e) => setNewLeague(e.target.value)}
                  placeholder="例: S1リーグ、S2リーグ、県1部"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLeague.trim()) {
                      addLeague(newLeague.trim())
                      setNewLeague('')
                    }
                  }}
                />
                <button
                  className="btn-secondary text-sm"
                  onClick={() => {
                    if (newLeague.trim()) {
                      addLeague(newLeague.trim())
                      setNewLeague('')
                    }
                  }}
                >
                  追加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {masterData.leagues.map((league) => (
                  <span
                    key={league}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded"
                  >
                    {league}
                    <button
                      onClick={() => removeLeague(league)}
                      className="text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {masterData.leagues.length === 0 && (
                  <span className="text-gray-400 text-sm">登録なし</span>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            ※ 設定は自動保存されます（ブラウザに保存）
          </p>
        </div>
      </div>

      {/* 新規大会作成モーダル */}
      <Modal
        isOpen={showNewTournamentModal}
        onClose={() => setShowNewTournamentModal(false)}
        title="新規大会作成"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">大会名 *</label>
            <input
              type="text"
              className="form-input"
              value={newTournamentForm.name}
              onChange={(e) => setNewTournamentForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="浦和カップ高校サッカーフェスティバル"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">略称</label>
              <input
                type="text"
                className="form-input"
                value={newTournamentForm.shortName}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, shortName: e.target.value }))}
                placeholder="浦和カップ2026"
              />
            </div>
            <div>
              <label className="form-label">回数（第○回）</label>
              <input
                type="number"
                className="form-input"
                min={1}
                value={newTournamentForm.edition}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, edition: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">開催年度</label>
              <input
                type="number"
                className="form-input"
                min={2000}
                max={2100}
                value={newTournamentForm.year}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
              />
            </div>
            <div>
              <label className="form-label">開始日 *</label>
              <input
                type="date"
                className="form-input"
                value={newTournamentForm.startDate}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">終了日 *</label>
              <input
                type="date"
                className="form-input"
                value={newTournamentForm.endDate}
                min={newTournamentForm.startDate || undefined}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">試合時間（分）</label>
              <input
                type="number"
                className="form-input"
                min={10}
                max={120}
                value={newTournamentForm.matchDuration}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, matchDuration: parseInt(e.target.value) || 50 }))}
              />
            </div>
            <div>
              <label className="form-label">ハーフタイム（分）</label>
              <input
                type="number"
                className="form-input"
                min={5}
                max={60}
                value={newTournamentForm.halfDuration}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, halfDuration: parseInt(e.target.value) || 25 }))}
              />
            </div>
            <div>
              <label className="form-label">試合間隔（分）<span className="text-xs text-gray-500 ml-1">(HT+入れ替え)</span></label>
              <input
                type="number"
                className="form-input"
                min={5}
                max={60}
                value={newTournamentForm.intervalMinutes}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 10 }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => setShowNewTournamentModal(false)}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleCreateTournament}
              disabled={createTournamentMutation.isPending}
            >
              {createTournamentMutation.isPending ? '作成中...' : '作成'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 会場追加モーダル */}
      <Modal
        isOpen={showAddVenueModal}
        onClose={() => setShowAddVenueModal(false)}
        title="会場追加"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">会場名 *</label>
            <input
              type="text"
              className="form-input"
              value={addVenueForm.name}
              onChange={(e) => setAddVenueForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="浦和南高校グラウンド"
            />
          </div>
          <div>
            <label className="form-label">略称</label>
            <input
              type="text"
              className="form-input"
              value={addVenueForm.shortName}
              onChange={(e) => setAddVenueForm(prev => ({ ...prev, shortName: e.target.value }))}
              placeholder="浦和南"
            />
          </div>
          <div>
            <label className="form-label">住所</label>
            <input
              type="text"
              className="form-input"
              value={addVenueForm.address}
              onChange={(e) => setAddVenueForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="さいたま市南区..."
            />
          </div>
          <div>
            <label className="form-label">担当グループ</label>
            <select
              className="form-input"
              value={addVenueForm.groupId}
              onChange={(e) => setAddVenueForm(prev => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">未設定</option>
              <option value="A">Aグループ</option>
              <option value="B">Bグループ</option>
              <option value="C">Cグループ</option>
              <option value="D">Dグループ</option>
            </select>
          </div>
          <div>
            <label className="form-label">コート数</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={4}
              value={addVenueForm.pitchCount}
              onChange={(e) => setAddVenueForm(prev => ({ ...prev, pitchCount: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">会場用途設定</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={addVenueForm.forPreliminary}
                  onChange={(e) => setAddVenueForm(prev => ({ ...prev, forPreliminary: e.target.checked }))}
                />
                <span className="text-sm">予選リーグ会場として使用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={addVenueForm.forFinalDay}
                  onChange={(e) => setAddVenueForm(prev => ({ ...prev, forFinalDay: e.target.checked }))}
                />
                <span className="text-sm">最終日の順位リーグ会場として使用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={addVenueForm.isFinalsVenue}
                  onChange={(e) => setAddVenueForm(prev => ({ ...prev, isFinalsVenue: e.target.checked }))}
                />
                <span className="text-sm">決勝トーナメント会場（3決・決勝戦）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={addVenueForm.isMixedUse}
                  onChange={(e) => setAddVenueForm(prev => ({ ...prev, isMixedUse: e.target.checked }))}
                />
                <span className="text-sm">混合会場（決勝＋研修を同一会場で行う）</span>
              </label>
              {addVenueForm.isMixedUse && (
                <div className="ml-6 mt-2 p-3 bg-purple-50 rounded">
                  <label className="block text-sm text-gray-700 mb-1">決勝トーナメント試合数</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="form-input w-20"
                      min={1}
                      max={4}
                      value={addVenueForm.finalsMatchCount}
                      onChange={(e) => setAddVenueForm(prev => ({ ...prev, finalsMatchCount: parseInt(e.target.value) || 1 }))}
                    />
                    <span className="text-sm text-gray-600">試合目まで決勝トーナメント、以降は研修試合</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => setShowAddVenueModal(false)}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleAddVenue}
              disabled={createVenueMutation.isPending}
            >
              {createVenueMutation.isPending ? '追加中...' : '追加'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 会場編集モーダル */}
      <Modal
        isOpen={showVenueModal}
        onClose={() => setShowVenueModal(false)}
        title="会場編集"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">会場名</label>
            <input
              type="text"
              className="form-input"
              value={venueForm.name}
              onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">住所</label>
            <input
              type="text"
              className="form-input"
              value={venueForm.address}
              onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">担当グループ</label>
            <select
              className="form-input"
              value={venueForm.groupId}
              onChange={(e) => setVenueForm(prev => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">未設定</option>
              <option value="A">Aグループ</option>
              <option value="B">Bグループ</option>
              <option value="C">Cグループ</option>
              <option value="D">Dグループ</option>
            </select>
          </div>
          <div>
            <label className="form-label">1日あたりの試合数</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={12}
              value={venueForm.maxMatchesPerDay}
              onChange={(e) => setVenueForm(prev => ({ ...prev, maxMatchesPerDay: parseInt(e.target.value) || 6 }))}
            />
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">会場用途設定</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={venueForm.forPreliminary}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, forPreliminary: e.target.checked }))}
                />
                <span className="text-sm">予選リーグ会場として使用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={venueForm.forFinalDay}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, forFinalDay: e.target.checked }))}
                />
                <span className="text-sm">最終日の順位リーグ会場として使用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={venueForm.isFinalsVenue}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, isFinalsVenue: e.target.checked }))}
                />
                <span className="text-sm">決勝トーナメント会場（3決・決勝戦）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded"
                  checked={venueForm.isMixedUse}
                  onChange={(e) => setVenueForm(prev => ({ ...prev, isMixedUse: e.target.checked }))}
                />
                <span className="text-sm">混合会場（決勝＋研修を同一会場で行う）</span>
              </label>
              {venueForm.isMixedUse && (
                <div className="ml-6 mt-2 p-3 bg-purple-50 rounded">
                  <label className="block text-sm text-gray-700 mb-1">決勝トーナメント試合数</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="form-input w-20"
                      min={1}
                      max={4}
                      value={venueForm.finalsMatchCount}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, finalsMatchCount: parseInt(e.target.value) || 1 }))}
                    />
                    <span className="text-sm text-gray-600">試合目まで決勝トーナメント、以降は研修試合</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ 決勝トーナメント会場は1つのみ選択してください
            </p>
          </div>
          <div className="flex justify-between pt-4">
            <button
              className="text-red-600 hover:text-red-800 text-sm"
              onClick={() => {
                if (selectedVenue) {
                  handleDeleteVenue(selectedVenue)
                  setShowVenueModal(false)
                }
              }}
              disabled={deleteVenueMutation.isPending}
            >
              この会場を削除
            </button>
            <div className="flex gap-3">
              <button
                className="btn-secondary"
                onClick={() => setShowVenueModal(false)}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveVenue}
                disabled={updateVenueMutation.isPending}
              >
                {updateVenueMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 地元チーム設定モーダル */}
      <Modal
        isOpen={showLocalTeamModal}
        onClose={() => setShowLocalTeamModal(false)}
        title="地元チーム設定"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            地元チーム（local）に設定するチームを選択してください。
            選択されたチーム同士の対戦が警告対象になります。
          </p>
          <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
            {teamsData && teamsData.length > 0 ? (
              teamsData.map(team => (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-3 hover:bg-gray-50 ${
                    team.team_type === 'local' ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      GROUP_COLORS[team.group_id || ''] || 'bg-gray-100'
                    }`}>
                      {team.group_id || '-'}
                    </span>
                    <span className="font-medium">{team.short_name || team.name}</span>
                  </div>
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm rounded ${
                      team.team_type === 'local'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => updateTeamTypeMutation.mutate({
                      teamId: team.id,
                      teamType: team.team_type === 'local' ? 'invited' : 'local'
                    })}
                  >
                    {team.team_type === 'local' ? '地元校' : '招待校'}
                  </button>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-gray-500">チームが登録されていません</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="btn-primary"
              onClick={() => setShowLocalTeamModal(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>

      {/* 地域設定モーダル */}
      <Modal
        isOpen={showRegionModal}
        onClose={() => setShowRegionModal(false)}
        title="地域設定"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            地域マスタの登録と、チームへの地域割り当てを行います。
          </p>

          {/* 地域マスタ追加 */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">地域を追加</h4>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input flex-1"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="例: 埼玉、東京、神奈川"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newRegion.trim()) {
                    addRegionMutation.mutate(newRegion.trim())
                    setNewRegion('')
                  }
                }}
              />
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  if (newRegion.trim()) {
                    addRegionMutation.mutate(newRegion.trim())
                    setNewRegion('')
                  }
                }}
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {regionsData && regionsData.map((region: { id: number; name: string }) => (
                <span
                  key={region.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                >
                  {region.name}
                  <button
                    onClick={() => deleteRegionMutation.mutate(region.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* チーム別地域設定 */}
          <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
            {teamsData && teamsData.length > 0 ? (
              teamsData.map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      GROUP_COLORS[team.group_id || ''] || 'bg-gray-100'
                    }`}>
                      {team.group_id || '-'}
                    </span>
                    <span className="font-medium text-sm">{team.short_name || team.name}</span>
                  </div>
                  <select
                    className="form-input text-sm py-1 w-28"
                    value={team.region || ''}
                    onChange={(e) => updateTeamRegionMutation.mutate({
                      teamId: team.id,
                      region: e.target.value || null
                    })}
                  >
                    <option value="">未設定</option>
                    {regionsData && regionsData.map((r: { id: number; name: string }) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-gray-500">チームが登録されていません</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="btn-primary"
              onClick={() => setShowRegionModal(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>

      {/* リーグ設定モーダル */}
      <Modal
        isOpen={showLeagueModal}
        onClose={() => setShowLeagueModal(false)}
        title="リーグ設定"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            リーグマスタの登録と、チームへのリーグ割り当てを行います。
          </p>

          {/* リーグマスタ追加 */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">リーグを追加</h4>
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input flex-1"
                value={newLeague}
                onChange={(e) => setNewLeague(e.target.value)}
                placeholder="例: S1リーグ、S2リーグ、県1部"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLeague.trim()) {
                    addLeagueMutation.mutate(newLeague.trim())
                    setNewLeague('')
                  }
                }}
              />
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  if (newLeague.trim()) {
                    addLeagueMutation.mutate(newLeague.trim())
                    setNewLeague('')
                  }
                }}
              >
                追加
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {leaguesData && leaguesData.map((league: { id: number; name: string }) => (
                <span
                  key={league.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded"
                >
                  {league.name}
                  <button
                    onClick={() => deleteLeagueMutation.mutate(league.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* チーム別リーグ設定 */}
          <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
            {teamsData && teamsData.length > 0 ? (
              teamsData.map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      GROUP_COLORS[team.group_id || ''] || 'bg-gray-100'
                    }`}>
                      {team.group_id || '-'}
                    </span>
                    <span className="font-medium text-sm">{team.short_name || team.name}</span>
                  </div>
                  <select
                    className="form-input text-sm py-1 w-28"
                    value={team.league_id || ''}
                    onChange={(e) => updateTeamLeagueMutation.mutate({
                      teamId: team.id,
                      leagueId: e.target.value ? parseInt(e.target.value) : null
                    })}
                  >
                    <option value="">未設定</option>
                    {leaguesData && leaguesData.map((l: { id: number; name: string }) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-gray-500">チームが登録されていません</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="btn-primary"
              onClick={() => setShowLeagueModal(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Settings
