// src/pages/Standings/components/RankingRules.tsx

interface RankingRulesProps {
  useGroupSystem: boolean
  isOverallRanking: boolean
}

export function RankingRules({ useGroupSystem, isOverallRanking }: RankingRulesProps) {
  return (
    <div className="card no-print">
      <div className="card-header">
        <h3 className="text-lg font-semibold">順位決定ルール</h3>
      </div>
      <div className="card-body">
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>勝点（勝利=3点、引分=1点、敗北=0点）</li>
          <li>得失点差（ゴールディファレンス）</li>
          <li>総得点</li>
          <li>当該チーム間の対戦成績</li>
          <li>抽選</li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          {useGroupSystem && !isOverallRanking
            ? '※ 各グループ1位が決勝トーナメントに進出します'
            : '※ 総合順位で上位4チームが決勝トーナメントに進出します'}
        </p>
      </div>
    </div>
  )
}

export default RankingRules
