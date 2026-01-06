/**
 * 試合結果承認画面
 * 管理者が試合結果を確認・承認・却下する
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId } from '../hooks/useTournament'

interface Match {
  id: number
  matchDate: string
  matchTime: string
  matchOrder: number
  venueName?: string
  homeTeamId: number
  awayTeamId: number
  homeTeamName?: string
  awayTeamName?: string
  homeTeamShortName?: string
  awayTeamShortName?: string
  homeScoreTotal: number | null
  awayScoreTotal: number | null
  homePK: number | null
  awayPK: number | null
  hasPenaltyShootout: boolean
  approvalStatus: string
}

export function MatchApproval() {
  const tournamentId = useTournamentId()
  const queryClient = useQueryClient()

  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // 承認待ち試合を取得（10秒ごとに自動更新）
  const { data: matches = [], isLoading, error, refetch, isFetching } = useQuery<Match[]>({
    queryKey: ['pending-matches', tournamentId],
    queryFn: async () => {
      const res = await axios.get('/api/matches', {
        params: { tournament_id: tournamentId, approval_status: 'pending' }
      })
      return res.data.matches || res.data
    },
    enabled: !!tournamentId,
    refetchInterval: 10000, // 10秒ごとに自動更新
  })

  // 承認Mutation
  const approveMutation = useMutation({
    mutationFn: async (matchId: number) => {
      await axios.post(`/api/matches/${matchId}/approve`)
    },
    onSuccess: () => {
      toast.success('承認しました')
      queryClient.invalidateQueries({ queryKey: ['pending-matches', tournamentId] })
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : '承認に失敗しました'
      toast.error(message)
    },
  })

  // 却下Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ matchId, reason }: { matchId: number; reason: string }) => {
      await axios.post(`/api/matches/${matchId}/reject`, { reason })
    },
    onSuccess: () => {
      toast.success('却下しました')
      setRejectingId(null)
      setRejectionReason('')
      queryClient.invalidateQueries({ queryKey: ['pending-matches', tournamentId] })
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : '却下に失敗しました'
      toast.error(message)
    },
  })

  const handleApprove = (id: number) => {
    if (!window.confirm('この試合結果を承認しますか？')) return
    approveMutation.mutate(id)
  }

  const handleReject = () => {
    if (!rejectingId || !rejectionReason.trim()) return
    rejectMutation.mutate({ matchId: rejectingId, reason: rejectionReason })
  }

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        承認待ちデータの取得に失敗しました
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">試合結果承認</h2>
          <p className="text-gray-600 mt-1">会場担当者から送信された試合結果を確認します</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          title="一覧を更新"
        >
          <svg
            className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isFetching ? '更新中...' : '更新'}
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-12 h-12 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">承認待ちの試合はありません</h3>
          <p className="text-gray-500 mt-1">現在すべての結果が処理されています</p>
        </div>
      ) : (
        <div className="space-y-6">
          {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2 flex justify-between items-center">
                <div className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  承認待ち
                </div>
                <div className="text-sm text-gray-500">
                  #{match.matchOrder} {match.matchTime} @ {match.venueName}
                </div>
              </div>

              <div className="p-6">
                {/* スコア表示 */}
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-right flex-1">
                    <div className="text-xl font-bold text-gray-900">{match.homeTeamName}</div>
                    <div className="text-sm text-gray-500">{match.homeTeamShortName}</div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-bold text-gray-900 bg-gray-100 px-6 py-2 rounded-lg">
                      {match.homeScoreTotal} - {match.awayScoreTotal}
                    </div>
                    {match.hasPenaltyShootout && (
                      <div className="mt-2 text-sm text-gray-600">
                        PK: {match.homePK} - {match.awayPK}
                      </div>
                    )}
                  </div>

                  <div className="text-left flex-1">
                    <div className="text-xl font-bold text-gray-900">{match.awayTeamName}</div>
                    <div className="text-sm text-gray-500">{match.awayTeamShortName}</div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setRejectingId(match.id)}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    却下
                  </button>
                  <button
                    onClick={() => handleApprove(match.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    承認
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 却下モーダル */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">却下理由を入力</h3>
            <p className="text-sm text-gray-600 mb-4">
              会場担当者に修正指示として送信されます。
            </p>
            <textarea
              className="w-full h-32 px-3 py-2 border rounded mb-4"
              placeholder="例: アウェイチームの得点者が間違っています。"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingId(null)
                  setRejectionReason('')
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {rejectMutation.isPending ? '処理中...' : '確定して却下'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
