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
import { useCreateTournament, useTournaments } from '@/features/tournaments/hooks'
import { useAppStore } from '@/stores/appStore'
import { Copy, ChevronDown, Calendar, Trophy, Check } from 'lucide-react'

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
  // appStoreから現在のトーナメントIDを取得
  const tournamentId = currentTournament?.id || 1

  // 大会設定フォーム
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    shortName: '',
    edition: 0,
    startDate: '',
    endDate: '',
    matchDuration: 50,
    intervalMinutes: 15,
    groupCount: 4,
    teamsPerGroup: 4,
    advancingTeams: 1,
  })

  // 会場編集モーダル
  const [showVenueModal, setShowVenueModal] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [venueForm, setVenueForm] = useState({
    name: '',
    address: '',
    groupId: '',
    maxMatchesPerDay: 6,
    forFinalDay: false,
    isFinalsVenue: false,
  })
  const [showAddVenueModal, setShowAddVenueModal] = useState(false)
  const [addVenueForm, setAddVenueForm] = useState({
    name: '',
    shortName: '',
    address: '',
    groupId: '',
    pitchCount: 1,
    forFinalDay: false,
    isFinalsVenue: false,
  })

  // 新規大会作成モーダル
  const [showNewTournamentModal, setShowNewTournamentModal] = useState(false)
  const [createMode, setCreateMode] = useState<'new' | 'copy'>('new')
  const [copySourceTournamentId, setCopySourceTournamentId] = useState<number | null>(null)
  const [newTournamentForm, setNewTournamentForm] = useState({
    name: '',
    shortName: '',
    edition: 1,
    year: new Date().getFullYear(),
    startDate: '',
    endDate: '',
    matchDuration: 50,
    halfDuration: 10,
    intervalMinutes: 10,
  })

  // 大会セレクター
  const [showTournamentSelector, setShowTournamentSelector] = useState(false)

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

  // 全大会一覧を取得（セレクター・コピー元用）
  const { data: allTournaments = [] } = useQuery({
    queryKey: ['tournaments', 'all'],
    queryFn: async () => {
      const data = await tournamentsApi.getAll()
      return data.map((t: Record<string, unknown>) => ({
        ...t,
        shortName: t.short_name,
        startDate: t.start_date,
        endDate: t.end_date,
      })) as Tournament[]
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
        matchDuration: tournament.matchDuration || 50,
        intervalMinutes: tournament.intervalMinutes || 15,
        groupCount: tournament.groupCount || 4,
        teamsPerGroup: tournament.teamsPerGroup || 4,
        advancingTeams: tournament.advancingTeams || 1,
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
      matchDuration: number;
      intervalMinutes: number;
      groupCount: number;
      teamsPerGroup: number;
      advancingTeams: number;
    }) => {
      const updated = await tournamentsApi.update(tournamentId, {
        name: data.name,
        short_name: data.shortName,
        start_date: data.startDate,
        end_date: data.endDate,
      })
      return {
        ...updated,
        shortName: updated.short_name,
        startDate: updated.start_date,
        endDate: updated.end_date,
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

  // 会場一覧を取得
  const { data: venueData, isLoading: isLoadingVenues } = useQuery({
    queryKey: ['venues', tournamentId],
    queryFn: async () => {
      const data = await venuesApi.getAll(tournamentId)
      return { venues: data, total: data.length }
    },
  })
  const venues = venueData?.venues ?? []


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
      forFinalDay?: boolean;
      isFinalsVenue?: boolean;
    }) => {
      const { id, ...rest } = data
      if (import.meta.env.DEV) console.log('[updateVenueMutation] Sending to Supabase:', rest)
      const { data: venue, error } = await supabase
        .from('venues')
        .update({
          name: rest.name,
          address: rest.address,
          // Note: 実際のテーブルカラムに合わせて調整
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
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

  // 会場編集モーダルを開く
  const openVenueModal = (venue: Venue) => {
    setSelectedVenue(venue)
    setVenueForm({
      name: venue.name,
      address: venue.address || '',
      groupId: venue.groupId || venue.group_id || '',
      maxMatchesPerDay: venue.maxMatchesPerDay ?? venue.max_matches_per_day ?? 6,
      forFinalDay: venue.forFinalDay ?? venue.for_final_day ?? false,
      isFinalsVenue: venue.isFinalsVenue ?? venue.is_finals_venue ?? false,
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
      forFinalDay: venueForm.forFinalDay,      // false も明示的に送信
      isFinalsVenue: venueForm.isFinalsVenue,  // false も明示的に送信
    }
    if (import.meta.env.DEV) console.log('[handleSaveVenue] Sending payload:', payload)

    updateVenueMutation.mutate(payload)
  }

  // 大会を切り替え
  const handleSwitchTournament = (t: Tournament) => {
    setCurrentTournament(t)
    setShowTournamentSelector(false)
    queryClient.invalidateQueries({ queryKey: ['tournament'] })
    queryClient.invalidateQueries({ queryKey: ['venues'] })
    toast.success(`大会を「${t.shortName || t.name}」に切り替えました`)
  }

  // コピー元大会を選択したときの処理
  const handleSelectCopySource = (sourceId: number) => {
    setCopySourceTournamentId(sourceId)
    const source = allTournaments.find(t => t.id === sourceId)
    if (source) {
      setNewTournamentForm(prev => ({
        ...prev,
        name: source.name,
        shortName: source.shortName || '',
        edition: (source.edition || 0) + 1,
        year: new Date().getFullYear(),
        matchDuration: source.matchDuration || 50,
        halfDuration: 10,
        intervalMinutes: source.intervalMinutes || 5,
      }))
    }
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
          setCreateMode('new')
          setCopySourceTournamentId(null)
          setNewTournamentForm({
            name: '',
            shortName: '',
            edition: 1,
            year: new Date().getFullYear(),
            startDate: '',
            endDate: '',
            matchDuration: 50,
            halfDuration: 10,
            intervalMinutes: 10,
          })
          // 作成した大会に自動切り替え
          setCurrentTournament(newTournament)
          queryClient.invalidateQueries({ queryKey: ['tournaments'] })
          toast.success(`大会「${newTournament.name}」を作成し、切り替えました`)
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
        forFinalDay: addVenueForm.forFinalDay,
        isFinalsVenue: addVenueForm.isFinalsVenue,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['venues', tournamentId] })
          setShowAddVenueModal(false)
          setAddVenueForm({ name: '', shortName: '', address: '', groupId: '', pitchCount: 1, forFinalDay: false, isFinalsVenue: false })
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
        <div className="flex items-center gap-3">
          {/* 大会セレクター */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 min-w-[200px]"
              onClick={() => setShowTournamentSelector(!showTournamentSelector)}
            >
              <Trophy size={18} className="text-primary-600" />
              <span className="font-medium text-gray-800 truncate">
                {tournament?.shortName || tournament?.name || '大会を選択'}
              </span>
              <ChevronDown size={18} className="ml-auto text-gray-500" />
            </button>

            {showTournamentSelector && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowTournamentSelector(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-lg shadow-xl border z-20 max-h-96 overflow-auto">
                  <div className="p-2 border-b bg-gray-50">
                    <span className="text-xs text-gray-500 font-medium">大会を選択</span>
                  </div>
                  {allTournaments.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      大会がありません
                    </div>
                  ) : (
                    allTournaments.map((t) => (
                      <button
                        key={t.id}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0 ${
                          t.id === tournamentId ? 'bg-primary-50' : ''
                        }`}
                        onClick={() => handleSwitchTournament(t)}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {t.shortName || t.name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <Calendar size={12} />
                            {t.startDate} 〜 {t.endDate}
                            {t.edition && <span className="ml-2">第{t.edition}回</span>}
                          </div>
                        </div>
                        {t.id === tournamentId && (
                          <Check size={18} className="text-primary-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              setCreateMode('new')
              setCopySourceTournamentId(null)
              setNewTournamentForm({
                name: '',
                shortName: '',
                edition: 1,
                year: new Date().getFullYear(),
                startDate: '',
                endDate: '',
                matchDuration: 50,
                halfDuration: 10,
                intervalMinutes: 10,
              })
              setShowNewTournamentModal(true)
            }}
          >
            + 新規大会作成
          </button>
        </div>
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
              <label className="form-label">開始日</label>
              <input
                type="date"
                className="form-input"
                value={tournamentForm.startDate}
                onChange={(e) => setTournamentForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">終了日</label>
              <input
                type="date"
                className="form-input"
                value={tournamentForm.endDate}
                min={tournamentForm.startDate || undefined}
                onChange={(e) => setTournamentForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">試合時間（分）</label>
              <input
                type="number"
                className="form-input"
                value={tournamentForm.matchDuration}
                placeholder="50"
                onChange={(e) => setTournamentForm(prev => ({ ...prev, matchDuration: parseInt(e.target.value) || 50 }))}
              />
            </div>
            <div>
              <label className="form-label">試合間隔（分）</label>
              <input
                type="number"
                className="form-input"
                value={tournamentForm.intervalMinutes}
                placeholder="15"
                onChange={(e) => setTournamentForm(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 15 }))}
              />
            </div>
          </div>

          {/* チーム構成設定 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">チーム構成設定</h4>
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
            </div>
            <p className="text-xs text-gray-500 mt-2">
              総チーム数: {tournamentForm.groupCount * tournamentForm.teamsPerGroup}チーム /
              決勝T参加: {tournamentForm.groupCount * tournamentForm.advancingTeams}チーム
            </p>
          </div>

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
                <th>最終日設定</th>
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
                  const forFinalDay = venue.forFinalDay ?? venue.for_final_day ?? false;
                  const isFinalsVenue = venue.isFinalsVenue ?? venue.is_finals_venue ?? false;
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
                          {forFinalDay && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              順位リーグ
                            </span>
                          )}
                          {isFinalsVenue && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                              決勝会場
                            </span>
                          )}
                          {!forFinalDay && !isFinalsVenue && (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td>{venue.maxMatchesPerDay ?? venue.max_matches_per_day}</td>
                      <td>
                        <button
                          className="text-primary-600 hover:text-primary-800 text-sm"
                          onClick={() => openVenueModal(venue)}
                        >
                          編集
                        </button>
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

      {/* 新規大会作成モーダル */}
      <Modal
        isOpen={showNewTournamentModal}
        onClose={() => setShowNewTournamentModal(false)}
        title="新規大会作成"
      >
        <div className="space-y-4">
          {/* 作成モード選択 */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                createMode === 'new'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => {
                setCreateMode('new')
                setCopySourceTournamentId(null)
                setNewTournamentForm({
                  name: '',
                  shortName: '',
                  edition: 1,
                  year: new Date().getFullYear(),
                  startDate: '',
                  endDate: '',
                  matchDuration: 50,
                  halfDuration: 10,
                  intervalMinutes: 10,
                })
              }}
            >
              新規作成
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                createMode === 'copy'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setCreateMode('copy')}
            >
              <Copy size={16} />
              過去大会からコピー
            </button>
          </div>

          {/* コピー元選択（コピーモードのみ） */}
          {createMode === 'copy' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="form-label text-blue-800">コピー元の大会を選択</label>
              <select
                className="form-input mt-1"
                value={copySourceTournamentId || ''}
                onChange={(e) => handleSelectCopySource(Number(e.target.value))}
              >
                <option value="">選択してください...</option>
                {allTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName || t.name} {t.edition && `(第${t.edition}回)`}
                  </option>
                ))}
              </select>
              {copySourceTournamentId && (
                <p className="text-sm text-blue-700 mt-2">
                  ※ 大会設定がコピーされます。日程とチームは新しく設定してください。
                </p>
              )}
            </div>
          )}

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
              <label className="form-label">ハーフタイム（前後半間の休憩・分）</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={60}
                value={newTournamentForm.halfDuration}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, halfDuration: parseInt(e.target.value) || 5 }))}
              />
            </div>
            <div>
              <label className="form-label">試合間隔（分）</label>
              <input
                type="number"
                className="form-input"
                min={5}
                max={60}
                value={newTournamentForm.intervalMinutes}
                onChange={(e) => setNewTournamentForm(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 5 }))}
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
            <h4 className="font-medium mb-3 text-gray-700">最終日（順位リーグ・決勝）設定</h4>
            <div className="space-y-3">
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
            <h4 className="font-medium mb-3 text-gray-700">最終日（順位リーグ・決勝）設定</h4>
            <div className="space-y-3">
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
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ 決勝トーナメント会場は1つのみ選択してください
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
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
      </Modal>
    </div>
  )
}

export default Settings
