/**
 * 最終結果報告書 - 印刷用ビュー
 * HTMLテンプレート（final_day_results.html）と同等のスタイルで表示
 * ブラウザの印刷機能でPDF化
 */
import { forwardRef } from 'react'

// 型定義
interface Team {
  id: number
  name: string
  short_name?: string
}

interface Goal {
  minute: number
  half: number
  team_id: number
  player_name: string
  is_own_goal?: boolean
}

interface Match {
  id: number
  stage: string
  match_time?: string
  venue?: { name: string }
  home_team?: Team
  away_team?: Team
  home_score_half1?: number
  home_score_half2?: number
  away_score_half1?: number
  away_score_half2?: number
  home_score_total?: number
  away_score_total?: number
  home_pk?: number
  away_pk?: number
  has_penalty_shootout?: boolean
  result?: string
  goals?: Goal[]
}

interface Player {
  type: string
  name: string
  team: string
}

interface FinalResultData {
  tournamentName: string
  date: string
  ranking: (Team | null)[]
  tournament: Match[]
  training: Match[]
  players: Player[]
}

interface Props {
  data: FinalResultData
}

const FinalResultPrintView = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  // スコア表示
  const formatScore = (match: Match) => {
    const home = match.home_score_total ?? 0
    const away = match.away_score_total ?? 0
    let score = `${home} - ${away}`
    if (match.has_penalty_shootout) {
      score += ` (PK ${match.home_pk ?? 0}-${match.away_pk ?? 0})`
    }
    return score
  }

  // 前後半スコア表示
  const formatHalfScore = (match: Match) => {
    return `前半 ${match.home_score_half1 ?? 0}-${match.away_score_half1 ?? 0} / 後半 ${match.home_score_half2 ?? 0}-${match.away_score_half2 ?? 0}`
  }

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
    <div ref={ref} className="print-view bg-white p-8 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🏆 {data.tournamentName}
        </h1>
        <p className="text-gray-600">最終結果報告書</p>
        <p className="text-sm text-gray-500 mt-1">{data.date}</p>
      </div>

      {/* 最終順位 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          📊 最終順位
        </h2>
        <div className="flex justify-center gap-4 flex-wrap">
          {[
            { rank: 1, label: '優勝', color: 'bg-gradient-to-br from-yellow-100 to-yellow-300 border-yellow-400' },
            { rank: 2, label: '準優勝', color: 'bg-gradient-to-br from-gray-100 to-gray-300 border-gray-400' },
            { rank: 3, label: '第3位', color: 'bg-gradient-to-br from-orange-100 to-orange-300 border-orange-400' },
            { rank: 4, label: '第4位', color: 'bg-gray-50 border-gray-300' },
          ].map(({ rank, label, color }) => (
            <div
              key={rank}
              className={`${color} border-2 rounded-lg p-4 min-w-[140px] text-center`}
            >
              <div className="text-xs text-gray-600 mb-1">{label}</div>
              <div className="text-lg font-bold text-gray-900">
                {data.ranking[rank - 1]?.name || '---'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 決勝トーナメント結果 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
          🏆 決勝トーナメント結果
        </h2>
        <div className="space-y-4">
          {data.tournament.map((match) => {
            const isFinal = match.stage === 'final'
            const isThird = match.stage === 'third_place'

            return (
              <div
                key={match.id}
                className={`rounded-lg p-4 border-l-4 ${
                  isFinal
                    ? 'bg-yellow-50 border-yellow-400'
                    : isThird
                    ? 'bg-purple-50 border-purple-400'
                    : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`font-bold ${
                    isFinal ? 'text-yellow-700' : isThird ? 'text-purple-700' : 'text-blue-700'
                  }`}>
                    {getStageName(match.stage)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {match.match_time?.slice(0, 5)} @ {match.venue?.name || '駒場スタジアム'}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <div className="text-right flex-1">
                    <div className="font-bold text-lg">
                      {match.home_team?.short_name || match.home_team?.name || '未定'}
                    </div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatScore(match)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatHalfScore(match)}
                    </div>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg">
                      {match.away_team?.short_name || match.away_team?.name || '未定'}
                    </div>
                  </div>
                </div>

                {/* 得点者 */}
                {match.goals && match.goals.length > 0 && (() => {
                  const goalCount = match.goals.length;
                  // 得点者数・文字数に応じてフォントサイズを調整
                  const totalChars = match.goals.reduce((sum: number, g: { player_name?: string; assist_player_name?: string }) =>
                    sum + (g.player_name?.length || 0) + (g.assist_player_name?.length || 0), 0);
                  const needsShrink = goalCount > 8 || totalChars > 80;
                  const needsMedium = goalCount > 5 || totalChars > 50;
                  const textSize = needsShrink ? 'text-[9px] leading-tight' : needsMedium ? 'text-xs leading-snug' : 'text-sm';
                  const spacing = goalCount > 8 ? 'space-y-0' : goalCount > 5 ? 'space-y-0.5' : 'space-y-1';
                  return (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">⚽ 得点経過</div>
                    <div className={`${textSize} ${spacing}`}>
                      {match.goals.map((goal: { minute?: number; player_name?: string; team_id?: number; is_own_goal?: boolean; assist_player_name?: string }, idx: number) => (
                        <div key={idx} className="flex gap-1 flex-wrap">
                          <span className="text-gray-500">{goal.minute}'</span>
                          <span>{goal.player_name}</span>
                          {goal.assist_player_name && (
                            <span className="text-gray-400">(A: {goal.assist_player_name})</span>
                          )}
                          <span className="text-gray-400">
                            ({goal.team_id === match.home_team?.id
                              ? match.home_team?.short_name || match.home_team?.name
                              : match.away_team?.short_name || match.away_team?.name})
                          </span>
                          {goal.is_own_goal && <span className="text-red-500">(OG)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            )
          })}
        </div>
      </section>

      {/* 研修試合結果 - 2列レイアウトで1ページに収める */}
      {Object.keys(trainingByVenue).length > 0 && (
        <section className="mb-6 page-break-before">
          <h2 className="text-base font-bold text-gray-800 mb-3 pb-1 border-b-2 border-gray-300">
            ⚽ 研修試合結果
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(trainingByVenue).map(([venue, matches]) => (
              <div key={venue} className="text-xs">
                <div className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1">
                  📍 {venue}（{matches.length}試合）
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-1 py-0.5 text-left w-10">時間</th>
                      <th className="px-1 py-0.5 text-right">ホーム</th>
                      <th className="px-1 py-0.5 text-center w-12">スコア</th>
                      <th className="px-1 py-0.5 text-left">アウェイ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => (
                      <tr key={match.id} className="border-b border-gray-200">
                        <td className="px-1 py-0.5 text-gray-500">
                          {match.match_time?.slice(0, 5)}
                        </td>
                        <td className="px-1 py-0.5 text-right font-medium truncate max-w-[60px]">
                          {match.home_team?.short_name || match.home_team?.name || '未定'}
                        </td>
                        <td className="px-1 py-0.5 text-center font-bold">
                          {match.home_score_total ?? 0} - {match.away_score_total ?? 0}
                        </td>
                        <td className="px-1 py-0.5 text-left font-medium truncate max-w-[60px]">
                          {match.away_team?.short_name || match.away_team?.name || '未定'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 優秀選手 */}
      {data.players.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
            🎖️ 優秀選手
          </h2>
          <div className="space-y-2">
            {data.players.map((player, idx) => {
              const isMVP = player.type === 'MVP' || player.type === '最優秀選手'
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 p-3 rounded-lg ${
                    isMVP ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
                  }`}
                >
                  <span className="font-bold text-gray-700 w-24">
                    {isMVP ? '🏆 最優秀選手' : '⭐ 優秀選手'}
                  </span>
                  <span className="font-medium">{player.name}</span>
                  <span className="text-gray-500">({player.team})</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
          /* グラデーション背景を確実に印刷 */
          .bg-gradient-to-br,
          .from-yellow-100, .from-gray-100, .from-orange-100,
          .bg-yellow-50, .bg-purple-50, .bg-blue-50,
          .bg-yellow-100, .bg-gray-100, .bg-gray-50,
          .bg-orange-100, .bg-red-100, .bg-green-100 {
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

FinalResultPrintView.displayName = 'FinalResultPrintView'

export default FinalResultPrintView
