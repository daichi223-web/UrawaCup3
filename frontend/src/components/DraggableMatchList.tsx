/**
 * クリック選択で組み合わせ変更可能な試合リスト
 * 予選リーグ・研修試合・決勝トーナメントで使用
 */
import { useState } from 'react'
import { ArrowLeftRight, Check } from 'lucide-react'
import type { MatchWithDetails } from '@/types'

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

/**
 * クリック可能なチームスロット
 */
function ClickableTeamSlot({ match, position, isSelected, isSwapTarget, onClick, disabled, hasConsecutiveError }: TeamSlotProps) {
  const team = position === 'home' ? match.homeTeam : match.awayTeam
  const teamId = position === 'home' ? match.homeTeamId : match.awayTeamId

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
              : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
      {hasConsecutiveError && !isSelected && <span className="text-red-500 text-xs">⚠</span>}
      <span className={`font-medium truncate flex-1 ${hasConsecutiveError ? 'text-red-700' : ''}`}>
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
}: ClickableMatchListProps) {
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null)

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

      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((match) => {
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

          return (
            <div key={match.id} className={`bg-white rounded-lg border-2 p-4 ${
              homeHasConsecutiveError || awayHasConsecutiveError
                ? 'border-red-300'
                : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-500">
                  #{match.matchOrder} {match.matchTime?.substring(0, 5)}
                </div>
                <div className="flex items-center gap-1">
                  {(homeHasConsecutiveError || awayHasConsecutiveError) && (
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

              {/* スコア表示（完了時） */}
              {match.status === 'completed' && (
                <div className="mt-3 text-center">
                  <div className="text-lg font-bold">
                    {match.homeScoreTotal} - {match.awayScoreTotal}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    前半: {match.homeScoreHalf1 ?? 0} - {match.awayScoreHalf1 ?? 0}
                    後半: {match.homeScoreHalf2 ?? 0} - {match.awayScoreHalf2 ?? 0}
                  </div>
                  {match.hasPenaltyShootout && (
                    <div className="text-xs text-orange-600 font-medium mt-1">
                      PK: {match.homePK ?? 0} - {match.awayPK ?? 0}
                    </div>
                  )}
                </div>
              )}
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
