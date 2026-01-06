/**
 * 日程管理画面
 * 予選リーグ・決勝トーナメントの日程管理
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId, useTournament } from '../hooks/useTournament'

/**
 * エラーメッセージを取得するヘルパー関数
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message
    }
    if (error.response?.data?.detail) {
      return error.response.data.detail
    }
    if (!error.response) {
      return 'サーバーに接続できません'
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

interface Match {
  id: number
  matchDate: string
  matchTime: string
  matchOrder: number
  venueId: number
  venueName?: string
  homeTeamId: number
  awayTeamId: number
  homeTeamName?: string
  awayTeamName?: string
  homeScoreTotal: number | null
  awayScoreTotal: number | null
  stage: string
  status: string
  groupId: string | null
}

interface Venue {
  id: number
  name: string
  groupId: string | null
}

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

const statusLabels: Record<string, { label: string; className: string }> = {
  scheduled: { label: '予定', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: '試合中', className: 'bg-yellow-100 text-yellow-800' },
  completed: { label: '終了', className: 'bg-green-100 text-green-800' },
  cancelled: { label: '中止', className: 'bg-red-100 text-red-700' },
}

export function MatchSchedule() {
  const tournamentId = useTournamentId()
  const tournament = useTournament()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabKey>('day1')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateType, setGenerateType] = useState<'preliminary' | 'finals' | 'training' | null>(null)

  // 会場一覧を取得
  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ['venues', tournamentId],
    queryFn: async () => {
      const res = await axios.get('/api/venues', {
        params: { tournament_id: tournamentId }
      })
      return res.data.venues || res.data
    },
    enabled: !!tournamentId,
  })

  // 試合一覧を取得
  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const res = await axios.get('/api/matches', {
        params: { tournament_id: tournamentId, limit: 500 }
      })
      return res.data.matches || res.data
    },
    enabled: !!tournamentId,
  })

  // 日付文字列を取得
  const getDateString = (dayOffset: number) => {
    if (!tournament?.startDate) return ''
    const startDate = new Date(tournament.startDate)
    startDate.setDate(startDate.getDate() + dayOffset)
    return startDate.toISOString().split('T')[0]
  }

  // タブに対応する試合をフィルタリング
  const filteredMatches = useMemo(() => {
    if (!tournament || matches.length === 0) return []

    const tabInfo = TABS.find(t => t.key === activeTab)
    if (!tabInfo) return []

    const targetDateStr = getDateString(tabInfo.dayOffset)

    return matches
      .filter(match => match.matchDate === targetDateStr)
      .sort((a, b) => {
        if (a.venueId !== b.venueId) return a.venueId - b.venueId
        return a.matchOrder - b.matchOrder
      })
  }, [matches, activeTab, tournament])

  // 予選リーグ/決勝/研修試合の存在確認
  const hasPreliminary = matches.some(m => m.stage === 'preliminary')
  const hasFinals = matches.some(m => ['semifinal', 'third_place', 'final'].includes(m.stage))
  const hasTraining = matches.some(m => m.stage === 'training')

  // 予選リーグ生成
  const generatePreliminaryMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`/api/matches/generate-schedule/${tournamentId}`, null, {
        params: { start_time: '09:30' }
      })
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`予選リーグ ${data.total}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'エラーが発生しました')
      toast.error(`予選リーグ日程生成に失敗しました: ${message}`)
    },
  })

  // 決勝トーナメント生成
  const generateFinalsMutation = useMutation({
    mutationFn: async () => {
      const day3Str = getDateString(2)
      const res = await axios.post(`/api/matches/generate-finals/${tournamentId}`, null, {
        params: { match_date: day3Str, start_time: '09:00' }
      })
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`決勝トーナメント ${data.total}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'エラーが発生しました')
      toast.error(`決勝トーナメント生成に失敗しました: ${message}`)
    },
  })

  // 研修試合生成
  const generateTrainingMutation = useMutation({
    mutationFn: async () => {
      const day3Str = getDateString(2)
      const res = await axios.post(`/api/matches/generate-training/${tournamentId}`, null, {
        params: { match_date: day3Str, start_time: '09:00' }
      })
      return res.data
    },
    onSuccess: (data) => {
      toast.success(`研修試合 ${data.total}試合を生成しました`)
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] })
      setShowGenerateModal(false)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'エラーが発生しました')
      toast.error(`研修試合生成に失敗しました: ${message}`)
    },
  })

  const isGenerating = generatePreliminaryMutation.isPending || generateFinalsMutation.isPending || generateTrainingMutation.isPending

  const openGenerateModal = (type: 'preliminary' | 'finals' | 'training') => {
    setGenerateType(type)
    setShowGenerateModal(true)
  }

  const handleGenerate = () => {
    if (generateType === 'preliminary') generatePreliminaryMutation.mutate()
    else if (generateType === 'finals') generateFinalsMutation.mutate()
    else if (generateType === 'training') generateTrainingMutation.mutate()
  }

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  // 会場ごとにグループ化
  const matchesByVenue = filteredMatches.reduce<Record<number, Match[]>>((acc, match) => {
    if (!acc[match.venueId]) acc[match.venueId] = []
    acc[match.venueId].push(match)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">日程管理</h2>
          <p className="text-gray-600 mt-1">試合日程の生成・編集を行います</p>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => {
              const dateStr = getDateString(tab.dayOffset)
              const matchCount = matches.filter(m => m.matchDate === dateStr).length

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === tab.key
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div>{tab.label}</div>
                  <div className="text-xs text-gray-400">{dateStr}</div>
                  {matchCount > 0 && (
                    <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                      {matchCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 生成ボタン */}
        <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600 mr-2">
            {TABS.find(t => t.key === activeTab)?.description}
          </span>

          {(activeTab === 'day1' || activeTab === 'day2') && !hasPreliminary && (
            <button
              onClick={() => openGenerateModal('preliminary')}
              disabled={isGenerating}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              予選リーグ日程を生成
            </button>
          )}

          {(activeTab === 'day1' || activeTab === 'day2') && hasPreliminary && (
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm">
              予選試合は既に生成されています
            </span>
          )}

          {activeTab === 'day3' && hasPreliminary && !hasFinals && (
            <button
              onClick={() => openGenerateModal('finals')}
              disabled={isGenerating}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              決勝トーナメント生成
            </button>
          )}

          {activeTab === 'day3' && hasFinals && (
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm">
              決勝トーナメントは既に生成されています
            </span>
          )}

          {activeTab === 'day3' && hasPreliminary && !hasTraining && (
            <button
              onClick={() => openGenerateModal('training')}
              disabled={isGenerating}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-400"
            >
              研修試合生成
            </button>
          )}

          {activeTab === 'day3' && hasTraining && (
            <span className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm">
              研修試合は既に生成されています
            </span>
          )}

          <div className="ml-auto text-sm text-gray-500">
            全{matches.length}試合 /
            予選: {matches.filter(m => m.stage === 'preliminary').length} /
            決勝T: {matches.filter(m => ['semifinal', 'third_place', 'final'].includes(m.stage)).length} /
            研修: {matches.filter(m => m.stage === 'training').length}
          </div>
        </div>

        {/* 試合一覧 */}
        <div className="p-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">この日の試合はありません</p>
              <p className="text-sm">
                {activeTab === 'day1' || activeTab === 'day2'
                  ? '「予選リーグ日程を生成」ボタンから日程を作成してください'
                  : '予選リーグ終了後、決勝トーナメントと研修試合を生成できます'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {venues.map(venue => {
                const venueMatches = matchesByVenue[venue.id] || []
                if (venueMatches.length === 0) return null

                const colors: Record<string, { bg: string; border: string; header: string }> = {
                  A: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800' },
                  B: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800' },
                  C: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100 text-green-800' },
                  D: { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100 text-yellow-800' },
                }
                const color = colors[venue.groupId || ''] || { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800' }

                return (
                  <div key={venue.id} className={`rounded-lg border-2 ${color.border} ${color.bg} overflow-hidden`}>
                    <div className={`px-4 py-2 ${color.header} font-semibold flex items-center gap-2`}>
                      <span>{venue.name}</span>
                      {venue.groupId && <span className="text-xs opacity-75">({venue.groupId}組)</span>}
                      <span className="ml-auto text-xs font-normal opacity-75">{venueMatches.length}試合</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {venueMatches.map(match => (
                        <div
                          key={match.id}
                          className="p-2 bg-white rounded border border-gray-200 hover:shadow-md cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>#{match.matchOrder} {match.matchTime}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusLabels[match.status]?.className || 'bg-gray-100'}`}>
                              {statusLabels[match.status]?.label || match.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate flex-1">{match.homeTeamName ?? "TBD"}</span>
                            <span className="mx-2 font-bold text-gray-700">
                              {match.homeScoreTotal ?? '-'} - {match.awayScoreTotal ?? '-'}
                            </span>
                            <span className="font-medium truncate flex-1 text-right">{match.awayTeamName ?? "TBD"}</span>
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

      {/* 生成確認モーダル */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4">
              {generateType === 'preliminary' ? '予選リーグ日程生成' :
               generateType === 'finals' ? '決勝トーナメント生成' :
               '研修試合生成'}
            </h3>
            <p className="text-gray-600 mb-4">
              {generateType === 'preliminary' && '予選リーグの日程を自動生成します。各グループ6チーム、対戦除外設定に基づき試合が生成されます。'}
              {generateType === 'finals' && '決勝トーナメントの日程を生成します。各グループ1位チームによる準決勝・3位決定戦・決勝を生成します。'}
              {generateType === 'training' && '研修試合の日程を生成します。各グループの2〜6位チームによる研修試合を生成します。'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {isGenerating ? '生成中...' : '生成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
