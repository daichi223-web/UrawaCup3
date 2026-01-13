/**
 * 最終日組み合わせ表 - 印刷用ビュー
 * HTMLテンプレート（final_day_schedule.html）と同等のスタイルで表示
 * ブラウザの印刷機能でPDF化
 */
import { forwardRef } from 'react'

// 型定義
interface Team {
  id: number
  name: string
  short_name?: string
  group_id?: string
  rank?: number
}

interface Standing {
  team_id: number
  team: Team
  rank: number
  points: number
  goal_difference: number
  goals_for: number
  goals_against: number
  played: number
  won: number
  drawn: number
  lost: number
}

interface Match {
  id: number
  stage: string
  match_time?: string
  venue?: { name: string }
  home_team?: Team
  away_team?: Team
  home_team_id?: number
  away_team_id?: number
  home_score_total?: number
  away_score_total?: number
  home_seed?: string
  away_seed?: string
}

interface GroupStanding {
  groupId: string
  standings: Standing[]
}

interface OutstandingPlayerData {
  id: number
  awardType: 'mvp' | 'outstanding'
  playerName: string
  playerNumber?: number
  teamName?: string
  displayOrder: number
}

interface FinalScheduleData {
  tournamentName: string
  date: string
  standings: GroupStanding[]
  tournament: Match[]
  training: Match[]
  groupMatches?: Match[]
  outstandingPlayers?: OutstandingPlayerData[]
}

// 星取表で使う対戦結果の型
interface HeadToHeadResult {
  score: string // "2-1" など
  isWin: boolean
  isDraw: boolean
  isLoss: boolean
}

interface Props {
  data: FinalScheduleData
}

