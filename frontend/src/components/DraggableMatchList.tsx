/**
 * クリック選択で組み合わせ変更可能な試合リスト
 * 予選リーグ・研修試合・決勝トーナメントで使用
 */
import { useState, useMemo } from 'react'
import { ArrowLeftRight, Check, AlertCircle, AlertTriangle } from 'lucide-react'
import type { MatchWithDetails } from '@/types'
import { validateMatches, getViolationsForMatch, type ConstraintViolation, type MatchForValidation } from '@/lib/matchConstraints'

// 選択状態の型
interface SelectedTeam {
  matchId: number
  position: 'home' | 'away'
  teamId: number
  teamName: string
}

interface TeamSlotProps {
  match: MatchWithDetails
  position: 'home' | 'away'
  isSelected: boolean
  isSwapTarget: boolean
  onClick: () => void
  disabled: boolean
  hasConsecutiveError?: boolean
}

// グループごとの色設定
const GROUP_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  A: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  B: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  C: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', badge: 'bg-green-100 text-green-700' },
  D: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
}

/**
 * クリック可能なチームスロット
 */
function ClickableTeamSlot({ match, position, isSelected, isSwapTarget, onClick, disabled, hasConsecutiveError }: TeamSlotProps) {
  const team = position === 'home' ? match.homeTeam : match.awayTeam
  const teamId = position === 'home' ? match.homeTeamId : match.awayTeamId
  const groupId = team?.groupId || team?.group_id || null
  const groupColors = groupId ? GROUP_COLORS[groupId] : null

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 p-2 rounded border-2 w-full text-left transition-all
        ${hasConsecutiveError
          ? 'border-red-400 bg-red-50'
          : isSelected
            ? 'border-primary-500 bg-primary-100 ring-2 ring-primary-300'
            : isSwapTarget
              ? 'border-green-400 bg-green-50 hover:bg-green-100'
              : groupColors
                ? `${groupColors.border} ${groupColors.bg} hover:opacity-80`
                : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
      {hasConsecutiveError && !isSelected && <span className="text-red-500 text-xs">⚠</span>}
      <span
        className={`font-medium flex-1 min-w-0 truncate ${hasConsecutiveError ? 'text-red-700' : groupColors ? groupColors.text : ''}`}
        style={{
          fontSize: (team?.shortName || team?.name || '')?.length > 8 ? '0.75rem' : '0.875rem',
          lineHeight: '1.25',
        }}
      >
        {team?.shortName || team?.name || `チームID: ${teamId}`}
      </span>
    </button>
  )
}

interface MatchCardWithSwapProps {
  match: MatchWithDetails
  onSwapTeams?: (matchId: number, homeTeamId: number, awayTeamId: number) => void
}

/**
 * 試合カード（チーム入れ替えボタン付き）
 */
