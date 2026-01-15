/**
 * 星取表コンポーネント
 * 予選リーグの対戦結果をマトリックス形式で表示
 * ○：勝ち　△：引き分け　●：負け
 */
import { useMemo } from 'react'
import type { MatchWithDetails, Team } from '@/types'

interface StarTableProps {
  teams: Team[]
  matches: MatchWithDetails[]
  groupId: string
  byePairs?: [number, number][]  // 対戦しないペア
  overallRankings?: Map<number, number>  // チームID → 総合順位
  showOverallRank?: boolean  // 総合順位を表示するか
}

interface TeamStats {
  teamId: number
  team: Team
  won: number
  drawn: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  rank: number
  headToHead: Map<number, { result: 'win' | 'draw' | 'loss' | null; score: string; opponentScore: string }>
}

export default function StarTable({ teams, matches, groupId, byePairs = [], overallRankings, showOverallRank = false }: StarTableProps) {
  // 予選試合をフィルタ（完了・予定含む）
  // groupId が 'all' の場合はグループフィルタをスキップ（1リーグ制用）
  const allPreliminaryMatches = useMemo(() => {
    return matches.filter(m =>
      m.stage === 'preliminary' &&
      (groupId === 'all' || m.groupId === groupId || m.group_id === groupId)
    )
  }, [matches, groupId])

  // 完了した試合のみ
  const completedMatches = useMemo(() => {
    return allPreliminaryMatches.filter(m => m.status === 'completed')
  }, [allPreliminaryMatches])

  // 対戦予定があるペアのセット
  const scheduledPairSet = useMemo(() => {
    const set = new Set<string>()
    allPreliminaryMatches.forEach(m => {
      const homeId = m.homeTeamId ?? m.home_team_id
      const awayId = m.awayTeamId ?? m.away_team_id
      if (homeId && awayId) {
        set.add(`${homeId}-${awayId}`)
        set.add(`${awayId}-${homeId}`)
      }
    })
    return set
  }, [allPreliminaryMatches])

  // 対戦しないペアのセット (明示的に指定されたもの + 対戦予定がないもの)
  const byePairSet = useMemo(() => {
    const set = new Set<string>()
    byePairs.forEach(([a, b]) => {
      set.add(`${a}-${b}`)
      set.add(`${b}-${a}`)
    })
    return set
  }, [byePairs])

  // 対戦しないかどうかを判定（明示的byePairs または 対戦予定なし）
  const hasNoScheduledMatch = (team1Id: number, team2Id: number) => {
    if (byePairSet.has(`${team1Id}-${team2Id}`)) return true
    // 1リーグ制で対戦予定がない場合
    if (groupId === 'all' && !scheduledPairSet.has(`${team1Id}-${team2Id}`)) return true
    return false
  }

  // 各チームの成績を計算
  const teamStats = useMemo(() => {
    const statsMap = new Map<number, TeamStats>()

    // 初期化
    teams.forEach(team => {
      statsMap.set(team.id, {
        teamId: team.id,
        team,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        rank: 0,
        headToHead: new Map()
      })
    })

    // 試合結果を集計
    completedMatches.forEach(match => {
      const homeId = match.homeTeamId ?? match.home_team_id
      const awayId = match.awayTeamId ?? match.away_team_id
      const homeScore = match.homeScoreTotal ?? match.home_score_total ?? 0
      const awayScore = match.awayScoreTotal ?? match.away_score_total ?? 0

      if (!homeId || !awayId) return

      const homeStats = statsMap.get(homeId)
      const awayStats = statsMap.get(awayId)

      if (!homeStats || !awayStats) return

      // 得失点
      homeStats.goalsFor += homeScore
      homeStats.goalsAgainst += awayScore
      awayStats.goalsFor += awayScore
      awayStats.goalsAgainst += homeScore

      // 勝敗
      if (homeScore > awayScore) {
        homeStats.won++
        homeStats.points += 3
        awayStats.lost++
        homeStats.headToHead.set(awayId, {
          result: 'win',
          score: String(homeScore),
          opponentScore: String(awayScore)
        })
        awayStats.headToHead.set(homeId, {
          result: 'loss',
          score: String(awayScore),
          opponentScore: String(homeScore)
        })
      } else if (homeScore < awayScore) {
        awayStats.won++
        awayStats.points += 3
        homeStats.lost++
        homeStats.headToHead.set(awayId, {
          result: 'loss',
          score: String(homeScore),
          opponentScore: String(awayScore)
        })
        awayStats.headToHead.set(homeId, {
          result: 'win',
          score: String(awayScore),
          opponentScore: String(homeScore)
        })
      } else {
        homeStats.drawn++
        awayStats.drawn++
        homeStats.points++
        awayStats.points++
        homeStats.headToHead.set(awayId, {
          result: 'draw',
          score: String(homeScore),
          opponentScore: String(awayScore)
        })
        awayStats.headToHead.set(homeId, {
          result: 'draw',
          score: String(awayScore),
          opponentScore: String(homeScore)
        })
      }
    })

    // 得失点差を計算
    statsMap.forEach(stats => {
      stats.goalDiff = stats.goalsFor - stats.goalsAgainst
    })

    // 順位をソート（勝点 → 得失点差 → 得点）
    const sorted = Array.from(statsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })

    // 順位を割り当て
    sorted.forEach((stats, index) => {
      stats.rank = index + 1
    })

    return sorted
  }, [teams, completedMatches])

  // チーム名の短縮表示
  const getShortName = (team: Team) => {
    return team.shortName || team.short_name || team.name.slice(0, 4)
  }

  // チーム名をU18などで改行して表示（縦ヘッダー用）
  const formatTeamNameForHeader = (team: Team) => {
    const name = getShortName(team)
    // U18, U15などのパターンを改行
    const match = name.match(/^(.+?)(U\d+)$/)
    if (match) {
      return (
        <span className="flex flex-col items-center leading-none">
          <span className="text-xs">{match[1]}</span>
          <span style={{ fontSize: '0.6rem' }}>{match[2]}</span>
        </span>
      )
    }
    return <span className="text-xs">{name}</span>
  }

  // 結果記号を取得
  const getResultSymbol = (result: 'win' | 'draw' | 'loss' | null) => {
    switch (result) {
      case 'win': return { symbol: '○', className: 'text-red-600 font-bold' }
      case 'draw': return { symbol: '△', className: 'text-gray-600' }
      case 'loss': return { symbol: '●', className: 'text-blue-600' }
      default: return { symbol: '', className: '' }
    }
  }


  if (teams.length === 0) {
    return <div className="text-center py-4 text-gray-500">チームデータがありません</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse table-fixed">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-green-100 w-8">順</th>
            <th className="border border-gray-300 px-2 py-1 text-left font-medium w-24">チーム</th>
            {teamStats.map(stats => (
              <th
                key={`header-${stats.teamId}`}
                className="border border-gray-300 px-0.5 py-1 text-center font-medium"
                style={{ width: '2.5rem', minWidth: '2.5rem', maxWidth: '2.5rem' }}
                title={stats.team.name}
              >
                {formatTeamNameForHeader(stats.team)}
              </th>
            ))}
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">勝</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">分</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">負</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-yellow-100 w-10">勝点</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">得点</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">失点</th>
            <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-200 w-8">差</th>
            {showOverallRank && (
              <th className="border border-gray-300 px-1 py-1 text-center font-medium bg-amber-100 w-8" title="総合順位">総合</th>
            )}
          </tr>
        </thead>
        <tbody>
          {teamStats.map((rowStats, rowIndex) => (
            <tr
              key={`row-${rowStats.teamId}`}
              className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              {/* 順位（左端） */}
              <td className={`border border-gray-300 px-1 py-1 text-center font-bold ${
                rowStats.rank === 1 ? 'text-yellow-600 bg-yellow-50' :
                rowStats.rank === 2 ? 'text-gray-500 bg-green-50' :
                'bg-green-50'
              }`}>
                {rowStats.rank}
              </td>
              {/* チーム名 */}
              <td
                className="border border-gray-300 px-2 py-1 font-medium whitespace-nowrap"
                title={rowStats.team.name}
              >
                {getShortName(rowStats.team)}
              </td>

              {/* 対戦結果マトリックス */}
              {teamStats.map(colStats => {
                // セルの共通スタイル
                const cellStyle = { width: '2.5rem', minWidth: '2.5rem', maxWidth: '2.5rem' }

                // 自分自身のセル
                if (rowStats.teamId === colStats.teamId) {
                  return (
                    <td
                      key={`cell-${rowStats.teamId}-${colStats.teamId}`}
                      className="border border-gray-300 px-0.5 py-1 text-center bg-gray-200"
                      style={cellStyle}
                    >
                      -
                    </td>
                  )
                }

                // 対戦しないペア（明示的byePairs または 対戦予定なし）
                if (hasNoScheduledMatch(rowStats.teamId, colStats.teamId)) {
                  return (
                    <td
                      key={`cell-${rowStats.teamId}-${colStats.teamId}`}
                      className="border border-gray-300 px-0.5 py-1 text-center bg-gray-100"
                      style={cellStyle}
                      title="対戦なし"
                    >
                      <span className="text-gray-400">-</span>
                    </td>
                  )
                }

                // 対戦結果
                const h2h = rowStats.headToHead.get(colStats.teamId)
                const { symbol, className } = getResultSymbol(h2h?.result ?? null)

                return (
                  <td
                    key={`cell-${rowStats.teamId}-${colStats.teamId}`}
                    className="border border-gray-300 px-0.5 py-1 text-center"
                    style={cellStyle}
                    title={h2h ? `${h2h.score}-${h2h.opponentScore}` : '未対戦'}
                  >
                    {h2h ? (
                      <div className="flex flex-col items-center leading-tight">
                        <span className={className}>{symbol}</span>
                        <span className="text-xs text-gray-500">{h2h.score}-{h2h.opponentScore}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )
              })}

              {/* 統計列 */}
              <td className="border border-gray-300 px-1 py-1 text-center">{rowStats.won}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{rowStats.drawn}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{rowStats.lost}</td>
              <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-yellow-50">{rowStats.points}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{rowStats.goalsFor}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">{rowStats.goalsAgainst}</td>
              <td className="border border-gray-300 px-1 py-1 text-center">
                {rowStats.goalDiff > 0 ? `+${rowStats.goalDiff}` : rowStats.goalDiff}
              </td>
              {showOverallRank && (
                <td className={`border border-gray-300 px-1 py-1 text-center font-bold ${
                  overallRankings?.get(rowStats.teamId) && overallRankings.get(rowStats.teamId)! <= 4
                    ? 'text-amber-600 bg-amber-50'
                    : 'bg-amber-50'
                }`}>
                  {overallRankings?.get(rowStats.teamId) ?? '-'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 凡例 */}
      <div className="mt-2 flex gap-4 text-xs text-gray-600">
        <span><span className="text-red-600 font-bold">○</span> 勝ち</span>
        <span><span className="text-gray-600">△</span> 引き分け</span>
        <span><span className="text-blue-600">●</span> 負け</span>
      </div>
    </div>
  )
}
