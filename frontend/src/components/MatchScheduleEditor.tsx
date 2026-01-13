/**
 * 組み合わせ編集コンポーネント
 *
 * 機能:
 * - グループ別に日程ごとの対戦カードを一覧表示
 * - チームをドロップダウンで変更可能
 * - 審判担当チームをドロップダウンで変更可能
 * - リアルタイム制約チェック
 * - エラー時は保存不可、警告時は保存可能
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { MatchWithDetails } from '@/types'
import {
  validateMatches,
  getViolationSummary,
  getViolationsForMatch,
  type ConstraintViolation,
  type MatchForValidation,
  type TeamInfo,
  type ConstraintCheckSettings,
} from '@/lib/matchConstraints'
import { useConstraintSettingsStore } from '@/stores/constraintSettingsStore'

// チーム情報
interface Team {
  id: number
  name: string
  shortName?: string
  groupId?: string
}

// 編集中の試合データ
interface EditableMatch {
  id: number
  matchDate: string
  matchTime: string
  slot: number
  homeTeamId: number
  awayTeamId: number
  groupId: string
  refereeTeamIds: number[]
  originalHomeTeamId: number
  originalAwayTeamId: number
  originalRefereeTeamIds: number[]
  isModified: boolean
}

interface MatchScheduleEditorProps {
  matches: MatchWithDetails[]  // 編集対象日の試合
  allGroupMatches?: MatchWithDetails[]  // 全日程の試合（バリデーション用）
  teams: Team[]
  groupId: string
  day: 1 | 2  // 1日目 or 2日目
  onSave: (changes: { matchId: number; homeTeamId: number; awayTeamId: number; refereeTeamIds?: number[] }[]) => Promise<void>
  disabled?: boolean
}

/**
 * 制約違反バッジ
 */