function MatchCardWithSwap({ match, onSwapTeams }: MatchCardWithSwapProps) {
  const handleSwap = () => {
    if (onSwapTeams && match.homeTeamId && match.awayTeamId) {
      // ホームとアウェイを入れ替え
      onSwapTeams(match.id, match.awayTeamId, match.homeTeamId)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    }
    const labels: Record<string, string> = {
      scheduled: '予定',
      in_progress: '試合中',
      completed: '終了',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || styles.scheduled}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-500">
          #{match.matchOrder} {match.matchTime?.substring(0, 5)}
        </div>
        {getStatusBadge(match.status)}
      </div>

      <div className="flex items-center gap-2">
        {/* ホームチーム */}
        <div className="flex-1 p-2 bg-gray-50 rounded text-center">
          <span className="font-medium">
            {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
          </span>
        </div>

        {/* 入れ替えボタン */}
        <button
          onClick={handleSwap}
          disabled={match.status === 'completed'}
          className={`
            p-2 rounded-full transition-colors
            ${match.status === 'completed'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-100 text-primary-600 hover:bg-primary-200 cursor-pointer'
            }
          `}
          title="ホーム/アウェイを入れ替え"
        >
          <ArrowLeftRight className="w-5 h-5" />
        </button>

        {/* アウェイチーム */}
        <div className="flex-1 p-2 bg-gray-50 rounded text-center">
          <span className="font-medium">
            {match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
          </span>
        </div>
      </div>

      {/* スコア表示（完了時） */}
      {match.status === 'completed' && (
        <div className="mt-3 text-center text-lg font-bold">
          {match.homeScoreTotal} - {match.awayScoreTotal}
        </div>
      )}
    </div>
  )
}

interface ClickableMatchListProps {
  matches: MatchWithDetails[]
  onSwapTeams: (matchId: number, homeTeamId: number, awayTeamId: number) => void
  title?: string
  emptyMessage?: string
  consecutiveMatchTeams?: Set<number>
  /** 制約チェック用のチーム情報（指定すると即時チェック有効） */
  teams?: { id: number; name: string; groupId: string }[]
  /** 制約チェックを有効にする（デフォルト: true） */
  enableConstraintCheck?: boolean
}

/**
 * クリック選択対応試合リスト
 *
 * 機能:
 * - 1回目クリック: チームを選択（ハイライト表示）
 * - 2回目クリック: 別のチームをクリックすると入れ替え
 * - 同じチームを再クリック: 選択解除
 */
export default function DraggableMatchList({
  matches,
  onSwapTeams,
  title = '試合一覧',
  emptyMessage = '試合がありません',
  consecutiveMatchTeams,
  teams = [],
  enableConstraintCheck = true,
}: ClickableMatchListProps) {
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null)

  // 制約チェック（即時実行）
  const violations = useMemo(() => {
    if (!enableConstraintCheck || teams.length === 0) return []

    const matchesForValidation: MatchForValidation[] = matches.map(m => ({
      id: m.id,
      matchDate: m.matchDate || m.match_date || '',
      matchTime: m.matchTime || m.match_time || '',
      homeTeamId: m.homeTeamId || m.home_team_id || 0,
      awayTeamId: m.awayTeamId || m.away_team_id || 0,
      homeTeamName: m.homeTeam?.shortName || m.homeTeam?.name || '',
      awayTeamName: m.awayTeam?.shortName || m.awayTeam?.name || '',
      groupId: m.groupId || m.group_id || undefined,
    }))

    return validateMatches(matchesForValidation, teams)
  }, [matches, teams, enableConstraintCheck])

  // 試合ごとの違反を取得
  const getMatchViolations = (matchId: number): ConstraintViolation[] => {
    return getViolationsForMatch(matchId, violations)
  }

  // 違反タイプに応じたバッジ
  const ViolationBadge = ({ violation }: { violation: ConstraintViolation }) => {
    const isError = violation.level === 'error'
    const isWarning = violation.level === 'warning'
    return (
      <span
        className={`px-1.5 py-0.5 text-xs rounded-full inline-flex items-center gap-1 ${
          isError
            ? 'bg-red-100 text-red-700'
            : isWarning
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-blue-100 text-blue-700'
        }`}
        title={violation.description}
      >
        {isError ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {violation.label}
      </span>
    )
  }

  // チームクリック処理
  const handleTeamClick = (match: MatchWithDetails, position: 'home' | 'away') => {
    // 完了済みの試合は操作不可
    if (match.status === 'completed') return

    const teamId = position === 'home' ? match.homeTeamId : match.awayTeamId
    const team = position === 'home' ? match.homeTeam : match.awayTeam
    const teamName = team?.shortName || team?.name || `チーム${teamId}`

    if (!teamId) return

    // 選択中のチームがない場合 → 選択
    if (!selectedTeam) {
      setSelectedTeam({ matchId: match.id, position, teamId, teamName })
      return
    }

    // 同じチームをクリック → 選択解除
    if (selectedTeam.matchId === match.id && selectedTeam.position === position) {
      setSelectedTeam(null)
      return
    }

    // 別のチームをクリック → 入れ替え実行
    const targetTeamId = teamId

    // 同じ試合内での入れ替え
    if (selectedTeam.matchId === match.id) {
      onSwapTeams(match.id, match.awayTeamId!, match.homeTeamId!)
    } else {
      // 異なる試合間でのチーム交換
      const selectedMatch = matches.find(m => m.id === selectedTeam.matchId)
      if (selectedMatch) {
        // 選択元の試合を更新
        const newSelectedHome = selectedTeam.position === 'home' ? targetTeamId : selectedMatch.homeTeamId
        const newSelectedAway = selectedTeam.position === 'away' ? targetTeamId : selectedMatch.awayTeamId

        // 対象の試合を更新
        const newTargetHome = position === 'home' ? selectedTeam.teamId : match.homeTeamId
        const newTargetAway = position === 'away' ? selectedTeam.teamId : match.awayTeamId

        if (newSelectedHome && newSelectedAway) {
          onSwapTeams(selectedMatch.id, newSelectedHome, newSelectedAway)
        }
        if (newTargetHome && newTargetAway) {
          onSwapTeams(match.id, newTargetHome, newTargetAway)
        }
      }
    }

    // 選択解除
    setSelectedTeam(null)
  }

  // 選択解除
  const clearSelection = () => {
    setSelectedTeam(null)
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  // 違反サマリー
  const errorCount = violations.filter(v => v.level === 'error').length
  const warningCount = violations.filter(v => v.level === 'warning').length

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {selectedTeam ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary-600 font-medium">
                「{selectedTeam.teamName}」を選択中
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                解除
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              チームをクリックして選択
            </div>
          )}
        </div>
      )}

      {/* 制約違反サマリー */}
      {enableConstraintCheck && violations.length > 0 && (
        <div className={`p-3 rounded-lg flex items-center gap-4 ${
          errorCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          {errorCount > 0 && (
            <div className="flex items-center gap-1 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">エラー: {errorCount}件</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">警告: {warningCount}件</span>
            </div>
          )}
          <span className="text-xs text-gray-500">各試合カードにバッジ表示</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* 試合を左右2列に分割: 左列に前半分、右列に後半分 */}
        {(() => {
          const sortedMatches = [...matches].sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0))
          const mid = Math.ceil(sortedMatches.length / 2)
          const leftMatches = sortedMatches.slice(0, mid)
          const rightMatches = sortedMatches.slice(mid)

          // 左右のカラムを交互に並べてgridで表示
          const interleavedMatches: MatchWithDetails[] = []
          for (let i = 0; i < Math.max(leftMatches.length, rightMatches.length); i++) {
            if (leftMatches[i]) interleavedMatches.push(leftMatches[i])
            if (rightMatches[i]) interleavedMatches.push(rightMatches[i])
          }
          return interleavedMatches
        })().map((match) => {
          const isHomeSelected = selectedTeam?.matchId === match.id && selectedTeam.position === 'home'
          const isAwaySelected = selectedTeam?.matchId === match.id && selectedTeam.position === 'away'
          const isDisabled = match.status === 'completed'
          // 選択中のチームがあり、この試合の別のチームである場合はスワップターゲット
          const isHomeSwapTarget = selectedTeam !== null && !isHomeSelected && !isDisabled
          const isAwaySwapTarget = selectedTeam !== null && !isAwaySelected && !isDisabled
          // 連戦チェック
          const homeTeamId = match.homeTeamId || (match as any).home_team_id
          const awayTeamId = match.awayTeamId || (match as any).away_team_id
          const homeHasConsecutiveError = consecutiveMatchTeams?.has(homeTeamId) ?? false
          const awayHasConsecutiveError = consecutiveMatchTeams?.has(awayTeamId) ?? false

          // 制約違反をチェック
          const matchViolations = getMatchViolations(match.id)
          const hasError = matchViolations.some(v => v.level === 'error')
          const hasWarning = matchViolations.some(v => v.level === 'warning')

          return (
            <div key={match.id} className={`bg-white rounded-lg border-2 p-4 ${
              hasError
                ? 'border-red-400 bg-red-50'
                : hasWarning || homeHasConsecutiveError || awayHasConsecutiveError
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="w-6 text-right font-mono">#{match.matchOrder}</span>
                  <span className="font-mono">{match.matchTime?.substring(0, 5)}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {/* 制約違反バッジ */}
                  {getMatchViolations(match.id).map((v, i) => (
                    <ViolationBadge key={i} violation={v} />
                  ))}
                  {/* 連戦バッジ（従来の方式も維持） */}
                  {(homeHasConsecutiveError || awayHasConsecutiveError) &&
                   !getMatchViolations(match.id).some(v => v.type === 'consecutive') && (
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                      連戦
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    match.status === 'completed' ? 'bg-green-100 text-green-800' :
                    match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {match.status === 'completed' ? '終了' :
                     match.status === 'in_progress' ? '試合中' : '予定'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* ホームチーム（クリック可能） */}
                <div className="flex-1">
                  <ClickableTeamSlot
                    match={match}
                    position="home"
                    isSelected={isHomeSelected}
                    isSwapTarget={isHomeSwapTarget}
                    onClick={() => handleTeamClick(match, 'home')}
                    disabled={isDisabled}
                    hasConsecutiveError={homeHasConsecutiveError}
                  />
                </div>

                <div className="text-gray-400 font-bold">vs</div>

                {/* アウェイチーム（クリック可能） */}
                <div className="flex-1">
                  <ClickableTeamSlot
                    match={match}
                    position="away"
                    isSelected={isAwaySelected}
                    isSwapTarget={isAwaySwapTarget}
                    onClick={() => handleTeamClick(match, 'away')}
                    disabled={isDisabled}
                    hasConsecutiveError={awayHasConsecutiveError}
                  />
                </div>
              </div>

              {/* スコア表示（常に領域を確保） */}
              <div className="mt-3">
                {match.status === 'completed' ? (
                  /* 完了時: スコア表示 */
                  <div className="flex items-center justify-center gap-3">
                    {/* ホームスコア */}
                    <div className="text-2xl font-bold text-gray-800 w-8 text-center">
                      {match.homeScoreTotal ?? 0}
                    </div>
                    {/* 中央: 前後半スコア */}
                    <div className="flex flex-col items-center text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <span className="w-3 text-right">{match.homeScoreHalf1 ?? 0}</span>
                        <span className="text-gray-400">前</span>
                        <span className="w-3 text-left">{match.awayScoreHalf1 ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 text-right">{match.homeScoreHalf2 ?? 0}</span>
                        <span className="text-gray-400">後</span>
                        <span className="w-3 text-left">{match.awayScoreHalf2 ?? 0}</span>
                      </div>
                      {match.hasPenaltyShootout && (
                        <div className="flex items-center gap-1 text-orange-600 font-medium">
                          <span className="w-3 text-right">{match.homePK ?? 0}</span>
                          <span>PK</span>
                          <span className="w-3 text-left">{match.awayPK ?? 0}</span>
                        </div>
                      )}
                    </div>
                    {/* アウェイスコア */}
                    <div className="text-2xl font-bold text-gray-800 w-8 text-center">
                      {match.awayScoreTotal ?? 0}
                    </div>
                  </div>
                ) : (
                  /* 未完了時: プレースホルダー */
                  <div className="flex items-center justify-center gap-3 text-gray-300">
                    <div className="text-2xl font-bold w-8 text-center">-</div>
                    <div className="flex flex-col items-center text-xs">
                      <div className="flex items-center gap-1">
                        <span className="w-3 text-right">-</span>
                        <span>前</span>
                        <span className="w-3 text-left">-</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 text-right">-</span>
                        <span>後</span>
                        <span className="w-3 text-left">-</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold w-8 text-center">-</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-xs text-gray-400 text-center mt-4">
        ※ チームをクリックして選択後、入れ替えたいチームをクリックしてください
      </div>
    </div>
  )
}

export { MatchCardWithSwap }