const FinalSchedulePrintView = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  // ステージ名を日本語に
  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      'semifinal': '準決勝',
      'third_place': '3位決定戦',
      'final': '決勝',
      'training': '研修試合',
    }
    return names[stage] || stage
  }

  // 星取表用: 対戦結果を取得
  const getHeadToHeadResult = (
    teamId: number,
    opponentId: number,
    groupId: string
  ): HeadToHeadResult | null => {
    if (!data.groupMatches) return null

    // 該当グループの試合から探す
    const match = data.groupMatches.find((m) => {
      const isHomeVsAway = m.home_team_id === teamId && m.away_team_id === opponentId
      const isAwayVsHome = m.away_team_id === teamId && m.home_team_id === opponentId
      return (isHomeVsAway || isAwayVsHome) &&
             (m.home_team?.group_id === groupId || m.away_team?.group_id === groupId)
    })

    if (!match) return null

    const isHome = match.home_team_id === teamId
    const homeScore = match.home_score_total ?? 0
    const awayScore = match.away_score_total ?? 0

    if (isHome) {
      return {
        score: `${homeScore}-${awayScore}`,
        isWin: homeScore > awayScore,
        isDraw: homeScore === awayScore,
        isLoss: homeScore < awayScore,
      }
    } else {
      return {
        score: `${awayScore}-${homeScore}`,
        isWin: awayScore > homeScore,
        isDraw: homeScore === awayScore,
        isLoss: awayScore < homeScore,
      }
    }
  }

  // 会場ごとにグループ化
  const trainingByVenue = data.training.reduce((acc, match) => {
    const venue = match.venue?.name || '未定'
    if (!acc[venue]) acc[venue] = []
    acc[venue].push(match)
    return acc
  }, {} as Record<string, Match[]>)

  return (
    <div ref={ref} className="print-view bg-white p-8 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🏆 {data.tournamentName}
        </h1>
        <p className="text-gray-600">最終日組み合わせ表</p>
        <p className="text-sm text-gray-500 mt-1">{data.date}</p>
      </div>

      {/* 予選順位表（星取表形式） */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          📊 予選リーグ星取表
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.standings.map((group) => (
            <div key={group.groupId}>
              <h4 className="text-sm font-bold text-blue-600 mb-2">
                グループ {group.groupId}
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-1 py-1 border border-blue-500">#</th>
                    <th className="px-1 py-1 border border-blue-500 text-left">チーム</th>
                    {/* 対戦相手ヘッダー（順位番号） */}
                    {group.standings.map((_, idx) => (
                      <th key={idx} className="px-1 py-1 border border-blue-500 w-10">
                        {idx + 1}
                      </th>
                    ))}
                    <th className="px-1 py-1 border border-blue-500">勝</th>
                    <th className="px-1 py-1 border border-blue-500">分</th>
                    <th className="px-1 py-1 border border-blue-500">負</th>
                    <th className="px-1 py-1 border border-blue-500">得</th>
                    <th className="px-1 py-1 border border-blue-500">失</th>
                    <th className="px-1 py-1 border border-blue-500">差</th>
                    <th className="px-1 py-1 border border-blue-500">点</th>
                  </tr>
                </thead>
                <tbody>
                  {group.standings.map((s, rowIdx) => (
                    <tr
                      key={s.team_id}
                      className={rowIdx === 0 ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-1 py-1 text-center border font-bold">{s.rank}</td>
                      <td className="px-1 py-1 border truncate max-w-[80px]">
                        {s.team?.short_name || s.team?.name || '---'}
                      </td>
                      {/* 対戦結果セル */}
                      {group.standings.map((opponent, colIdx) => {
                        if (s.team_id === opponent.team_id) {
                          // 自分自身との対戦は斜線
                          return (
                            <td key={colIdx} className="px-1 py-1 text-center border bg-gray-200">
                              -
                            </td>
                          )
                        }
                        const result = getHeadToHeadResult(s.team_id, opponent.team_id, group.groupId)
                        if (!result) {
                          return (
                            <td key={colIdx} className="px-1 py-1 text-center border text-gray-400">
                              -
                            </td>
                          )
                        }
                        return (
                          <td
                            key={colIdx}
                            className={`px-1 py-1 text-center border font-medium ${
                              result.isWin ? 'bg-blue-100 text-blue-800' :
                              result.isLoss ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {result.score}
                          </td>
                        )
                      })}
                      <td className="px-1 py-1 text-center border">{s.won ?? 0}</td>
                      <td className="px-1 py-1 text-center border">{s.drawn ?? 0}</td>
                      <td className="px-1 py-1 text-center border">{s.lost ?? 0}</td>
                      <td className="px-1 py-1 text-center border">{s.goals_for ?? 0}</td>
                      <td className="px-1 py-1 text-center border">{s.goals_against ?? 0}</td>
                      <td className="px-1 py-1 text-center border">
                        {(s.goal_difference ?? 0) > 0 ? '+' : ''}{s.goal_difference ?? 0}
                      </td>
                      <td className="px-1 py-1 text-center border font-bold">{s.points ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* 決勝トーナメント + 研修試合 - 1ページに収める */}
      <section className="mb-4 page-break-before">
        <h2 className="text-base font-bold text-gray-800 mb-2 pb-1 border-b-2 border-gray-300">
          🏆 決勝トーナメント
        </h2>
        {(() => {
          // 会場ごとにグループ化
          const tournamentByVenue = data.tournament.reduce((acc, match) => {
            const venue = match.venue?.name || '駒場スタジアム'
            if (!acc[venue]) acc[venue] = []
            acc[venue].push(match)
            return acc
          }, {} as Record<string, Match[]>)

          return (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(tournamentByVenue).map(([venue, matches]) => (
                <div key={venue}>
                  <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded mb-1">
                    📍 {venue}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-700 text-white">
                        <th className="px-1 py-0.5 w-10">時間</th>
                        <th className="px-1 py-0.5 w-14">種別</th>
                        <th className="px-1 py-0.5 text-right">ホーム</th>
                        <th className="px-1 py-0.5 w-6">vs</th>
                        <th className="px-1 py-0.5 text-left">アウェイ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => {
                        const isFinal = match.stage === 'final'
                        const isThird = match.stage === 'third_place'
                        const homeName = match.home_team?.short_name || match.home_team?.name || match.home_seed || '未定'
                        const awayName = match.away_team?.short_name || match.away_team?.name || match.away_seed || '未定'

                        return (
                          <tr
                            key={match.id}
                            className={`border-b ${
                              isFinal ? 'bg-yellow-50' : isThird ? 'bg-purple-50' : ''
                            }`}
                          >
                            <td className="px-1 py-0.5 text-gray-500">
                              {match.match_time?.slice(0, 5)}
                            </td>
                            <td className={`px-1 py-0.5 font-bold ${
                              isFinal ? 'text-yellow-700' : isThird ? 'text-purple-700' : 'text-blue-700'
                            }`}>
                              {getStageName(match.stage)}
                            </td>
                            <td className="px-1 py-0.5 text-right font-medium truncate max-w-[50px]">
                              {homeName}
                            </td>
                            <td className="px-1 py-0.5 text-center text-gray-400">vs</td>
                            <td className="px-1 py-0.5 text-left font-medium truncate max-w-[50px]">
                              {awayName}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        })()}
      </section>

      {/* 研修試合 - 決勝トーナメントと同じページに */}
      <section className="mb-4">
        <h2 className="text-base font-bold text-gray-800 mb-2 pb-1 border-b-2 border-gray-300">
          ⚽ 研修試合（順位リーグ）
        </h2>
        {Object.keys(trainingByVenue).length === 0 ? (
          <div className="text-gray-500 text-xs py-2 text-center">
            研修試合のデータがありません
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(trainingByVenue).map(([venue, matches]) => (
              <div key={venue} className="text-xs">
                <div className="font-bold text-white bg-green-600 px-2 py-0.5 rounded-t">
                  📍 {venue}（{matches.length}試合）
                </div>
                <table className="w-full border border-green-200">
                  <tbody>
                    {matches.map((match) => {
                      const homeTeam = match.home_team
                      const awayTeam = match.away_team
                      return (
                        <tr key={match.id} className="border-b border-gray-200">
                          <td className="px-1 py-0.5 text-gray-500 w-10">
                            {match.match_time?.slice(0, 5)}
                          </td>
                          <td className="px-1 py-0.5 text-right font-medium truncate max-w-[55px]">
                            {homeTeam?.short_name || homeTeam?.name || '未定'}
                          </td>
                          <td className="px-1 py-0.5 text-center text-gray-400 w-6">vs</td>
                          <td className="px-1 py-0.5 text-left font-medium truncate max-w-[55px]">
                            {awayTeam?.short_name || awayTeam?.name || '未定'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* フッター */}
      <div className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
        浦和カップ運営委員会
      </div>

            {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .print-view {
            max-width: none !important;
            padding: 10mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-view * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          /* ページ区切り */
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          .grid-cols-1 {
            grid-template-columns: 1fr !important;
          }
          .grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .md\\:grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .md\\:grid-cols-3 {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          /* 背景色を確実に印刷 */
          .bg-yellow-50, .bg-purple-50, .bg-blue-50, .bg-green-600,
          .bg-yellow-100, .bg-gray-100, .bg-gray-50, .bg-gray-200,
          .bg-blue-100, .bg-red-100, .bg-white {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* テーブルヘッダー背景 */
          thead, th, .bg-gray-700, .bg-blue-600, .bg-gray-600 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* 星取表のセル */
          table {
            border-collapse: collapse !important;
          }
          td, th {
            border: 1px solid #ddd !important;
          }
        }
      `}</style>
    </div>
  )
})

FinalSchedulePrintView.displayName = 'FinalSchedulePrintView'

export default FinalSchedulePrintView
