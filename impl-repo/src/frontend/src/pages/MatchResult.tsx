/**
 * 試合結果入力画面
 * スコア・得点者の入力
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId } from '../hooks/useTournament'

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
  homeScoreHalf1: number | null
  homeScoreHalf2: number | null
  awayScoreHalf1: number | null
  awayScoreHalf2: number | null
  homeScoreTotal: number | null
  awayScoreTotal: number | null
  homePK: number | null
  awayPK: number | null
  hasPenaltyShootout: boolean
  status: string
}

interface GoalInput {
  id: string
  teamId: number
  teamType: 'home' | 'away'
  minute: number
  half: 1 | 2
  scorerName: string
  playerId: number | null
  isOwnGoal: boolean
}

interface Venue {
  id: number
  name: string
}

export function MatchResult() {
  const tournamentId = useTournamentId()
  const queryClient = useQueryClient()

  const [dateFilter, setDateFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [scoreForm, setScoreForm] = useState({
    homeScoreHalf1: 0,
    homeScoreHalf2: 0,
    awayScoreHalf1: 0,
    awayScoreHalf2: 0,
    homePK: 0,
    awayPK: 0,
    hasPenaltyShootout: false,
  })
  const [goals, setGoals] = useState<GoalInput[]>([])

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
    queryKey: ['matches-for-result', tournamentId, dateFilter, venueFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { tournament_id: tournamentId, limit: 500 }
      if (dateFilter) params.match_date = dateFilter
      if (venueFilter) params.venue_id = parseInt(venueFilter)
      if (statusFilter === 'pending') params.status = 'scheduled'
      if (statusFilter === 'completed') params.status = 'completed'

      const res = await axios.get('/api/matches', { params })
      return res.data.matches || res.data
    },
    enabled: !!tournamentId,
  })

  // 日付リストを抽出
  const availableDates = [...new Set(matches.map(m => m.matchDate))].sort()

  // 結果保存Mutation
  const saveScoreMutation = useMutation({
    mutationFn: async (data: { matchId: number; score: typeof scoreForm; goals: GoalInput[] }) => {
      await axios.put(`/api/matches/${data.matchId}/score`, {
        homeScoreHalf1: data.score.homeScoreHalf1,
        homeScoreHalf2: data.score.homeScoreHalf2,
        awayScoreHalf1: data.score.awayScoreHalf1,
        awayScoreHalf2: data.score.awayScoreHalf2,
        hasPenaltyShootout: data.score.hasPenaltyShootout,
        homePK: data.score.hasPenaltyShootout ? data.score.homePK : null,
        awayPK: data.score.hasPenaltyShootout ? data.score.awayPK : null,
        goals: data.goals.map(g => ({
          teamId: g.teamId,
          playerId: g.playerId,
          scorerName: g.scorerName,
          minute: g.minute,
          half: g.half,
          isOwnGoal: g.isOwnGoal,
        })),
      })
    },
    onSuccess: () => {
      toast.success('試合結果を保存しました')
      queryClient.invalidateQueries({ queryKey: ['matches-for-result', tournamentId] })
      setShowModal(false)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'エラーが発生しました')
      toast.error(`スコアの保存に失敗しました: ${message}`)
    },
  })

  const openScoreModal = (match: Match) => {
    setSelectedMatch(match)
    setScoreForm({
      homeScoreHalf1: match.homeScoreHalf1 ?? 0,
      homeScoreHalf2: match.homeScoreHalf2 ?? 0,
      awayScoreHalf1: match.awayScoreHalf1 ?? 0,
      awayScoreHalf2: match.awayScoreHalf2 ?? 0,
      homePK: match.homePK ?? 0,
      awayPK: match.awayPK ?? 0,
      hasPenaltyShootout: match.hasPenaltyShootout ?? false,
    })
    setGoals([])
    setShowModal(true)
  }

  const addGoal = () => {
    if (!selectedMatch) return
    setGoals(prev => [...prev, {
      id: `new-${Date.now()}`,
      teamId: selectedMatch.homeTeamId,
      teamType: 'home',
      minute: 1,
      half: 1,
      scorerName: '',
      playerId: null,
      isOwnGoal: false,
    }])
  }

  const removeGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const updateGoal = (id: string, updates: Partial<GoalInput>) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g
      const updated = { ...g, ...updates }
      if (updates.teamType && selectedMatch) {
        updated.teamId = updates.teamType === 'home' ? selectedMatch.homeTeamId : selectedMatch.awayTeamId
      }
      return updated
    }))
  }

  const handleSave = () => {
    if (!selectedMatch) return
    saveScoreMutation.mutate({
      matchId: selectedMatch.id,
      score: scoreForm,
      goals,
    })
  }

  const homeTotal = scoreForm.homeScoreHalf1 + scoreForm.homeScoreHalf2
  const awayTotal = scoreForm.awayScoreHalf1 + scoreForm.awayScoreHalf2

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">試合結果入力</h2>
        <p className="text-gray-600 mt-1">試合のスコアと得点者を入力します</p>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="">全日程</option>
              {availableDates.map((date, idx) => (
                <option key={date} value={date}>Day{idx + 1} ({date})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">会場</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
            >
              <option value="">全会場</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">すべて</option>
              <option value="pending">未入力</option>
              <option value="completed">入力済み</option>
            </select>
          </div>
        </div>
      </div>

      {/* 試合一覧 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">試合データがありません</div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  #{match.matchOrder} {match.matchTime} @ {match.venueName}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  match.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {match.status === 'completed' ? '完了' : '未入力'}
                </span>
              </div>

              <div className="flex justify-between items-center mt-3">
                <div className="flex-1 text-right font-bold text-lg">{match.homeTeamName ?? "TBD"}</div>
                <div className="mx-4 text-2xl font-bold bg-gray-100 px-4 py-1 rounded">
                  {match.homeScoreTotal ?? '-'} - {match.awayScoreTotal ?? '-'}
                </div>
                <div className="flex-1 text-left font-bold text-lg">{match.awayTeamName ?? "TBD"}</div>
              </div>

              <div className="mt-4 text-right">
                <button
                  onClick={() => openScoreModal(match)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  {match.status === 'completed' ? '修正' : '結果入力'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 結果入力モーダル */}
      {showModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl my-8">
            <h3 className="text-lg font-bold mb-4">試合結果入力</h3>

            <div className="text-center text-sm text-gray-500 mb-4">
              {selectedMatch.matchDate} {selectedMatch.matchTime}
            </div>

            {/* チーム名とスコア */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center flex-1">
                <div className="font-bold text-lg">{selectedMatch.homeTeamName ?? "TBD"}</div>
                <div className="text-3xl font-bold text-red-600 mt-2">{homeTotal}</div>
              </div>
              <div className="text-2xl text-gray-400">vs</div>
              <div className="text-center flex-1">
                <div className="font-bold text-lg">{selectedMatch.awayTeamName ?? "TBD"}</div>
                <div className="text-3xl font-bold text-red-600 mt-2">{awayTotal}</div>
              </div>
            </div>

            {/* 前半スコア */}
            <div className="border rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-700 mb-3">前半</h4>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                  value={scoreForm.homeScoreHalf1}
                  onChange={(e) => setScoreForm(prev => ({ ...prev, homeScoreHalf1: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                  value={scoreForm.awayScoreHalf1}
                  onChange={(e) => setScoreForm(prev => ({ ...prev, awayScoreHalf1: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* 後半スコア */}
            <div className="border rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-700 mb-3">後半</h4>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                  value={scoreForm.homeScoreHalf2}
                  onChange={(e) => setScoreForm(prev => ({ ...prev, homeScoreHalf2: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                  value={scoreForm.awayScoreHalf2}
                  onChange={(e) => setScoreForm(prev => ({ ...prev, awayScoreHalf2: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* PK戦 */}
            <div className="border rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="hasPK"
                  checked={scoreForm.hasPenaltyShootout}
                  onChange={(e) => setScoreForm(prev => ({ ...prev, hasPenaltyShootout: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="hasPK" className="font-medium text-gray-700">PK戦</label>
              </div>
              {scoreForm.hasPenaltyShootout && (
                <div className="flex items-center justify-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                    value={scoreForm.homePK}
                    onChange={(e) => setScoreForm(prev => ({ ...prev, homePK: parseInt(e.target.value) || 0 }))}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="w-20 px-3 py-2 border rounded text-center text-xl font-bold"
                    value={scoreForm.awayPK}
                    onChange={(e) => setScoreForm(prev => ({ ...prev, awayPK: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              )}
            </div>

            {/* 得点者入力 */}
            <div className="border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-700">得点者</h4>
                <button type="button" className="text-sm text-red-600 hover:text-red-800" onClick={addGoal}>+ 追加</button>
              </div>
              {goals.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">得点者を追加してください</p>
              ) : (
                <div className="space-y-2">
                  {goals.map((goal) => (
                    <div key={goal.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        className="w-16 px-2 py-1 border rounded text-center text-sm"
                        value={goal.minute}
                        onChange={(e) => updateGoal(goal.id, { minute: parseInt(e.target.value) || 1 })}
                        placeholder="分"
                      />
                      <select
                        className="px-2 py-1 border rounded text-sm"
                        value={goal.half}
                        onChange={(e) => updateGoal(goal.id, { half: parseInt(e.target.value) as 1 | 2 })}
                      >
                        <option value={1}>前半</option>
                        <option value={2}>後半</option>
                      </select>
                      <select
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        value={goal.teamType}
                        onChange={(e) => updateGoal(goal.id, { teamType: e.target.value as 'home' | 'away' })}
                      >
                        <option value="home">{selectedMatch.homeTeamName ?? "TBD"}</option>
                        <option value="away">{selectedMatch.awayTeamName ?? "TBD"}</option>
                      </select>
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        value={goal.scorerName}
                        onChange={(e) => updateGoal(goal.id, { scorerName: e.target.value })}
                        placeholder="得点者名"
                      />
                      <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={goal.isOwnGoal}
                          onChange={(e) => updateGoal(goal.id, { isOwnGoal: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        OG
                      </label>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 px-2"
                        onClick={() => removeGoal(goal.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ボタン */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saveScoreMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {saveScoreMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
