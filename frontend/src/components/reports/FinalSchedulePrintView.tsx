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
}

interface Match {
  id: number
  stage: string
  match_time?: string
  venue?: { name: string }
  home_team?: Team
  away_team?: Team
  home_seed?: string
  away_seed?: string
}

interface GroupStanding {
  groupId: string
  standings: Standing[]
}

interface FinalScheduleData {
  tournamentName: string
  date: string
  standings: GroupStanding[]
  tournament: Match[]
  training: Match[]
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

      {/* 予選順位表 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          📊 予選リーグ順位表
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.standings.map((group) => (
            <div key={group.groupId}>
              <h4 className="text-sm font-bold text-blue-600 mb-2">
                グループ {group.groupId}
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-1 py-1">#</th>
                    <th className="px-1 py-1 text-left">チーム</th>
                    <th className="px-1 py-1">点</th>
                    <th className="px-1 py-1">差</th>
                  </tr>
                </thead>
                <tbody>
                  {group.standings.map((s, idx) => (
                    <tr
                      key={s.team_id}
                      className={idx === 0 ? 'bg-yellow-100' : 'border-b'}
                    >
                      <td className="px-1 py-1 text-center">{s.rank}</td>
                      <td className="px-1 py-1 truncate max-w-[80px]">
                        {s.team?.short_name || s.team?.name || '---'}
                      </td>
                      <td className="px-1 py-1 text-center font-bold">{s.points}</td>
                      <td className="px-1 py-1 text-center">
                        {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* 決勝トーナメント */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          🏆 決勝トーナメント @ 駒場スタジアム
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="px-3 py-2 w-16">時間</th>
              <th className="px-3 py-2 w-24">種別</th>
              <th className="px-3 py-2 text-right">ホーム</th>
              <th className="px-3 py-2 w-10">vs</th>
              <th className="px-3 py-2 text-left">アウェイ</th>
              <th className="px-3 py-2 w-16">審判</th>
            </tr>
          </thead>
          <tbody>
            {data.tournament.map((match) => {
              const isFinal = match.stage === 'final'
              const isThird = match.stage === 'third_place'
              const homeName = match.home_team?.short_name || match.home_team?.name || match.home_seed || '未定'
              const awayName = match.away_team?.short_name || match.away_team?.name || match.away_seed || '未定'
              const homeSeed = match.home_team
                ? `${match.home_team.group_id || ''}1位`
                : ''
              const awaySeed = match.away_team
                ? `${match.away_team.group_id || ''}1位`
                : ''

              return (
                <tr
                  key={match.id}
                  className={`border-b ${
                    isFinal ? 'bg-yellow-50' : isThird ? 'bg-purple-50' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-gray-500">
                    {match.match_time?.slice(0, 5)}
                  </td>
                  <td className={`px-3 py-2 font-bold ${
                    isFinal ? 'text-yellow-700' : isThird ? 'text-purple-700' : 'text-blue-700'
                  }`}>
                    {getStageName(match.stage)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold">{homeName}</div>
                    {homeSeed && <div className="text-xs text-gray-500">{homeSeed}</div>}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-400">vs</td>
                  <td className="px-3 py-2 text-left">
                    <div className="font-bold">{awayName}</div>
                    {awaySeed && <div className="text-xs text-gray-500">{awaySeed}</div>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">
                    派遣
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* 研修試合 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          ⚽ 研修試合
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(trainingByVenue).map(([venue, matches]) => (
            <div key={venue}>
              <div className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded mb-2">
                📍 {venue}（{matches.length}試合）
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-600 text-white">
                    <th className="px-2 py-1 w-12">時間</th>
                    <th className="px-2 py-1 text-right">ホーム</th>
                    <th className="px-2 py-1 w-8">vs</th>
                    <th className="px-2 py-1 text-left">アウェイ</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const homeTeam = match.home_team
                    const awayTeam = match.away_team
                    const homeSeed = homeTeam
                      ? `${homeTeam.group_id || ''}${homeTeam.rank || ''}位`
                      : ''
                    const awaySeed = awayTeam
                      ? `${awayTeam.group_id || ''}${awayTeam.rank || ''}位`
                      : ''

                    return (
                      <tr key={match.id} className="border-b">
                        <td className="px-2 py-1 text-gray-500">
                          {match.match_time?.slice(0, 5)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <div className="font-medium">
                            {homeTeam?.short_name || homeTeam?.name || '未定'}
                          </div>
                          <div className="text-gray-400 text-[10px]">{homeSeed}</div>
                        </td>
                        <td className="px-2 py-1 text-center text-gray-400">vs</td>
                        <td className="px-2 py-1 text-left">
                          <div className="font-medium">
                            {awayTeam?.short_name || awayTeam?.name || '未定'}
                          </div>
                          <div className="text-gray-400 text-[10px]">{awaySeed}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
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
          .grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          /* 背景色を確実に印刷 */
          .bg-yellow-50, .bg-purple-50, .bg-blue-50,
          .bg-yellow-100, .bg-gray-100, .bg-gray-50 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* テーブルヘッダー背景 */
          thead, th, .bg-gray-700, .bg-blue-600, .bg-gray-600 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
})

FinalSchedulePrintView.displayName = 'FinalSchedulePrintView'

export default FinalSchedulePrintView
