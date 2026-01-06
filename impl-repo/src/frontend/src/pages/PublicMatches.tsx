/**
 * 公開試合一覧画面（認証不要）
 * F-91: 一般公開用試合結果
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

interface Team {
  id: number
  name: string
  short_name: string | null
}

interface Match {
  id: number
  match_date: string | null
  match_time: string | null
  group_id: string | null
  stage: string | null
  status: string | null
  venue: string | null
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  home_score_half1: number | null
  away_score_half1: number | null
  home_score_half2: number | null
  away_score_half2: number | null
  has_penalty_shootout: boolean
  home_pk: number | null
  away_pk: number | null
}

interface MatchesData {
  tournament_id: number
  matches: Match[]
  count: number
}

interface Tournament {
  id: number
  name: string
  year: number
  edition: number
  start_date: string | null
  end_date: string | null
}

export function PublicMatches() {
  const [tournamentId, setTournamentId] = useState<number | null>(null)
  const [dateFilter, setDateFilter] = useState<string>('')
  const [groupFilter, setGroupFilter] = useState<string>('')

  // 大会一覧を取得
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ['public-tournaments'],
    queryFn: async () => {
      const res = await axios.get('/api/public/tournaments')
      return res.data
    },
  })

  // 最新の大会を自動選択
  useEffect(() => {
    if (tournaments.length > 0 && !tournamentId) {
      setTournamentId(tournaments[0].id)
    }
  }, [tournaments, tournamentId])

  // 試合一覧を取得
  const { data: matchesData, isLoading } = useQuery<MatchesData>({
    queryKey: ['public-matches', tournamentId, dateFilter, groupFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (dateFilter) params.match_date = dateFilter
      if (groupFilter) params.group_id = groupFilter

      const res = await axios.get(`/api/public/tournaments/${tournamentId}/matches`, { params })
      return res.data
    },
    enabled: !!tournamentId,
    refetchInterval: 30000,
  })

  const currentTournament = tournaments.find(t => t.id === tournamentId)

  // 日付リストを抽出
  const availableDates = matchesData
    ? [...new Set(matchesData.matches.map(m => m.match_date).filter(Boolean))]
    : []

  const getStageLabel = (stage: string | null) => {
    const labels: Record<string, string> = {
      preliminary: '予選リーグ',
      semifinal: '準決勝',
      third_place: '3位決定戦',
      final: '決勝',
      training: '研修試合',
    }
    return stage ? labels[stage] || stage : ''
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">終了</span>
      case 'in_progress':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full animate-pulse">試合中</span>
      case 'scheduled':
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">予定</span>
      default:
        return null
    }
  }

  const renderMatch = (match: Match) => (
    <div
      key={match.id}
      className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
    >
      {/* ヘッダー */}
      <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
        <div>
          {match.match_time && <span className="font-medium">{match.match_time}</span>}
          {match.venue && <span className="ml-2">@ {match.venue}</span>}
        </div>
        <div className="flex items-center gap-2">
          {match.group_id && (
            <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
              グループ{match.group_id}
            </span>
          )}
          {getStatusBadge(match.status)}
        </div>
      </div>

      {/* スコア */}
      <div className="flex items-center justify-between">
        {/* ホームチーム */}
        <div className="flex-1 text-right">
          <p className="font-bold text-lg">
            {match.home_team?.short_name || match.home_team?.name || 'TBD'}
          </p>
        </div>

        {/* スコア */}
        <div className="mx-4 px-4 py-2 bg-gray-100 rounded-lg text-center min-w-[100px]">
          {match.status === 'completed' ? (
            <>
              <p className="text-2xl font-bold">
                {match.home_score ?? '-'} - {match.away_score ?? '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ({match.home_score_half1 ?? 0}-{match.away_score_half1 ?? 0} / {match.home_score_half2 ?? 0}-{match.away_score_half2 ?? 0})
              </p>
              {match.has_penalty_shootout && (
                <p className="text-xs text-red-600 mt-1">
                  PK {match.home_pk}-{match.away_pk}
                </p>
              )}
            </>
          ) : match.status === 'in_progress' ? (
            <p className="text-2xl font-bold text-red-600">
              {match.home_score ?? 0} - {match.away_score ?? 0}
            </p>
          ) : (
            <p className="text-xl text-gray-400">vs</p>
          )}
        </div>

        {/* アウェイチーム */}
        <div className="flex-1 text-left">
          <p className="font-bold text-lg">
            {match.away_team?.short_name || match.away_team?.name || 'TBD'}
          </p>
        </div>
      </div>

      {/* ステージ */}
      {match.stage && match.stage !== 'preliminary' && (
        <p className="text-center text-sm text-gray-500 mt-2">
          {getStageLabel(match.stage)}
        </p>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-red-600 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold">⚽ 浦和カップ 試合結果</h1>
          {currentTournament && (
            <p className="text-sm opacity-90 mt-1">
              第{currentTournament.edition}回 {currentTournament.name}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* フィルター */}
        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-white rounded-lg border shadow-sm"
          >
            <option value="">全日程</option>
            {availableDates.map((date, idx) => (
              <option key={date} value={date!}>
                Day{idx + 1} ({date})
              </option>
            ))}
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-4 py-2 bg-white rounded-lg border shadow-sm"
          >
            <option value="">全グループ</option>
            <option value="A">グループA</option>
            <option value="B">グループB</option>
            <option value="C">グループC</option>
            <option value="D">グループD</option>
          </select>
        </div>

        {/* 試合一覧 */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mb-4"></div>
            <p>読み込み中...</p>
          </div>
        ) : matchesData && matchesData.matches.length > 0 ? (
          <div className="space-y-4">
            {matchesData.matches.map(renderMatch)}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            試合データがありません
          </div>
        )}

        {/* 件数表示 */}
        {matchesData && (
          <p className="text-sm text-gray-500 text-center mt-6">
            {matchesData.count}件の試合
          </p>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-gray-800 text-white py-4 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <p>さいたま市招待高校サッカーフェスティバル</p>
          <p className="opacity-70 mt-1">浦和カップ運営事務局</p>
        </div>
      </footer>
    </div>
  )
}