function ViolationBadge({ violation }: { violation: ConstraintViolation }) {
  const styles = {
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  }
  const icons = {
    error: <AlertCircle className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
    info: <Info className="w-3 h-3" />,
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${styles[violation.level]}`}
      title={violation.description}
    >
      {icons[violation.level]}
      {violation.label}
    </span>
  )
}

/**
 * 試合行コンポーネント
 */
function MatchRow({
  match,
  groupTeams,
  violations,
  onHomeTeamChange,
  onAwayTeamChange,
  onRefereeChange,
  disabled,
}: {
  match: EditableMatch
  groupTeams: Team[]
  violations: ConstraintViolation[]
  onHomeTeamChange: (matchId: number, teamId: number) => void
  onAwayTeamChange: (matchId: number, teamId: number) => void
  onRefereeChange: (matchId: number, teamIds: number[]) => void
  disabled?: boolean
}) {
  const hasError = violations.some(v => v.level === 'error')
  const hasWarning = violations.some(v => v.level === 'warning')

  // 試合に参加していないチーム（審判候補）
  const availableReferees = groupTeams.filter(
    t => t.id !== match.homeTeamId && t.id !== match.awayTeamId
  )

  return (
    <tr
      className={`
        ${hasError ? 'bg-red-50' : hasWarning ? 'bg-yellow-50' : match.isModified ? 'bg-blue-50' : ''}
        hover:bg-gray-50 transition-colors
      `}
    >
      {/* 時間枠 */}
      <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-medium">枠{match.slot}</span>
          <span className="text-gray-400">{match.matchTime}</span>
        </div>
      </td>

      {/* ホームチーム */}
      <td className="px-3 py-2">
        <select
          value={match.homeTeamId}
          onChange={(e) => onHomeTeamChange(match.id, Number(e.target.value))}
          disabled={disabled}
          className={`
            w-full px-2 py-1.5 text-sm border rounded
            ${match.homeTeamId !== match.originalHomeTeamId ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
          `}
        >
          {groupTeams.map(team => (
            <option key={team.id} value={team.id}>
              {team.shortName || team.name}
            </option>
          ))}
        </select>
      </td>

      {/* vs */}
      <td className="px-2 py-2 text-center text-gray-400 font-bold text-sm">
        vs
      </td>

      {/* アウェイチーム */}
      <td className="px-3 py-2">
        <select
          value={match.awayTeamId}
          onChange={(e) => onAwayTeamChange(match.id, Number(e.target.value))}
          disabled={disabled}
          className={`
            w-full px-2 py-1.5 text-sm border rounded
            ${match.awayTeamId !== match.originalAwayTeamId ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
          `}
        >
          {groupTeams.map(team => (
            <option key={team.id} value={team.id}>
              {team.shortName || team.name}
            </option>
          ))}
        </select>
      </td>

      {/* 審判チーム */}
      <td className="px-3 py-2">
        <select
          multiple
          value={match.refereeTeamIds.map(String)}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map(o => Number(o.value))
            onRefereeChange(match.id, selected)
          }}
          disabled={disabled}
          className={`
            w-full px-2 py-1 text-xs border rounded h-16
            ${JSON.stringify(match.refereeTeamIds.sort()) !== JSON.stringify(match.originalRefereeTeamIds.sort())
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
          `}
        >
          {availableReferees.map(team => (
            <option key={team.id} value={team.id}>
              {team.shortName || team.name}
            </option>
          ))}
        </select>
      </td>

      {/* 違反表示 */}
      <td className="px-3 py-2">
        {violations.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {violations.map((v, i) => (
              <ViolationBadge key={i} violation={v} />
            ))}
          </div>
        ) : match.isModified ? (
          <span className="text-xs text-blue-600">変更あり</span>
        ) : (
          <span className="text-xs text-gray-400">OK</span>
        )}
      </td>
    </tr>
  )
}

/**
 * 違反サマリーパネル
 */
function ViolationSummary({
  violations,
  teams,
}: {
  violations: ConstraintViolation[]
  teams: Team[]
}) {
  const [expanded, setExpanded] = useState(true)
  const summary = getViolationSummary(violations)

  const getTeamName = (teamId: number) => {
    const team = teams.find(t => t.id === teamId)
    return team?.shortName || team?.name || `チーム${teamId}`
  }

  if (violations.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700">
          <Check className="w-5 h-5" />
          <span className="font-medium">制約違反なし</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full px-4 py-3 flex items-center justify-between
          ${summary.hasErrors ? 'bg-red-100' : 'bg-yellow-100'}
        `}
      >
        <div className="flex items-center gap-4">
          {summary.hasErrors ? (
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">エラー: {summary.errors.length}件</span>
            </div>
          ) : null}
          {summary.warnings.length > 0 && (
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">警告: {summary.warnings.length}件</span>
            </div>
          )}
          {summary.infos.length > 0 && (
            <div className="flex items-center gap-2 text-blue-700">
              <Info className="w-5 h-5" />
              <span className="font-medium">情報: {summary.infos.length}件</span>
            </div>
          )}
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* 詳細 */}
      {expanded && (
        <div className="p-4 bg-white space-y-3 max-h-60 overflow-y-auto">
          {/* エラー */}
          {summary.errors.map((v, i) => (
            <div key={`error-${i}`} className="flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-red-700">{v.label}</span>
                <span className="text-gray-600 ml-2">{v.description}</span>
                {v.teamIds && v.teamIds.length > 0 && (
                  <span className="text-gray-500 ml-2">
                    ({v.teamIds.map(getTeamName).join(', ')})
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* 警告 */}
          {summary.warnings.map((v, i) => (
            <div key={`warning-${i}`} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-yellow-700">{v.label}</span>
                <span className="text-gray-600 ml-2">{v.description}</span>
                {v.teamIds && v.teamIds.length > 0 && (
                  <span className="text-gray-500 ml-2">
                    ({v.teamIds.map(getTeamName).join(', ')})
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* 情報 */}
          {summary.infos.map((v, i) => (
            <div key={`info-${i}`} className="flex items-start gap-2 text-sm">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-blue-700">{v.label}</span>
                <span className="text-gray-600 ml-2">{v.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 組み合わせ編集メインコンポーネント
 */
export default function MatchScheduleEditor({
  matches,
  allGroupMatches,
  teams,
  groupId,
  day,
  onSave,
  disabled = false,
}: MatchScheduleEditorProps) {
  // 制約設定を取得
  const { settings: constraintSettings } = useConstraintSettingsStore()

  // グループのチーム
  const groupTeams = useMemo(
    () => teams.filter(t => t.groupId === groupId),
    [teams, groupId]
  )

  // 時間からスロット番号を計算
  const getSlotFromTime = (matchTime: string): number => {
    const [h, m] = matchTime.split(':').map(Number)
    const matchMinutes = h * 60 + m
    const startMinutes = 9 * 60  // 09:00
    const slotDuration = 25  // 15分試合 + 10分間隔
    return Math.floor((matchMinutes - startMinutes) / slotDuration) + 1
  }

  // 編集状態を初期化
  const initializeEditableMatches = useCallback((): EditableMatch[] => {
    return matches
      .filter(m => m.groupId === groupId)
      .sort((a, b) => {
        // 時間順にソート
        const timeA = a.matchTime || '00:00'
        const timeB = b.matchTime || '00:00'
        return timeA.localeCompare(timeB)
      })
      .map((m, index) => ({
        id: m.id,
        matchDate: m.matchDate,
        matchTime: m.matchTime,
        slot: getSlotFromTime(m.matchTime) || (index + 1),  // 時間からスロット計算
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        groupId: groupId,
        refereeTeamIds: (m as any).refereeTeamIds || [],
        originalHomeTeamId: m.homeTeamId!,
        originalAwayTeamId: m.awayTeamId!,
        originalRefereeTeamIds: (m as any).refereeTeamIds || [],
        isModified: false,
      }))
  }, [matches, groupId])

  const [editableMatches, setEditableMatches] = useState<EditableMatch[]>(initializeEditableMatches)
  const [isSaving, setIsSaving] = useState(false)
  // エラー表示は保存ボタンを押した時のみ表示
  const [validationTriggered, setValidationTriggered] = useState(false)

  // matches が変更されたら編集状態をリセット
  useEffect(() => {
    setEditableMatches(initializeEditableMatches())
    setValidationTriggered(false) // 日程変更時はバリデーション表示をリセット
  }, [initializeEditableMatches])

  // 制約チェック
  const violations = useMemo(() => {
    // 編集中の試合
    const editedMatchesForValidation: MatchForValidation[] = editableMatches.map(m => ({
      id: m.id,
      matchDate: m.matchDate,
      matchTime: m.matchTime,
      slot: m.slot,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      groupId: m.groupId,
      refereeTeamIds: m.refereeTeamIds,
    }))

    // 他の日の試合も含めてバリデーション（同一カード重複チェック用）
    const otherDayMatches: MatchForValidation[] = (allGroupMatches || [])
      .filter(m => m.groupId === groupId && !editableMatches.some(em => em.id === m.id))
      .map(m => ({
        id: m.id,
        matchDate: m.matchDate,
        matchTime: m.matchTime,
        slot: getSlotFromTime(m.matchTime) || 1,
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        groupId: groupId,
        refereeTeamIds: (m as any).refereeTeamIds || [],
      }))

    const allMatchesForValidation = [...editedMatchesForValidation, ...otherDayMatches]

    const teamInfos: TeamInfo[] = groupTeams.map(t => ({
      id: t.id,
      name: t.name,
      groupId: t.groupId || groupId,
      teamType: (t as any).teamType,
      region: (t as any).region,
      leagueId: (t as any).leagueId,
    }))

    console.log('[Validation] Matches:', allMatchesForValidation.length, 'Teams:', teamInfos.length)

    // 設定を ConstraintCheckSettings 形式に変換
    const checkSettings: ConstraintCheckSettings = {
      avoidLocalVsLocal: constraintSettings.avoidLocalVsLocal,
      avoidSameRegion: constraintSettings.avoidSameRegion,
      avoidSameLeague: constraintSettings.avoidSameLeague,
      avoidConsecutive: constraintSettings.avoidConsecutive,
      warnDailyGameLimit: constraintSettings.warnDailyGameLimit,
      warnTotalGameLimit: constraintSettings.warnTotalGameLimit,
    }

    return validateMatches(allMatchesForValidation, teamInfos, undefined, checkSettings)
  }, [editableMatches, allGroupMatches, groupTeams, groupId, constraintSettings])

  const summary = getViolationSummary(violations)

  // 変更があるか
  const hasChanges = editableMatches.some(m => m.isModified)

  // ホームチーム変更
  const handleHomeTeamChange = (matchId: number, teamId: number) => {
    setEditableMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m
        const isModified =
          teamId !== m.originalHomeTeamId ||
          m.awayTeamId !== m.originalAwayTeamId ||
          JSON.stringify(m.refereeTeamIds.sort()) !== JSON.stringify(m.originalRefereeTeamIds.sort())
        return { ...m, homeTeamId: teamId, isModified }
      })
    )
  }

  // アウェイチーム変更
  const handleAwayTeamChange = (matchId: number, teamId: number) => {
    setEditableMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m
        const isModified =
          m.homeTeamId !== m.originalHomeTeamId ||
          teamId !== m.originalAwayTeamId ||
          JSON.stringify(m.refereeTeamIds.sort()) !== JSON.stringify(m.originalRefereeTeamIds.sort())
        return { ...m, awayTeamId: teamId, isModified }
      })
    )
  }

  // 審判チーム変更
  const handleRefereeChange = (matchId: number, teamIds: number[]) => {
    setEditableMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m
        const isModified =
          m.homeTeamId !== m.originalHomeTeamId ||
          m.awayTeamId !== m.originalAwayTeamId ||
          JSON.stringify(teamIds.sort()) !== JSON.stringify(m.originalRefereeTeamIds.sort())
        return { ...m, refereeTeamIds: teamIds, isModified }
      })
    )
  }

  // リセット
  const handleReset = () => {
    setEditableMatches(initializeEditableMatches())
    setValidationTriggered(false) // バリデーション表示もリセット
  }

  // 保存
  const handleSave = async () => {
    // 保存ボタン押下時にバリデーション結果を表示
    setValidationTriggered(true)

    if (!summary.canSave || isSaving) return

    const changes = editableMatches
      .filter(m => m.isModified)
      .map(m => ({
        matchId: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        refereeTeamIds: m.refereeTeamIds,
      }))

    if (changes.length === 0) return

    setIsSaving(true)
    try {
      await onSave(changes)
      // 保存成功後、現在の状態を「オリジナル」として更新
      setEditableMatches(prev =>
        prev.map(m => ({
          ...m,
          originalHomeTeamId: m.homeTeamId,
          originalAwayTeamId: m.awayTeamId,
          originalRefereeTeamIds: [...m.refereeTeamIds],
          isModified: false,
        }))
      )
    } catch (error) {
      console.error('保存エラー:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          グループ{groupId} - Day{day}
        </h3>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              disabled={isSaving || disabled}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              リセット
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!summary.canSave || !hasChanges || isSaving || disabled}
            className={`
              btn-primary text-sm flex items-center gap-1
              ${!summary.canSave ? 'bg-gray-400 cursor-not-allowed' : ''}
            `}
            title={!summary.canSave ? 'エラーを解消してください' : ''}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 制約違反サマリー（保存ボタン押下後のみ表示） */}
      {validationTriggered && (
        <ViolationSummary violations={violations} teams={teams} />
      )}

      {/* 試合一覧テーブル */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">時間枠</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ホーム</th>
              <th className="px-2 py-2"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">アウェイ</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">審判</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {editableMatches.map(match => (
              <MatchRow
                key={match.id}
                match={match}
                groupTeams={groupTeams}
                violations={validationTriggered ? getViolationsForMatch(match.id, violations) : []}
                onHomeTeamChange={handleHomeTeamChange}
                onAwayTeamChange={handleAwayTeamChange}
                onRefereeChange={handleRefereeChange}
                disabled={disabled}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 保存ボタン（エラー時は無効）- バリデーション実行後のみ表示 */}
      {validationTriggered && !summary.canSave && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <X className="w-5 h-5" />
          <span>エラーがあるため保存できません。上記のエラーを解消してください。</span>
        </div>
      )}
    </div>
  )
}
