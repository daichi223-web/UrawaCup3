/**
 * 決勝トーナメントブラケット表示コンポーネント
 * 準決勝・3位決定戦・決勝を視覚的に表示
 * クリック選択でチーム入れ替え可能
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

// グループごとの色設定
const GROUP_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  A: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  B: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  C: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', badge: 'bg-green-100 text-green-700' },
  D: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
}

interface FinalsBracketProps {
  matches: MatchWithDetails[]
  onMatchClick?: (match: MatchWithDetails) => void
  onUpdateBracket?: () => void
  onSwapTeams?: (matchId: number, homeTeamId: number, awayTeamId: number) => void
  isLoading?: boolean
}

interface ClickableTeamProps {
  match: MatchWithDetails
  position: 'home' | 'away'
  isWinner?: boolean
  isSelected?: boolean
  isSwapTarget?: boolean
  onClick?: () => void
  disabled?: boolean
}

/**
 * クリック可能なチームスロット
 */
function ClickableTeam({ match, position, isWinner, isSelected, isSwapTarget, onClick, disabled }: ClickableTeamProps) {
  const team = position === 'home' ? match.homeTeam : match.awayTeam
  const teamId = position === 'home' ? match.homeTeamId : match.awayTeamId
  const teamName = team?.shortName || team?.name || `チームID: ${teamId}`
  const groupId = team?.groupId || team?.group_id || null
  const groupColors = groupId ? GROUP_COLORS[groupId] : null

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      disabled={disabled}
      className={`
        flex items-center justify-between p-2 rounded w-full text-left transition-all
        ${isWinner ? 'bg-green-50 font-bold' : ''}
        ${isSelected
          ? 'ring-2 ring-primary-500 bg-primary-100 border-primary-500'
          : isSwapTarget
            ? 'bg-green-50 border-green-400 hover:bg-green-100'
            : groupColors && !isWinner
              ? `${groupColors.bg} ${groupColors.border} hover:opacity-80`
              : 'hover:bg-gray-100 border-transparent'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        border-2
      `}
    >
      <div className="flex items-center gap-2 flex-1">
        {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
        <span
          className={`${groupColors ? groupColors.text : ''}`}
          style={{
            fontSize: teamName.length > 8 ? '0.75rem' : '0.875rem',
            lineHeight: '1.25',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {teamName}
        </span>
        {groupId && (
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${groupColors?.badge || 'bg-gray-100 text-gray-600'}`}>
            {groupId}グループ
          </span>
        )}
        {isWinner && <span className="ml-1 text-green-600 flex-shrink-0">◎</span>}
      </div>
    </button>
  )
}

interface MatchCardProps {
  match: MatchWithDetails | undefined
  title: string
  onClick?: () => void
  onSwapTeams?: (matchId: number, homeTeamId: number, awayTeamId: number) => void
  className?: string
  selectable?: boolean
  selectedTeam?: SelectedTeam | null
  onTeamClick?: (match: MatchWithDetails, position: 'home' | 'away') => void
}

/**
 * 試合カードコンポーネント
 */
function MatchCard({
  match,
  title,
  onClick,
  onSwapTeams,
  className = '',
  selectable = false,
  selectedTeam,
  onTeamClick,
}: MatchCardProps) {
  if (!match) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 ${className}`}>
        <div className="text-sm text-gray-500 mb-2">{title}</div>
        <div className="text-center text-gray-400 py-4">未設定</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '終了'
      case 'in_progress':
        return '試合中'
      case 'scheduled':
        return '予定'
      default:
        return status
    }
  }

  const isCompleted = match.status === 'completed'
  const homeWon = isCompleted && match.result === 'home_win'
  const awayWon = isCompleted && match.result === 'away_win'
  const canSelect = selectable && !isCompleted

  const handleInternalSwap = () => {
    if (onSwapTeams && match.homeTeamId && match.awayTeamId && !isCompleted) {
      onSwapTeams(match.id, match.awayTeamId, match.homeTeamId)
    }
  }

  const isHomeSelected = selectedTeam?.matchId === match.id && selectedTeam.position === 'home'
  const isAwaySelected = selectedTeam?.matchId === match.id && selectedTeam.position === 'away'
  const isHomeSwapTarget = selectedTeam !== null && !isHomeSelected && canSelect
  const isAwaySwapTarget = selectedTeam !== null && !isAwaySelected && canSelect

  return (
    <div
      className={`bg-white rounded-lg shadow border-2 border-gray-200 p-4 cursor-pointer hover:border-primary-300 transition-colors ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-medium text-gray-700">{title}</div>
        <div className="flex items-center gap-2">
          {canSelect && onSwapTeams && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleInternalSwap()
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              title="ホーム/アウェイ入れ替え"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(match.status)}`}>
            {getStatusLabel(match.status)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {/* ホームチーム */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <ClickableTeam
              match={match}
              position="home"
              isWinner={homeWon}
              isSelected={isHomeSelected}
              isSwapTarget={isHomeSwapTarget}
              onClick={() => onTeamClick?.(match, 'home')}
              disabled={!canSelect}
            />
          </div>
          {isCompleted && (
            <div className="text-lg font-bold ml-4">
              {match.homeScoreTotal ?? '-'}
              {match.hasPenaltyShootout && match.homePK !== null && (
                <span className="text-sm text-gray-500 ml-1">({match.homePK})</span>
              )}
            </div>
          )}
        </div>

        {/* アウェイチーム */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <ClickableTeam
              match={match}
              position="away"
              isWinner={awayWon}
              isSelected={isAwaySelected}
              isSwapTarget={isAwaySwapTarget}
              onClick={() => onTeamClick?.(match, 'away')}
              disabled={!canSelect}
            />
          </div>
          {isCompleted && (
            <div className="text-lg font-bold ml-4">
              {match.awayScoreTotal ?? '-'}
              {match.hasPenaltyShootout && match.awayPK !== null && (
                <span className="text-sm text-gray-500 ml-1">({match.awayPK})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 試合時刻・会場 */}
      <div className="mt-3 text-xs text-gray-500 flex justify-between">
        <span>{match.matchTime?.substring(0, 5) || '--:--'}</span>
        <span>{match.venue?.name || '会場未定'}</span>
      </div>

      {/* PK表記 */}
      {match.hasPenaltyShootout && (
        <div className="mt-2 text-xs text-center text-orange-600 font-medium">
          PK戦
        </div>
      )}

      {/* 入れ替え可能表示 */}
      {canSelect && (
        <div className="mt-2 text-xs text-center text-gray-400">
          チームをクリックして入れ替え
        </div>
      )}
    </div>
  )
}

/**
 * 決勝トーナメントブラケット
 */
export default function FinalsBracket({
  matches,
  onMatchClick,
  onUpdateBracket,
  onSwapTeams,
  isLoading = false,
}: FinalsBracketProps) {
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null)

  // 試合をステージで分類
  const semifinals = matches.filter((m) => m.stage === 'semifinal').sort((a, b) => a.matchOrder - b.matchOrder)
  const thirdPlace = matches.find((m) => m.stage === 'third_place')
  const final = matches.find((m) => m.stage === 'final')

  const semifinal1 = semifinals[0]
  const semifinal2 = semifinals[1]

  // 準決勝が両方完了しているか
  const bothSemifinalsCompleted =
    semifinal1?.status === 'completed' &&
    semifinal2?.status === 'completed' &&
    semifinal1?.result &&
    semifinal2?.result

  const handleMatchClick = (match: MatchWithDetails | undefined) => {
    if (match) {
      onMatchClick?.(match)
    }
  }

  // チームクリック処理
  const handleTeamClick = (match: MatchWithDetails, position: 'home' | 'away') => {
    if (!onSwapTeams) return
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
      if (selectedMatch && selectedMatch.status !== 'completed') {
        const newSelectedHome = selectedTeam.position === 'home' ? targetTeamId : selectedMatch.homeTeamId
        const newSelectedAway = selectedTeam.position === 'away' ? targetTeamId : selectedMatch.awayTeamId
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

    setSelectedTeam(null)
  }

  // 選択解除
  const clearSelection = () => {
    setSelectedTeam(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">読み込み中...</span>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg mb-4">
          決勝トーナメントが生成されていません
        </div>
        <p className="text-gray-500 text-sm">
          予選リーグ終了後、「決勝T自動生成」ボタンで組み合わせを生成してください
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 選択状態表示 */}
      {selectedTeam && (
        <div className="flex items-center justify-center gap-2 bg-primary-50 p-2 rounded-lg">
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
      )}

      {/* 組み合わせ更新ボタン */}
      {bothSemifinalsCompleted && onUpdateBracket && (
        <div className="flex justify-center">
          <button
            onClick={onUpdateBracket}
            className="btn-primary flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            組み合わせを更新（準決勝結果を反映）
          </button>
        </div>
      )}

      {/* トーナメントブラケット */}
      <div className="relative">
        {/* デスクトップレイアウト */}
        <div className="hidden lg:grid lg:grid-cols-5 lg:gap-6 lg:items-center">
          {/* 準決勝列 */}
          <div className="space-y-8 col-span-1">
            <MatchCard
              match={semifinal1}
              title="準決勝1"
              onClick={() => handleMatchClick(semifinal1)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
            />
            <MatchCard
              match={semifinal2}
              title="準決勝2"
              onClick={() => handleMatchClick(semifinal2)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
            />
          </div>

          {/* 接続線（準決勝→決勝） */}
          <div className="col-span-1 flex flex-col items-center justify-center h-full">
            <div className="w-full border-t-2 border-gray-300"></div>
            <div className="h-24 border-r-2 border-gray-300"></div>
            <div className="w-full border-t-2 border-gray-300"></div>
          </div>

          {/* 決勝・3位決定戦列 */}
          <div className="col-span-2 space-y-4">
            <MatchCard
              match={final}
              title="決勝"
              onClick={() => handleMatchClick(final)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
              className="border-yellow-400 border-2"
            />
            <MatchCard
              match={thirdPlace}
              title="3位決定戦"
              onClick={() => handleMatchClick(thirdPlace)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
            />
          </div>

          {/* 優勝チーム表示 */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            {final?.status === 'completed' && final.result && (
              <div className="text-center">
                <div className="text-yellow-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-gray-900">優勝</div>
                <div className="text-xl font-bold text-primary-600 mt-1">
                  {final.result === 'home_win'
                    ? final.homeTeam?.name
                    : final.awayTeam?.name}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* モバイルレイアウト */}
        <div className="lg:hidden space-y-4">
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-center text-sm font-medium text-yellow-800 mb-3">
              決勝
            </div>
            <MatchCard
              match={final}
              title="決勝"
              onClick={() => handleMatchClick(final)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
              className="border-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MatchCard
              match={semifinal1}
              title="準決勝1"
              onClick={() => handleMatchClick(semifinal1)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
            />
            <MatchCard
              match={semifinal2}
              title="準決勝2"
              onClick={() => handleMatchClick(semifinal2)}
              onSwapTeams={onSwapTeams}
              selectable={!!onSwapTeams}
              selectedTeam={selectedTeam}
              onTeamClick={handleTeamClick}
            />
          </div>

          <MatchCard
            match={thirdPlace}
            title="3位決定戦"
            onClick={() => handleMatchClick(thirdPlace)}
            onSwapTeams={onSwapTeams}
            selectable={!!onSwapTeams}
            selectedTeam={selectedTeam}
            onTeamClick={handleTeamClick}
          />
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-600 mt-6 pt-6 border-t">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-100 rounded"></span>
          <span>終了</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow-100 rounded"></span>
          <span>試合中</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-gray-100 rounded"></span>
          <span>予定</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-600">◎</span>
          <span>勝者</span>
        </div>
        {onSwapTeams && (
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary-500" />
            <span>クリックで選択・入れ替え</span>
          </div>
        )}
      </div>
    </div>
  )
}
