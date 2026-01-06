/**
 * 最終日組み合わせ画面
 * 決勝トーナメント・研修試合の日程管理
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId, useTournament } from '../hooks/useTournament'

interface FinalMatch {
  id: number
  matchType: string
  matchTime: string
  matchOrder: number
  venueId: number
  venueName: string
  homeTeamId: number | null
  awayTeamId: number | null
  homeTeamName: string
  awayTeamName: string
  homeSeed: string
  awaySeed: string
  homeScoreTotal: number | null
  awayScoreTotal: number | null
  status: string
  warning?: string
}

interface VenueSchedule {
  id: number
  name: string
  matches: FinalMatch[]
}

export function FinalDaySchedule() {
  const tournamentId = useTournamentId()
  const tournament = useTournament()
  const queryClient = useQueryClient()

  const [selectedSlot, setSelectedSlot] = useState<{ matchId: number; side: 'home' | 'away' } | null>(null)

  // 最終日の日付（大会終了日）
  const finalDayDate = tournament?.endDate || new Date().toISOString().split('T')[0]

  // 最終日の試合を取得
  const { data: matches = [], isLoading, refetch } = useQuery<FinalMatch[]>({
    queryKey: ['final-day-matches', tournamentId, finalDayDate],
    queryFn: async () => {
      const res = await axios.get('/api/matches', {
        params: {
          tournament_id: tournamentId,
          match_date: finalDayDate,
        }
      })
      return res.data.matches || res.data
    },
    enabled: !!tournamentId,
  })

  // 自動生成Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`/api/matches/generate-final-day/${tournamentId}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('組み合わせを生成しました')
      queryClient.invalidateQueries({ queryKey: ['final-day-matches', tournamentId] })
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : '生成に失敗しました'
      toast.error(message)
    },
  })

  // 準決勝結果反映Mutation
  const updateBracketMutation = useMutation({
    mutationFn: async () => {
      await axios.put(`/api/matches/update-finals-bracket/${tournamentId}`)
    },
    onSuccess: () => {
      toast.success('準決勝結果を反映しました')
      refetch()
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : '反映に失敗しました'
      toast.error(message)
    },
  })

  // 試合を会場別・種別別に分類
  const { trainingVenues, knockoutMatches } = useMemo(() => {
    const trainingMap = new Map<number, VenueSchedule>()
    const knockout: FinalMatch[] = []

    matches.forEach((match) => {
      if (match.matchType === 'training') {
        const venueId = match.venueId
        if (!trainingMap.has(venueId)) {
          trainingMap.set(venueId, {
            id: venueId,
            name: match.venueName,
            matches: [],
          })
        }
        trainingMap.get(venueId)!.matches.push(match)
      } else {
        knockout.push(match)
      }
    })

    // 各会場の試合を時間順にソート
    trainingMap.forEach((venue) => {
      venue.matches.sort((a, b) => a.matchOrder - b.matchOrder)
    })

    return {
      trainingVenues: Array.from(trainingMap.values()),
      knockoutMatches: knockout.sort((a, b) => {
        const order = { semifinal: 1, third_place: 2, final: 3 }
        return (order[a.matchType as keyof typeof order] || 0) - (order[b.matchType as keyof typeof order] || 0)
      }),
    }
  }, [matches])

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${date.getMonth() + 1}月${date.getDate()}日（${days[date.getDay()]}）`
  }

  const handleGenerate = () => {
    if (!confirm('最終日の組み合わせを自動生成しますか？\n既存の試合は上書きされます。')) return
    generateMutation.mutate()
  }

  const matchTypeLabels: Record<string, string> = {
    semifinal: '準決勝',
    third_place: '3位決定戦',
    final: '決勝',
    training: '研修試合',
  }

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            最終日 組み合わせ
          </h2>
          <p className="text-gray-600 mt-1">
            {formatDate(finalDayDate)}【順位リーグ・決勝トーナメント】
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          >
            {generateMutation.isPending && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            自動生成
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            更新
          </button>
        </div>
      </div>

      {/* ヒント */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        チームをクリックして選択後、別のチームをクリックで入れ替えできます。
      </div>

      {/* 研修試合（順位リーグ） */}
      <section>
        <h3 className="text-lg font-semibold mb-3 pb-2 border-b">【順位リーグ】</h3>
        {trainingVenues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trainingVenues.map((venue) => (
              <div key={venue.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 font-semibold">{venue.name}</div>
                <div className="p-2 space-y-2">
                  {venue.matches.map((match) => (
                    <div
                      key={match.id}
                      className={`p-2 border rounded ${match.warning ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        #{match.matchOrder} {match.matchTime}
                        {match.warning && <span className="ml-2 text-yellow-600">{match.warning}</span>}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={`font-medium cursor-pointer hover:bg-gray-100 px-1 rounded ${
                            selectedSlot?.matchId === match.id && selectedSlot?.side === 'home' ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => {
                            if (selectedSlot?.matchId === match.id && selectedSlot?.side === 'home') {
                              setSelectedSlot(null)
                            } else {
                              setSelectedSlot({ matchId: match.id, side: 'home' })
                            }
                          }}
                        >
                          {match.homeTeamName || match.homeSeed}
                        </span>
                        <span className="mx-1 text-gray-400">vs</span>
                        <span
                          className={`font-medium cursor-pointer hover:bg-gray-100 px-1 rounded ${
                            selectedSlot?.matchId === match.id && selectedSlot?.side === 'away' ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => {
                            if (selectedSlot?.matchId === match.id && selectedSlot?.side === 'away') {
                              setSelectedSlot(null)
                            } else {
                              setSelectedSlot({ matchId: match.id, side: 'away' })
                            }
                          }}
                        >
                          {match.awayTeamName || match.awaySeed}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
            研修試合がありません。「自動生成」ボタンで生成してください。
          </div>
        )}
      </section>

      {/* 決勝トーナメント */}
      <section>
        <h3 className="text-lg font-semibold mb-3 pb-2 border-b flex items-center justify-between">
          【3決・決勝戦】
          <button
            onClick={() => updateBracketMutation.mutate()}
            disabled={updateBracketMutation.isPending}
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {updateBracketMutation.isPending ? '更新中...' : '準決勝結果を反映'}
          </button>
        </h3>
        {knockoutMatches.length > 0 ? (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="space-y-4">
              {knockoutMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-600">
                      {matchTypeLabels[match.matchType] || match.matchType}
                    </span>
                    <span className="text-sm text-gray-500">{match.matchTime}</span>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center flex-1">
                      <div
                        className={`font-bold text-lg cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${
                          selectedSlot?.matchId === match.id && selectedSlot?.side === 'home' ? 'bg-blue-100' : ''
                        }`}
                        onClick={() => {
                          if (selectedSlot?.matchId === match.id && selectedSlot?.side === 'home') {
                            setSelectedSlot(null)
                          } else {
                            setSelectedSlot({ matchId: match.id, side: 'home' })
                          }
                        }}
                      >
                        {match.homeTeamName || match.homeSeed || 'TBD'}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 bg-gray-100 px-4 py-2 rounded">
                      {match.homeScoreTotal ?? '-'} - {match.awayScoreTotal ?? '-'}
                    </div>
                    <div className="text-center flex-1">
                      <div
                        className={`font-bold text-lg cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${
                          selectedSlot?.matchId === match.id && selectedSlot?.side === 'away' ? 'bg-blue-100' : ''
                        }`}
                        onClick={() => {
                          if (selectedSlot?.matchId === match.id && selectedSlot?.side === 'away') {
                            setSelectedSlot(null)
                          } else {
                            setSelectedSlot({ matchId: match.id, side: 'away' })
                          }
                        }}
                      >
                        {match.awayTeamName || match.awaySeed || 'TBD'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
            決勝トーナメントがありません。「自動生成」ボタンで生成してください。
          </div>
        )}
      </section>
    </div>
  )
}
