/**
 * 日程管理画面
 * 予選リーグ・決勝トーナメントの日程管理
 * Supabase版
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { tournamentsApi, venuesApi, matchesApi, teamsApi, standingsApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import FinalsBracket from '@/components/FinalsBracket'
import DraggableMatchList from '@/components/DraggableMatchList'
import { Modal } from '@/components/ui/Modal'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  generatePreliminarySchedule,
  generateFinalDaySchedule,
  checkCoreApiHealth,
} from '@/lib/scheduleGenerator'
import type {
  MatchWithDetails,
  Venue,
  Tournament,
  MatchStatus,
} from '@/types'

// タブの定義
type TabKey = 'day1' | 'day2' | 'day3'

interface TabInfo {
  key: TabKey
  label: string
  dayOffset: number
  description: string
}

const TABS: TabInfo[] = [
  { key: 'day1', label: 'Day1', dayOffset: 0, description: '予選リーグ1日目' },
  { key: 'day2', label: 'Day2', dayOffset: 1, description: '予選リーグ2日目' },
  { key: 'day3', label: 'Day3', dayOffset: 2, description: '決勝トーナメント・研修試合' },
]

/**
 * 試合ステータスのバッジ
 */
function StatusBadge({ status }: { status: MatchStatus }) {
  const styles: Record<MatchStatus, string> = {
    scheduled: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<MatchStatus, string> = {
    scheduled: '予定',
    in_progress: '試合中',
    completed: '終了',
    cancelled: '中止',
  }
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

/**
 * 日程管理ページメイン
 */
function MatchSchedule() {
  const queryClient = useQueryClient()
  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id || 1

  const [activeTab, setActiveTab] = useState<TabKey>('day1')
  const [selectedMatch, setSelectedMatch] = useState<MatchWithDetails | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateType, setGenerateType] = useState<'preliminary' | 'finals' | 'training' | null>(null)
  const [editingMatch, setEditingMatch] = useState<MatchWithDetails | null>(null)
  const [editForm, setEditForm] = useState<{
    matchDate: string
    matchTime: string
    venueId: number
    matchOrder: number
  } | null>(null)

  // 大会情報を取得
  const { data: tournament, isLoading: isLoadingTournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const data = await tournamentsApi.getById(tournamentId)
      // snake_case to camelCase変換
      return {
        ...data,
        startDate: data.start_date,
        endDate: data.end_date,
      } as Tournament
    },
    enabled: !!tournamentId,
  })

  // 会場一覧を取得
  const { data: venues = [] } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: async () => {
      return await venuesApi.getAll(tournamentId)
    },
    enabled: !!tournamentId,
  })

  // 試合一覧を取得
  const { data: matchData, isLoading: isLoadingMatches } = useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      return await matchesApi.getAll(tournamentId)
    },
    enabled: !!tournamentId,
  })

  // 試合データを変換
  const allMatches: MatchWithDetails[] = useMemo(() => {
    if (!matchData?.matches) return []
    return matchData.matches.map((m: any) => ({
      ...m,
      matchDate: m.match_date,
      matchTime: m.match_time,
      venueId: m.venue_id,
      matchOrder: m.match_number,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeScoreTotal: m.home_score_total,
      awayScoreTotal: m.away_score_total,
    }))
  }, [matchData])

  // 日付ごとの試合をフィルタリング
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

    return allMatches.filter(match => {
      return match.matchDate === targetDateStr
    }).sort((a, b) => {
      // 会場→試合順でソート
      if (a.venueId !== b.venueId) return (a.venueId || 0) - (b.venueId || 0)
      return (a.matchOrder || 0) - (b.matchOrder || 0)
    })
  }, [allMatches, activeTab, tournament])

  // 予選リーグの存在確認（Day1またはDay2に試合があるか）
  const hasPreliminaryMatches = useMemo(() => {
    return allMatches.some(m => m.stage === 'preliminary')
  }, [allMatches])

  // 決勝トーナメントの存在確認
  const hasFinalsMatches = useMemo(() => {
    return allMatches.some(m =>
      m.stage === 'semifinal' || m.stage === 'third_place' || m.stage === 'final'
    )
  }, [allMatches])

  // 研修試合の存在確認
  const hasTrainingMatches = useMemo(() => {
    return allMatches.some(m => m.stage === 'training')
  }, [allMatches])

  // 決勝トーナメントの試合
  const finalsMatches = useMemo(() => {
    return allMatches.filter(m =>
      m.stage === 'semifinal' || m.stage === 'third_place' || m.stage === 'final'
    )
  }, [allMatches])

  // 予選リーグ日程生成
  const generatePreliminaryMutation = useMutation({
    mutationFn: async () => {
      // Core API の接続確認
      const isHealthy = await checkCoreApiHealth()
      if (!isHealthy) {
        throw new Error('日程生成サーバーに接続できません。サーバーが起動しているか確認してください。')
      }

      // チーム一覧を取得
      const teams = await teamsApi.getAll(tournamentId)
      const localTeams = teams.filter((t: any) => t.team_type === 'local' && t.group_id)
      if (localTeams.length === 0) {
        throw new Error('チームが登録されていません')
      }

      // 試合日を取得
      const matchDate = tournament?.startDate || new Date().toISOString().split('T')[0]

      // Core API を呼び出して日程を生成
      const result = await generatePreliminarySchedule(
        localTeams.map((t: any) => ({
          id: t.id,
          name: t.name,
          group: t.group_id,
          rank: 0,
        })),
        venues.map(v => ({ id: v.id, name: v.name })),
        matchDate,
        '09:30'
      )

      if (!result.success || !result.matches) {
        throw new Error('日程生成に失敗しました')
      }

      // 既存の予選試合を削除
      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('stage', 'preliminary')

      // 生成された試合を Supabase に保存
      const matchesToInsert = result.matches.map((m, index) => ({
        tournament_id: tournamentId,
        group_id: m.groupId,
        home_team_id: m.homeTeamId,
        away_team_id: m.awayTeamId,
        venue_id: m.venueId,
        match_date: m.matchDate,
        match_time: m.matchTime,
        match_number: index + 1,
        stage: 'preliminary',
        status: 'scheduled',
      }))

      const { error } = await supabase.from('matches').insert(matchesToInsert)
      if (error) throw error

      return { created: matchesToInsert.length }
    },
    onSuccess: (data) => {
      toast.success(`予選リーグ ${data.created}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: any) => {
      toast.error(error.message || '日程生成に失敗しました')
    },
  })

  // 決勝トーナメント＋研修試合生成
  const generateFinalsMutation = useMutation({
    mutationFn: async () => {
      // Core API の接続確認
      const isHealthy = await checkCoreApiHealth()
      if (!isHealthy) {
        throw new Error('日程生成サーバーに接続できません。サーバーが起動しているか確認してください。')
      }

      // 順位表を取得
      const standingsData = await standingsApi.getAll(tournamentId)
      if (!standingsData || standingsData.length === 0) {
        throw new Error('順位表データがありません。予選リーグを先に完了してください。')
      }

      // グループ別に整理
      const standingsByGroup: Record<string, any[]> = {}
      for (const s of standingsData) {
        if (!s.group_id) continue
        if (!standingsByGroup[s.group_id]) {
          standingsByGroup[s.group_id] = []
        }
        standingsByGroup[s.group_id].push({
          id: s.team_id,
          name: s.team?.name || `Team ${s.team_id}`,
          group: s.group_id,
          rank: s.rank,
          points: s.points,
          goalDiff: s.goal_diff,
          goalsFor: s.goals_for,
        })
      }

      // 対戦済みペアを取得（同グループ内）
      const playedPairs: [number, number][] = []
      for (const teams of Object.values(standingsByGroup)) {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            playedPairs.push([teams[i].id, teams[j].id])
          }
        }
      }

      // Core API を呼び出して日程を生成
      const result = await generateFinalDaySchedule(standingsByGroup, playedPairs)

      if (!result.success) {
        throw new Error('日程生成に失敗しました')
      }

      // 試合日（大会最終日）
      const matchDate = tournament?.endDate || new Date().toISOString().split('T')[0]

      // 決勝トーナメント会場（最初の会場を使用）
      const finalsVenueId = venues[0]?.id || 1

      // 既存の決勝トーナメント試合を削除
      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .in('stage', ['finals', 'semifinal', 'third_place', 'final'])

      // 決勝トーナメントの試合を保存
      let created = 0
      if (result.tournament && result.tournament.length > 0) {
        const tournamentMatches = result.tournament.map((m, idx) => ({
          tournament_id: tournamentId,
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          venue_id: finalsVenueId,
          match_date: matchDate,
          match_time: m.kickoff,
          match_number: 100 + idx + 1,
          stage: m.match_type === 'semifinal1' || m.match_type === 'semifinal2' ? 'semifinal' :
                 m.match_type === 'third_place' ? 'third_place' :
                 m.match_type === 'final' ? 'final' : 'finals',
          round: m.match_type,
          status: 'scheduled',
        }))

        const { error: tournamentError } = await supabase.from('matches').insert(tournamentMatches)
        if (tournamentError) console.error('Tournament insert error:', tournamentError)
        created += tournamentMatches.length
      }

      return { created, warnings: result.warnings }
    },
    onSuccess: (data) => {
      toast.success(`決勝トーナメント ${data.created}試合を生成しました`)
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }))
      }
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: any) => {
      toast.error(error.message || '日程生成に失敗しました')
    },
  })

  // 研修試合生成
  const generateTrainingMutation = useMutation({
    mutationFn: async () => {
      // Core API の接続確認
      const isHealthy = await checkCoreApiHealth()
      if (!isHealthy) {
        throw new Error('日程生成サーバーに接続できません。サーバーが起動しているか確認してください。')
      }

      // 順位表を取得
      const standingsData = await standingsApi.getAll(tournamentId)
      if (!standingsData || standingsData.length === 0) {
        throw new Error('順位表データがありません。予選リーグを先に完了してください。')
      }

      // グループ別に整理
      const standingsByGroup: Record<string, any[]> = {}
      for (const s of standingsData) {
        if (!s.group_id) continue
        if (!standingsByGroup[s.group_id]) {
          standingsByGroup[s.group_id] = []
        }
        standingsByGroup[s.group_id].push({
          id: s.team_id,
          name: s.team?.name || `Team ${s.team_id}`,
          group: s.group_id,
          rank: s.rank,
          points: s.points,
          goalDiff: s.goal_diff,
          goalsFor: s.goals_for,
        })
      }

      // 対戦済みペアを取得
      const playedPairs: [number, number][] = []
      for (const teams of Object.values(standingsByGroup)) {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            playedPairs.push([teams[i].id, teams[j].id])
          }
        }
      }

      // Core API を呼び出して日程を生成
      const result = await generateFinalDaySchedule(standingsByGroup, playedPairs)

      if (!result.success) {
        throw new Error('日程生成に失敗しました')
      }

      // 試合日（大会最終日）
      const matchDate = tournament?.endDate || new Date().toISOString().split('T')[0]

      // 既存の研修試合を削除
      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('stage', 'training')

      // 研修試合を保存
      let created = 0
      if (result.training && result.training.length > 0) {
        // 会場名からIDを取得するマップを作成
        const venueNameToId: Record<string, number> = {}
        venues.forEach(v => {
          venueNameToId[v.name] = v.id
          // 部分一致も対応
          if (v.name.includes('浦和南')) venueNameToId['浦和南高G'] = v.id
          if (v.name.includes('市立浦和')) venueNameToId['市立浦和高G'] = v.id
          if (v.name.includes('浦和学院')) venueNameToId['浦和学院高G'] = v.id
          if (v.name.includes('武南')) venueNameToId['武南高G'] = v.id
        })

        const trainingMatches = result.training.map((m, idx) => ({
          tournament_id: tournamentId,
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          venue_id: venueNameToId[m.venue] || venues[idx % venues.length]?.id || 1,
          match_date: matchDate,
          match_time: m.kickoff,
          match_number: 200 + idx + 1,
          stage: 'training',
          status: 'scheduled',
        }))

        const { error: trainingError } = await supabase.from('matches').insert(trainingMatches)
        if (trainingError) console.error('Training insert error:', trainingError)
        created += trainingMatches.length
      }

      return { created, warnings: result.warnings }
    },
    onSuccess: (data) => {
      toast.success(`研修試合 ${data.created}試合を生成しました`)
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }))
      }
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: any) => {
      toast.error(error.message || '日程生成に失敗しました')
    },
  })

  // 決勝トーナメント組み合わせ更新（Supabase版では未サポート）
  const updateBracketMutation = useMutation({
    mutationFn: async () => {
      toast.error('組み合わせ更新はSupabase版では未サポートです')
      throw new Error('未サポート')
    },
  })

  // 試合情報更新
  const updateMatchMutation = useMutation({
    mutationFn: async (data: { matchId: number; matchDate: string; matchTime: string; venueId: number; matchOrder: number }) => {
      return await matchesApi.update(data.matchId, {
        match_date: data.matchDate,
        match_time: data.matchTime,
        venue_id: data.venueId,
        match_number: data.matchOrder,
      })
    },
    onSuccess: () => {
      toast.success('日程を更新しました')
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setEditingMatch(null)
      setEditForm(null)
    },
    onError: (error: any) => {
      const message = error?.message || '更新に失敗しました'
      toast.error(message)
    },
  })

  // 編集モード開始
  const startEditing = (match: MatchWithDetails) => {
    setEditingMatch(match)
    setEditForm({
      matchDate: match.matchDate,
      matchTime: match.matchTime,
      venueId: match.venueId,
      matchOrder: match.matchOrder || 1,
    })
  }

  // 編集保存
  const saveEdit = () => {
    if (!editingMatch || !editForm) return
    updateMatchMutation.mutate({
      matchId: editingMatch.id,
      ...editForm,
    })
  }

  // チーム入れ替え（ドラッグ&ドロップ用）
  const swapTeamsMutation = useMutation({
    mutationFn: async (data: { matchId: number; homeTeamId: number; awayTeamId: number }) => {
      return await matchesApi.update(data.matchId, {
        home_team_id: data.homeTeamId,
        away_team_id: data.awayTeamId,
      })
    },
    onError: (error: any) => {
      const message = error?.message || '更新に失敗しました'
      toast.error(message)
    },
  })

  // 連打防止用ref
  const swappingRef = useRef<Set<number>>(new Set())

  // チーム入れ替えハンドラ - 複数の変更を順番に処理
  const handleSwapTeams = async (matchId: number, homeTeamId: number, awayTeamId: number) => {
    // 同じ試合に対する重複呼び出しを防止
    if (swappingRef.current.has(matchId)) {
      console.log('[SwapTeams] 重複呼び出しをスキップ:', matchId)
      return
    }
    swappingRef.current.add(matchId)

    try {
      await swapTeamsMutation.mutateAsync({ matchId, homeTeamId, awayTeamId })
      // 成功したら即座にデータを再取得
      await queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      toast.success('組み合わせを更新しました')
    } catch (error) {
      // エラーはmutation内で処理済み
    } finally {
      // 少し遅延してから解除（連打防止）
      setTimeout(() => {
        swappingRef.current.delete(matchId)
      }, 500)
    }
  }

  // 日程生成モーダルを開く
  const openGenerateModal = (type: 'preliminary' | 'finals' | 'training') => {
    setGenerateType(type)
    setShowGenerateModal(true)
  }

  // 日程生成を実行
  const handleGenerate = () => {
    switch (generateType) {
      case 'preliminary':
        generatePreliminaryMutation.mutate()
        break
      case 'finals':
        generateFinalsMutation.mutate()
        break
      case 'training':
        generateTrainingMutation.mutate()
        break
    }
  }

  // 会場名を取得
  const getVenueName = (venueId: number) => {
    const venue = venues.find(v => v.id === venueId)
    return venue?.name || `会場${venueId}`
  }

  // 現在のタブに応じた生成ボタンを表示
  const renderGenerateButtons = () => {
    const buttons = []

    if (activeTab === 'day1' || activeTab === 'day2') {
      // 予選リーグタブ
      if (!hasPreliminaryMatches) {
        buttons.push(
          <button
            key="preliminary"
            className="btn-primary"
            onClick={() => openGenerateModal('preliminary')}
            disabled={isGenerating}
          >
            予選リーグ日程を生成
          </button>
        )
      }
    } else if (activeTab === 'day3') {
      // Day3タブ
      if (hasPreliminaryMatches && !hasFinalsMatches) {
        buttons.push(
          <button
            key="finals"
            className="btn-primary"
            onClick={() => openGenerateModal('finals')}
            disabled={isGenerating}
          >
            決勝トーナメント生成
          </button>
        )
      }
      if (hasPreliminaryMatches && !hasTrainingMatches) {
        buttons.push(
          <button
            key="training"
            className="btn-secondary"
            onClick={() => openGenerateModal('training')}
            disabled={isGenerating}
          >
            研修試合生成
          </button>
        )
      }
    }

    return buttons
  }

  const isGenerating = generatePreliminaryMutation.isPending ||
                       generateFinalsMutation.isPending ||
                       generateTrainingMutation.isPending

  if (isLoadingTournament || isLoadingMatches) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日程管理</h1>
          <p className="text-gray-600 mt-1">
            試合日程の生成・編集を行います
          </p>
        </div>
      </div>

      {/* 日付選択タブ */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const dateStr = getDateString(tab.dayOffset)
              const matchCount = allMatches.filter(m => m.matchDate === dateStr).length

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div>{tab.label}</div>
                  <div className="text-xs text-gray-400">{dateStr}</div>
                  {matchCount > 0 && (
                    <span className="ml-2 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                      {matchCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 生成ボタンエリア */}
        <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600 mr-2">
            {TABS.find(t => t.key === activeTab)?.description}
          </span>
          {renderGenerateButtons()}

          {/* 試合数サマリー */}
          <div className="ml-auto text-sm text-gray-500">
            全{allMatches.length}試合 /
            予選: {allMatches.filter(m => m.stage === 'preliminary').length} /
            決勝T: {finalsMatches.length} /
            研修: {allMatches.filter(m => m.stage === 'training').length}
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="p-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">この日の試合はありません</p>
              <p className="text-sm">
                {activeTab === 'day1' || activeTab === 'day2'
                  ? (hasPreliminaryMatches
                      ? '他の日に予選リーグの試合が登録されています'
                      : '上の「予選リーグ日程を生成」ボタンから日程を作成してください')
                  : '予選リーグが終了後、決勝トーナメントと研修試合を生成できます'}
              </p>
            </div>
          ) : activeTab === 'day3' && finalsMatches.length > 0 ? (
            // 決勝トーナメントのブラケット表示
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">決勝トーナメント</h3>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => updateBracketMutation.mutate()}
                  disabled={updateBracketMutation.isPending}
                >
                  {updateBracketMutation.isPending ? '更新中...' : '組み合わせ更新'}
                </button>
              </div>
              <FinalsBracket matches={finalsMatches} onSwapTeams={handleSwapTeams} />

              {/* 研修試合の表示（ドラッグ&ドロップ対応） */}
              {hasTrainingMatches && (
                <div className="mt-8">
                  <DraggableMatchList
                    matches={allMatches.filter(m => m.stage === 'training')}
                    onSwapTeams={handleSwapTeams}
                    title="研修試合"
                    emptyMessage="研修試合がありません"
                  />
                </div>
              )}
            </div>
          ) : (
            // 通常の試合一覧（会場別カード表示）
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {venues.map(venue => {
                const venueMatches = filteredMatches.filter(m => m.venueId === venue.id)
                if (venueMatches.length === 0) return null

                // 会場ごとの配色
                const venueColors = {
                  A: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
                  B: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
                  C: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
                  D: { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
                  default: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
                }
                const colors = venueColors[venue.groupId as keyof typeof venueColors] || venueColors.default

                return (
                  <div key={venue.id} className={`rounded-lg border-2 ${colors.border} ${colors.bg} overflow-hidden`}>
                    {/* 会場ヘッダー */}
                    <div className={`px-4 py-2 ${colors.header} font-semibold flex items-center gap-2`}>
                      <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                      <span>{venue.name}</span>
                      {venue.groupId && <span className="text-xs opacity-75">({venue.groupId}組)</span>}
                      <span className="ml-auto text-xs font-normal opacity-75">{venueMatches.length}試合</span>
                    </div>
                    {/* 試合リスト */}
                    <div className="p-2 space-y-1">
                      {venueMatches.map(match => (
                        <div
                          key={match.id}
                          className="p-2 bg-white rounded border border-gray-200 hover:shadow-md cursor-pointer transition-shadow"
                          onClick={() => setSelectedMatch(match)}
                        >
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>#{match.matchOrder} {match.matchTime}</span>
                            <StatusBadge status={match.status} />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate flex-1">{match.homeTeam?.name}</span>
                            <span className="mx-2 font-bold text-gray-700">
                              {match.homeScoreTotal ?? '-'} - {match.awayScoreTotal ?? '-'}
                            </span>
                            <span className="font-medium truncate flex-1 text-right">{match.awayTeam?.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 日程生成確認モーダル */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={
          generateType === 'preliminary' ? '予選リーグ日程生成' :
          generateType === 'finals' ? '決勝トーナメント生成' :
          '研修試合生成'
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {generateType === 'preliminary' && (
              <>
                予選リーグの日程を自動生成します。
                <br />
                <span className="text-sm text-gray-500">
                  ※ 各グループ6チーム、対戦除外設定に基づき12試合ずつ生成されます。
                </span>
              </>
            )}
            {generateType === 'finals' && (
              <>
                決勝トーナメントの日程を生成します。
                <br />
                <span className="text-sm text-gray-500">
                  ※ 各グループ1位チームによる準決勝・3位決定戦・決勝を生成します。
                </span>
              </>
            )}
            {generateType === 'training' && (
              <>
                研修試合の日程を生成します。
                <br />
                <span className="text-sm text-gray-500">
                  ※ 各グループの2〜6位チームによる研修試合を生成します。
                </span>
              </>
            )}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => setShowGenerateModal(false)}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? '生成中...' : '生成する'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 試合詳細モーダル */}
      <Modal
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        title="試合詳細"
      >
        {selectedMatch && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">
                {selectedMatch.matchDate} {selectedMatch.matchTime} @ {getVenueName(selectedMatch.venueId)}
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="font-bold text-lg">{selectedMatch.homeTeam?.name}</div>
                </div>
                <div className="text-3xl font-bold">
                  {selectedMatch.homeScoreTotal ?? '-'} - {selectedMatch.awayScoreTotal ?? '-'}
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{selectedMatch.awayTeam?.name}</div>
                </div>
              </div>
              {selectedMatch.hasPenaltyShootout && (
                <div className="text-sm text-gray-500 mt-2">
                  PK: {selectedMatch.homePK} - {selectedMatch.awayPK}
                </div>
              )}
            </div>

            {/* ハーフタイムスコア */}
            {(selectedMatch.homeScoreHalf1 !== null || selectedMatch.awayScoreHalf1 !== null) && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-center">
                  <div>
                    <div className="text-gray-500">前半</div>
                    <div className="font-medium">
                      {selectedMatch.homeScoreHalf1 ?? '-'} - {selectedMatch.awayScoreHalf1 ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">後半</div>
                    <div className="font-medium">
                      {selectedMatch.homeScoreHalf2 ?? '-'} - {selectedMatch.awayScoreHalf2 ?? '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn-secondary"
                onClick={() => setSelectedMatch(null)}
              >
                閉じる
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  startEditing(selectedMatch)
                  setSelectedMatch(null)
                }}
              >
                日程編集
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  window.location.href = '/results'
                }}
              >
                結果入力
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 日程編集モーダル */}
      <Modal
        isOpen={!!editingMatch}
        onClose={() => {
          setEditingMatch(null)
          setEditForm(null)
        }}
        title="日程編集"
      >
        {editingMatch && editForm && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <div className="font-bold">
                {editingMatch.homeTeam?.name} vs {editingMatch.awayTeam?.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.matchDate}
                  onChange={(e) => setEditForm({ ...editForm, matchDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={editForm.matchTime}
                  onChange={(e) => setEditForm({ ...editForm, matchTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会場
                </label>
                <select
                  className="form-input"
                  value={editForm.venueId}
                  onChange={(e) => setEditForm({ ...editForm, venueId: parseInt(e.target.value) })}
                >
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  試合順
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={editForm.matchOrder}
                  onChange={(e) => setEditForm({ ...editForm, matchOrder: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingMatch(null)
                  setEditForm(null)
                }}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={saveEdit}
                disabled={updateMatchMutation.isPending}
              >
                {updateMatchMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default MatchSchedule
