/**
 * クリック選択で組み合わせ変更可能な試合リスト
 * 予選リーグ・研修試合・決勝トーナメントで使用
 */
import { useState, useMemo } from 'react'
import { ArrowLeftRight, Check, AlertCircle, AlertTriangle } from 'lucide-react'
import type { MatchWithDetails } from '@/types'
import { validateMatches, getViolationsForMatch, type ConstraintViolation, type MatchForValidation, type ConstraintCheckSettings } from '@/lib/matchConstraints'
import { useConstraintSettingsStore } from '@/stores/constraintSettingsStore'

// 選択状態の型（外部からも使用可能にexport）
export interface SelectedTeam {
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
  compact?: boolean
  isChanged?: boolean  // 未確定の変更があるか
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
function ClickableTeamSlot({ match, position, isSelected, isSwapTarget, onClick, disabled, hasConsecutiveError, compact, isChanged }: TeamSlotProps) {
  const team = position === 'home' ? match.homeTeam : match.awayTeam
  const teamId = position === 'home' ? match.homeTeamId : match.awayTeamId
  const groupId = team?.groupId || team?.group_id || null
  const groupColors = groupId ? GROUP_COLORS[groupId] : null

  // 変更されたチームは目立つシアン色で表示
  const changedStyle = isChanged ? 'border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300' : ''

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 ${compact ? 'px-1.5 py-0.5' : 'p-2'} rounded border ${compact ? 'border' : 'border-2'} w-full text-left transition-all overflow-hidden
        ${isChanged
          ? changedStyle
          : hasConsecutiveError
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
      {isSelected && <Check className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-primary-600 flex-shrink-0`} />}
      {isChanged && !isSelected && <span className="text-cyan-600 text-xs font-bold">★</span>}
      {hasConsecutiveError && !isSelected && !isChanged && <span className="text-red-500 text-xs">⚠</span>}
      <span
        className={`font-medium flex-1 min-w-0 truncate ${isChanged ? 'text-cyan-800' : hasConsecutiveError ? 'text-red-700' : groupColors ? groupColors.text : ''}`}
        style={{
          fontSize: compact ? '0.65rem' : (team?.shortName || team?.name || '')?.length > 8 ? '0.75rem' : '0.875rem',
          lineHeight: '1.1',
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
        <div className="flex-1 min-w-0 p-2 bg-gray-50 rounded text-center">
          <span className="font-medium truncate block">
            {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
          </span>
        </div>

        {/* 入れ替えボタン */}
        <button
          onClick={handleSwap}
          disabled={match.status === 'completed'}
          className={`
            p-2 rounded-full transition-colors flex-shrink-0
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
        <div className="flex-1 min-w-0 p-2 bg-gray-50 rounded text-center">
          <span className="font-medium truncate block">
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
  teams?: {
    id: number
    name: string
    groupId: string
    teamType?: 'local' | 'invited'  // 地元校 or 招待校
    region?: string                  // 地域
    leagueId?: string | number       // 所属リーグID
  }[]
  /** 制約チェックを有効にする（デフォルト: true） */
  enableConstraintCheck?: boolean
  /** コンパクト表示モード */
  compact?: boolean
  /** 外部管理の選択状態（会場を超えた選択に使用） */
  externalSelectedTeam?: SelectedTeam | null
  /** 外部選択状態の変更ハンドラ */
  onExternalSelect?: (selected: SelectedTeam | null) => void
  /** 全試合リスト（会場を超えた交換時に相手の試合を検索するため） */
  allMatches?: MatchWithDetails[]
  /** 変更されたチームID（未確定の変更をハイライト） */
  changedTeamIds?: Set<number>
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
  compact = false,
  externalSelectedTeam,
  onExternalSelect,
  allMatches,
  changedTeamIds,
}: ClickableMatchListProps) {
  // 内部状態（外部状態が提供されない場合に使用）
  const [internalSelectedTeam, setInternalSelectedTeam] = useState<SelectedTeam | null>(null)

  // 外部状態が提供されている場合はそれを使用、そうでなければ内部状態を使用
  const useExternalState = externalSelectedTeam !== undefined && onExternalSelect !== undefined
  const selectedTeam = useExternalState ? externalSelectedTeam : internalSelectedTeam
  const setSelectedTeam = useExternalState ? onExternalSelect : setInternalSelectedTeam

  // 制約設定を取得
  const { settings: constraintSettings } = useConstraintSettingsStore()

  // グループ内通し番号を計算
  const groupMatchNumbers = useMemo(() => {
    const numberMap = new Map<number, number>()
    // グループ別に分類
    const groupedMatches = new Map<string, MatchWithDetails[]>()
    matches.forEach(match => {
      const groupId = match.groupId || (match as any).group_id || 'default'
      if (!groupedMatches.has(groupId)) {
        groupedMatches.set(groupId, [])
      }
      groupedMatches.get(groupId)!.push(match)
    })
    // 各グループ内でmatchOrderでソートし、グループ内番号を付与
    groupedMatches.forEach((groupMatches) => {
      const sorted = [...groupMatches].sort(
        (a, b) => (a.matchOrder || a.match_order || 0) - (b.matchOrder || b.match_order || 0)
      )
      sorted.forEach((match, idx) => {
        numberMap.set(match.id, idx + 1)
      })
    })
    return numberMap
  }, [matches])

  // 制約チェック（即時実行）
  const violations = useMemo(() => {
    console.log('[DraggableMatchList] Constraint check:', {
      enableConstraintCheck,
      teamsCount: teams.length,
      matchesCount: matches.length,
      constraintSettings,
    })

    if (!enableConstraintCheck || teams.length === 0) {
      console.log('[DraggableMatchList] Skipping constraint check (disabled or no teams)')
      return []
    }

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

    // 設定を ConstraintCheckSettings 形式に変換
    const checkSettings: ConstraintCheckSettings = {
      avoidLocalVsLocal: constraintSettings.avoidLocalVsLocal,
      avoidSameRegion: constraintSettings.avoidSameRegion,
      avoidSameLeague: constraintSettings.avoidSameLeague,
      avoidConsecutive: constraintSettings.avoidConsecutive,
      warnDailyGameLimit: constraintSettings.warnDailyGameLimit,
      warnTotalGameLimit: constraintSettings.warnTotalGameLimit,
    }

    const result = validateMatches(matchesForValidation, teams, undefined, checkSettings)
    console.log('[DraggableMatchList] Violations found:', result.length, result)
    return result
  }, [matches, teams, enableConstraintCheck, constraintSettings])

  // 試合ごとの違反を取得
  const getMatchViolations = (matchId: number): ConstraintViolation[] => {
    return getViolationsForMatch(matchId, violations)
  }

  // 違反タイプごとのバッジ設定
  const VIOLATION_BADGE_CONFIG: Record<string, { short: string; color: string; icon: string }> = {
    // エラー（赤系）
    sameTimeConflict: { short: '重複', color: 'bg-red-500 text-white', icon: '⊗' },
    duplicateMatch: { short: '済', color: 'bg-red-400 text-white', icon: '✕' },
    selfMatch: { short: '自', color: 'bg-red-600 text-white', icon: '!' },
    // 警告（各色）
    consecutive: { short: '連', color: 'bg-yellow-400 text-yellow-900', icon: '→' },
    dailyGameLimit: { short: '3+', color: 'bg-orange-400 text-white', icon: '▲' },
    tooManyGamesTotal: { short: '5+', color: 'bg-orange-500 text-white', icon: '▲' },
    notEnoughGames: { short: '少', color: 'bg-purple-400 text-white', icon: '▽' },
    localVsLocal: { short: '地', color: 'bg-pink-400 text-white', icon: '◆' },
    sameRegion: { short: '域', color: 'bg-indigo-400 text-white', icon: '■' },
    sameLeague: { short: 'L', color: 'bg-blue-400 text-white', icon: '●' },
    refereeConflict: { short: '審', color: 'bg-pink-500 text-white', icon: '!' },
  }

  // 違反タイプに応じたバッジ
  const ViolationBadge = ({ violation }: { violation: ConstraintViolation }) => {
    const config = VIOLATION_BADGE_CONFIG[violation.type]
    if (config) {
      return (
        <span
          className={`px-1 py-0.5 text-xs rounded font-bold ${config.color}`}
          title={`${violation.label}: ${violation.description}`}
        >
          {config.short}
        </span>
      )
    }
    // 未定義タイプのフォールバック
    const isError = violation.level === 'error'
    return (
      <span
        className={`px-1 py-0.5 text-xs rounded ${isError ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}
        title={violation.description}
      >
        {violation.label.slice(0, 2)}
      </span>
    )
  }

  // 凡例コンポーネント
  const ViolationLegend = () => {
    const legendItems = [
      { short: '連', color: 'bg-yellow-400 text-yellow-900', label: '連戦' },
      { short: '3+', color: 'bg-orange-400 text-white', label: '1日3試合以上' },
      { short: '5+', color: 'bg-orange-500 text-white', label: '2日間5試合以上' },
      { short: '少', color: 'bg-purple-400 text-white', label: '試合数不足' },
      { short: '地', color: 'bg-pink-400 text-white', label: '地元同士' },
      { short: '域', color: 'bg-indigo-400 text-white', label: '同地域' },
      { short: 'L', color: 'bg-blue-400 text-white', label: '同リーグ' },
    ]
    return (
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="font-medium">凡例:</span>
        {legendItems.map(item => (
          <span key={item.short} className="inline-flex items-center gap-0.5">
            <span className={`px-1 py-0.5 rounded font-bold ${item.color}`}>{item.short}</span>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
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
      // allMatchesが提供されている場合は会場を超えた検索、そうでなければ現在のリスト内のみ
      const searchList = allMatches || matches
      const selectedMatch = searchList.find(m => m.id === selectedTeam.matchId)
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

  // 警告の内訳をタイプ別にカウント
  const warningsByType = useMemo(() => {
    const warnings = violations.filter(v => v.level === 'warning')
    const counts: Record<string, number> = {}
    warnings.forEach(w => {
      counts[w.type] = (counts[w.type] || 0) + 1
    })
    return counts
  }, [violations])

  return (
    <div className={compact ? 'space-y-1' : 'space-y-4'}>
      {title && !compact && (
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

      {/* 制約違反サマリー（コンパクトモードでは非表示） */}
      {!compact && enableConstraintCheck && violations.length > 0 && (
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
          {/* 警告の内訳 */}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">内訳:</span>
              {warningsByType.notEnoughGames && (
                <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                  試合数不足 {warningsByType.notEnoughGames}
                </span>
              )}
              {warningsByType.consecutive && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                  連戦 {warningsByType.consecutive}
                </span>
              )}
              {warningsByType.dailyGameLimit && (
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                  1日3試合以上 {warningsByType.dailyGameLimit}
                </span>
              )}
              {warningsByType.localVsLocal && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                  地元同士 {warningsByType.localVsLocal}
                </span>
              )}
              {warningsByType.sameRegion && (
                <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                  同地域 {warningsByType.sameRegion}
                </span>
              )}
              {warningsByType.sameLeague && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  同リーグ {warningsByType.sameLeague}
                </span>
              )}
              {warningsByType.tooManyGamesTotal && (
                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                  2日間5試合以上 {warningsByType.tooManyGamesTotal}
                </span>
              )}
              {warningsByType.refereeConflict && (
                <span className="text-xs px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded-full">
                  審判中試合 {warningsByType.refereeConflict}
                </span>
              )}
            </div>
          )}
          <span className="text-xs text-gray-500">各試合カードにバッジ表示</span>
        </div>
      )}

      {/*
        PCでは2列表示で縦優先（1,2,3 | 4,5,6）
        スマホでは1列表示で順番通り（1,2,3,4,5,6）
        md:grid-flow-col で縦方向に流れるようにし、
        md:grid-rows-N で行数を指定
        compact モードでは1列でスペースを節約
      */}
      <div
        className={compact
          ? 'space-y-1'
          : `grid gap-4 md:grid-cols-2 md:grid-flow-col ${
              matches.length <= 2 ? '' :
              matches.length <= 4 ? 'md:grid-rows-2' :
              matches.length <= 6 ? 'md:grid-rows-3' :
              matches.length <= 8 ? 'md:grid-rows-4' :
              matches.length <= 10 ? 'md:grid-rows-5' :
              'md:grid-rows-6'
            }`
        }
      >
        {/* 試合順でソートして表示 */}
        {[...matches]
          .sort((a, b) => (a.matchOrder || a.match_order || 0) - (b.matchOrder || b.match_order || 0))
          .map((match) => {
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
          // 変更チェック
          const homeIsChanged = changedTeamIds?.has(homeTeamId) ?? false
          const awayIsChanged = changedTeamIds?.has(awayTeamId) ?? false

          // 制約違反をチェック
          const matchViolations = getMatchViolations(match.id)
          const hasError = matchViolations.some(v => v.level === 'error')
          const hasWarning = matchViolations.some(v => v.level === 'warning')

          return compact ? (
            /* コンパクトモード: 1行表示 */
            <div key={match.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${
              hasError
                ? 'border-red-400 bg-red-50'
                : hasWarning || homeHasConsecutiveError || awayHasConsecutiveError
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-200 bg-white'
            }`}>
              {/* 試合番号・時間 */}
              <span className="text-gray-400 font-mono w-8 flex-shrink-0">
                #{groupMatchNumbers.get(match.id) || 1}
              </span>
              <span className="text-gray-500 font-mono w-10 flex-shrink-0">
                {(match.matchTime || match.match_time)?.substring(0, 5)}
              </span>

              {/* チーム名 */}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <ClickableTeamSlot
                  match={match}
                  position="home"
                  isSelected={isHomeSelected}
                  isSwapTarget={isHomeSwapTarget}
                  onClick={() => handleTeamClick(match, 'home')}
                  disabled={isDisabled}
                  hasConsecutiveError={homeHasConsecutiveError}
                  compact
                  isChanged={homeIsChanged}
                />
                <span className="text-gray-400 text-xs flex-shrink-0">vs</span>
                <ClickableTeamSlot
                  match={match}
                  position="away"
                  isSelected={isAwaySelected}
                  isSwapTarget={isAwaySwapTarget}
                  onClick={() => handleTeamClick(match, 'away')}
                  disabled={isDisabled}
                  hasConsecutiveError={awayHasConsecutiveError}
                  compact
                  isChanged={awayIsChanged}
                />
              </div>

              {/* スコア（完了時のみ） */}
              {match.status === 'completed' && (
                <span className="font-bold text-gray-700 w-10 text-center flex-shrink-0">
                  {match.homeScoreTotal ?? 0}-{match.awayScoreTotal ?? 0}
                </span>
              )}
              {/* 警告アイコン */}
              {(hasError || hasWarning) && (
                <span className="text-xs">⚠</span>
              )}
            </div>
          ) : (
            <div key={match.id} className={`bg-white rounded-lg border-2 p-4 ${
              hasError
                ? 'border-red-400 bg-red-50'
                : hasWarning || homeHasConsecutiveError || awayHasConsecutiveError
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="w-6 text-right font-mono">#{groupMatchNumbers.get(match.id) || 1}</span>
                  <span className="font-mono">{(match.matchTime || match.match_time)?.substring(0, 5)}</span>
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
                <div className="flex-1 min-w-0">
                  <ClickableTeamSlot
                    match={match}
                    position="home"
                    isSelected={isHomeSelected}
                    isSwapTarget={isHomeSwapTarget}
                    onClick={() => handleTeamClick(match, 'home')}
                    disabled={isDisabled}
                    hasConsecutiveError={homeHasConsecutiveError}
                    isChanged={homeIsChanged}
                  />
                </div>

                <div className="text-gray-400 font-bold flex-shrink-0">vs</div>

                {/* アウェイチーム（クリック可能） */}
                <div className="flex-1 min-w-0">
                  <ClickableTeamSlot
                    match={match}
                    position="away"
                    isSelected={isAwaySelected}
                    isSwapTarget={isAwaySwapTarget}
                    onClick={() => handleTeamClick(match, 'away')}
                    disabled={isDisabled}
                    hasConsecutiveError={awayHasConsecutiveError}
                    isChanged={awayIsChanged}
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

      {!compact && (
        <div className="text-xs text-gray-400 text-center mt-4">
          ※ チームをクリックして選択後、入れ替えたいチームをクリックしてください
        </div>
      )}

      {/* 凡例（警告がある場合のみ表示） */}
      {!compact && enableConstraintCheck && violations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <ViolationLegend />
        </div>
      )}
    </div>
  )
}

export { MatchCardWithSwap }
