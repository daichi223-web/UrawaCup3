/**
 * チーム配置画面（VenueAssignmentPage）
 *
 * 新方式（グループなし）の大会で使用するチーム配置画面
 * - Day1/Day2 タブ切り替え
 * - 自動配置ボタン（地域分散ロジック使用）
 * - 会場カードにチームリスト表示
 * - クリック選択でチームを会場間移動（ペア単位）
 * - 未配置チームの表示エリア
 * - 保存ボタン
 */
import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Wand2, Save, ArrowLeftRight, Users, MapPin, AlertCircle, Check, X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import {
  useVenueAssignments,
  useAutoGenerateVenueAssignments,
  useCreateVenueAssignment,
  useUpdateVenueAssignment,
  useDeleteVenueAssignment,
} from '@/features/venue-assignments/hooks'
import { useTeams } from '@/features/teams/hooks'
import { useVenuesByTournament } from '@/features/venues/hooks'
import { useTournament } from '@/features/tournaments/hooks'
import type { VenueAssignment } from '@/features/venue-assignments/types'
import type { Team } from '@/features/teams/types'
import type { Venue } from '@/features/venues/types'

// タブの定義
type DayTab = 1 | 2

interface TabInfo {
  day: DayTab
  label: string
  description: string
}

const TABS: TabInfo[] = [
  { day: 1, label: 'Day1', description: '予選1日目の会場配置' },
  { day: 2, label: 'Day2', description: '予選2日目の会場配置' },
]

/**
 * チームスロットコンポーネント
 * クリックで選択状態を切り替え
 */
interface TeamSlotProps {
  team: Team
  isSelected: boolean
  isSwapTarget: boolean
  onClick: () => void
  disabled?: boolean
  slotOrder: number
}

function TeamSlot({ team, isSelected, isSwapTarget, onClick, disabled, slotOrder }: TeamSlotProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 p-2 rounded border-2 w-full text-left transition-all
        ${isSelected
          ? 'border-primary-500 bg-primary-100 ring-2 ring-primary-300'
          : isSwapTarget
            ? 'border-green-400 bg-green-50 hover:bg-green-100'
            : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
      <span className="text-xs text-gray-400 w-4">{slotOrder}</span>
      <span className="font-medium flex-1 truncate text-sm">
        {team.shortName || team.name}
      </span>
      {team.region && (
        <span className="text-xs text-gray-400 truncate max-w-[60px]">
          {team.region}
        </span>
      )}
    </button>
  )
}

/**
 * 未配置チームスロット
 */
interface UnassignedTeamSlotProps {
  team: Team
  isSelected: boolean
  onClick: () => void
}

function UnassignedTeamSlot({ team, isSelected, onClick }: UnassignedTeamSlotProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 p-2 rounded border-2 w-full text-left transition-all
        ${isSelected
          ? 'border-primary-500 bg-primary-100 ring-2 ring-primary-300'
          : 'border-gray-300 bg-gray-50 hover:border-primary-300 hover:bg-gray-100'
        }
      `}
    >
      {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
      <span className="font-medium flex-1 truncate text-sm">
        {team.shortName || team.name}
      </span>
      {team.region && (
        <span className="text-xs text-gray-400 truncate max-w-[60px]">
          {team.region}
        </span>
      )}
    </button>
  )
}

/**
 * 会場カードコンポーネント
 */
interface VenueCardProps {
  venue: Venue
  assignments: VenueAssignment[]
  teams: Team[]
  selectedTeam: SelectedTeam | null
  onTeamClick: (team: Team, venueId: number, slotOrder: number) => void
  teamsPerVenue: number
}

function VenueCard({
  venue,
  assignments,
  teams,
  selectedTeam,
  onTeamClick,
  teamsPerVenue,
}: VenueCardProps) {
  // 配置済みチームを取得
  const assignedTeams = useMemo(() => {
    return assignments
      .sort((a, b) => a.slotOrder - b.slotOrder)
      .map(a => ({
        assignment: a,
        team: teams.find(t => t.id === a.teamId),
      }))
      .filter(item => item.team !== undefined) as { assignment: VenueAssignment; team: Team }[]
  }, [assignments, teams])

  // 空スロット数
  const emptySlots = teamsPerVenue - assignedTeams.length

  // 同一地域のチームがいるかチェック
  const hasSameRegion = useMemo(() => {
    const regions = assignedTeams
      .map(item => item.team.region)
      .filter((r): r is string => r !== null && r !== undefined)
    return new Set(regions).size < regions.length
  }, [assignedTeams])

  return (
    <Card className={`${hasSameRegion ? 'border-yellow-400' : ''}`}>
      <CardHeader
        title={venue.shortName || venue.name}
        description={`${assignedTeams.length}/${teamsPerVenue} チーム配置済み`}
        action={
          hasSameRegion && (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              同地域重複
            </span>
          )
        }
      />
      <CardBody className="space-y-2">
        {assignedTeams.map(({ assignment, team }) => (
          <TeamSlot
            key={assignment.id}
            team={team}
            slotOrder={assignment.slotOrder}
            isSelected={
              selectedTeam?.teamId === team.id &&
              selectedTeam?.venueId === venue.id
            }
            isSwapTarget={
              selectedTeam !== null &&
              selectedTeam.teamId !== team.id
            }
            onClick={() => onTeamClick(team, venue.id, assignment.slotOrder)}
          />
        ))}
        {/* 空スロット表示 */}
        {Array.from({ length: emptySlots }).map((_, idx) => (
          <div
            key={`empty-${idx}`}
            className={`
              flex items-center justify-center p-2 rounded border-2 border-dashed
              ${selectedTeam && !selectedTeam.venueId
                ? 'border-green-300 bg-green-50 cursor-pointer hover:bg-green-100'
                : 'border-gray-200 bg-gray-50'
              }
            `}
            onClick={() => {
              if (selectedTeam && !selectedTeam.venueId) {
                // 未配置チームを配置
                onTeamClick({ id: 0 } as Team, venue.id, assignedTeams.length + idx + 1)
              }
            }}
          >
            <span className="text-xs text-gray-400">
              {selectedTeam && !selectedTeam.venueId ? 'クリックして配置' : '空きスロット'}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/**
 * 選択中のチーム情報
 */
interface SelectedTeam {
  teamId: number
  teamName: string
  venueId: number | null  // null = 未配置
  slotOrder: number | null
}

/**
 * チーム配置ページメインコンポーネント
 */
function VenueAssignment() {
  const queryClient = useQueryClient()
  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id || 1

  // 状態管理
  const [activeDay, setActiveDay] = useState<DayTab>(1)
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null)
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<number, { venueId: number; slotOrder: number }>>(new Map())

  // データ取得
  const { data: tournament, isLoading: isLoadingTournament } = useTournament(tournamentId)
  const { data: teamsData, isLoading: isLoadingTeams } = useTeams(tournamentId)
  const { data: venuesData, isLoading: isLoadingVenues } = useVenuesByTournament(tournamentId)
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useVenueAssignments(tournamentId, activeDay)

  // チーム・会場・配置データを正規化
  const teams = useMemo(() => teamsData || [], [teamsData])
  const venues = useMemo(() => {
    // 予選用会場のみフィルタリング
    return (venuesData || []).filter(v => v.forPreliminary || v.for_preliminary)
  }, [venuesData])
  const assignments = useMemo(() => assignmentsData || [], [assignmentsData])

  // 1会場あたりのチーム数を計算
  const teamsPerVenue = useMemo(() => {
    if (venues.length === 0 || teams.length === 0) return 4
    return Math.ceil(teams.length / venues.length)
  }, [venues.length, teams.length])

  // 未配置チームを抽出
  const unassignedTeams = useMemo(() => {
    const assignedTeamIds = new Set(assignments.map(a => a.teamId))
    return teams.filter(t => !assignedTeamIds.has(t.id))
  }, [teams, assignments])

  // 会場ごとの配置をマッピング
  const assignmentsByVenue = useMemo(() => {
    const map = new Map<number, VenueAssignment[]>()
    venues.forEach(v => map.set(v.id, []))
    assignments.forEach(a => {
      const list = map.get(a.venueId)
      if (list) list.push(a)
    })
    return map
  }, [venues, assignments])

  // Mutations
  const autoGenerateMutation = useAutoGenerateVenueAssignments()
  const createMutation = useCreateVenueAssignment()
  const updateMutation = useUpdateVenueAssignment()
  const deleteMutation = useDeleteVenueAssignment()

  // 選択解除
  const clearSelection = useCallback(() => {
    setSelectedTeam(null)
  }, [])

  // チームクリック処理
  const handleTeamClick = useCallback((team: Team, venueId: number, slotOrder: number) => {
    // 選択中のチームがない場合 → 選択
    if (!selectedTeam) {
      setSelectedTeam({
        teamId: team.id,
        teamName: team.shortName || team.name,
        venueId,
        slotOrder,
      })
      return
    }

    // 同じチームをクリック → 選択解除
    if (selectedTeam.teamId === team.id && selectedTeam.venueId === venueId) {
      clearSelection()
      return
    }

    // 別のチームをクリック → 入れ替え実行
    handleSwapTeams(selectedTeam, { teamId: team.id, teamName: team.shortName || team.name, venueId, slotOrder })
  }, [selectedTeam, clearSelection])

  // 未配置チームクリック処理
  const handleUnassignedTeamClick = useCallback((team: Team) => {
    // 選択中のチームがない場合 → 選択
    if (!selectedTeam) {
      setSelectedTeam({
        teamId: team.id,
        teamName: team.shortName || team.name,
        venueId: null,
        slotOrder: null,
      })
      return
    }

    // 同じ未配置チームをクリック → 選択解除
    if (selectedTeam.teamId === team.id && selectedTeam.venueId === null) {
      clearSelection()
      return
    }

    // 配置済みチームと未配置チームの入れ替え
    if (selectedTeam.venueId !== null) {
      handleSwapWithUnassigned(selectedTeam, team)
    }
  }, [selectedTeam, clearSelection])

  // 空スロットクリック処理
  const handleEmptySlotClick = useCallback((venueId: number, slotOrder: number) => {
    if (!selectedTeam || selectedTeam.venueId !== null) return

    // 未配置チームを配置
    createMutation.mutate({
      tournamentId,
      venueId,
      teamId: selectedTeam.teamId,
      matchDay: activeDay,
      slotOrder,
    }, {
      onSuccess: () => {
        toast.success(`${selectedTeam.teamName}を配置しました`)
        clearSelection()
        queryClient.invalidateQueries({ queryKey: ['venue-assignments'] })
      },
      onError: (error) => {
        toast.error(`配置に失敗しました: ${error.message}`)
      },
    })
  }, [selectedTeam, tournamentId, activeDay, createMutation, queryClient, clearSelection])

  // チーム入れ替え処理
  const handleSwapTeams = useCallback(async (
    source: SelectedTeam,
    target: { teamId: number; teamName: string; venueId: number; slotOrder: number }
  ) => {
    // 同じ会場内での入れ替え
    if (source.venueId === target.venueId) {
      toast('同じ会場内での入れ替えは不要です', { icon: 'ℹ️' })
      clearSelection()
      return
    }

    // 異なる会場間での入れ替え
    const sourceAssignment = assignments.find(a => a.teamId === source.teamId)
    const targetAssignment = assignments.find(a => a.teamId === target.teamId)

    if (!sourceAssignment || !targetAssignment) {
      toast.error('配置情報が見つかりません')
      clearSelection()
      return
    }

    try {
      // 両方のvenueIdを入れ替え
      await updateMutation.mutateAsync({
        id: sourceAssignment.id,
        venueId: target.venueId,
        slotOrder: target.slotOrder,
      })
      await updateMutation.mutateAsync({
        id: targetAssignment.id,
        venueId: source.venueId!,
        slotOrder: source.slotOrder!,
      })

      toast.success(`${source.teamName} と ${target.teamName} を入れ替えました`)
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['venue-assignments'] })
    } catch (error: any) {
      toast.error(`入れ替えに失敗しました: ${error.message}`)
    }
  }, [assignments, updateMutation, queryClient, clearSelection])

  // 配置済みと未配置の入れ替え
  const handleSwapWithUnassigned = useCallback(async (
    assigned: SelectedTeam,
    unassigned: Team
  ) => {
    const assignedAssignment = assignments.find(a => a.teamId === assigned.teamId)
    if (!assignedAssignment) {
      toast.error('配置情報が見つかりません')
      clearSelection()
      return
    }

    try {
      // 配置済みチームの配置を未配置チームに移す
      await updateMutation.mutateAsync({
        id: assignedAssignment.id,
        teamId: unassigned.id,
      })

      toast.success(`${assigned.teamName} と ${unassigned.shortName || unassigned.name} を入れ替えました`)
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['venue-assignments'] })
    } catch (error: any) {
      toast.error(`入れ替えに失敗しました: ${error.message}`)
    }
  }, [assignments, updateMutation, queryClient, clearSelection])

  // 自動配置実行
  const handleAutoGenerate = useCallback(() => {
    autoGenerateMutation.mutate({
      tournamentId,
      matchDay: activeDay,
      strategy: 'balanced',
    }, {
      onSuccess: (result) => {
        toast.success(`${result.created}件の配置を生成しました`)
        setShowAutoGenerateModal(false)
        queryClient.invalidateQueries({ queryKey: ['venue-assignments'] })
      },
      onError: (error) => {
        toast.error(`自動配置に失敗しました: ${error.message}`)
      },
    })
  }, [tournamentId, activeDay, autoGenerateMutation, queryClient])

  // ローディング中
  if (isLoadingTournament || isLoadingTeams || isLoadingVenues || isLoadingAssignments) {
    return <LoadingSpinner />
  }

  // 大会情報がない場合
  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>大会情報が見つかりません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チーム配置</h1>
          <p className="text-gray-600 mt-1">
            各会場にチームを配置します（Day1/Day2）
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            leftIcon={<Wand2 className="w-4 h-4" />}
            onClick={() => setShowAutoGenerateModal(true)}
            disabled={autoGenerateMutation.isPending}
          >
            自動配置
          </Button>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{teams.length}</div>
              <div className="text-sm text-gray-500">チーム数</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{venues.length}</div>
              <div className="text-sm text-gray-500">会場数</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Check className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{assignments.length}</div>
              <div className="text-sm text-gray-500">配置済み</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <X className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{unassignedTeams.length}</div>
              <div className="text-sm text-gray-500">未配置</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Day切替タブ + 選択状態表示 */}
      <Card noPadding>
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.day}
                onClick={() => {
                  setActiveDay(tab.day)
                  clearSelection()
                }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeDay === tab.day
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 操作ガイド */}
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {TABS.find(t => t.day === activeDay)?.description}
          </div>
          {selectedTeam ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary-600 font-medium flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                「{selectedTeam.teamName}」を選択中
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                選択解除
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              チームをクリックして選択 → 入れ替え先をクリック
            </div>
          )}
        </div>

        {/* 会場グリッド */}
        <div className="p-4">
          {venues.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>予選用会場が登録されていません</p>
              <p className="text-sm mt-2">設定画面から会場を追加してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {venues.map(venue => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  assignments={assignmentsByVenue.get(venue.id) || []}
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamClick={handleTeamClick}
                  teamsPerVenue={teamsPerVenue}
                />
              ))}
            </div>
          )}
        </div>

        {/* 未配置チーム */}
        {unassignedTeams.length > 0 && (
          <div className="p-4 border-t bg-yellow-50">
            <h3 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              未配置チーム ({unassignedTeams.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {unassignedTeams.map(team => (
                <UnassignedTeamSlot
                  key={team.id}
                  team={team}
                  isSelected={
                    selectedTeam?.teamId === team.id &&
                    selectedTeam?.venueId === null
                  }
                  onClick={() => handleUnassignedTeamClick(team)}
                />
              ))}
            </div>
            <p className="text-xs text-yellow-600 mt-3">
              未配置チームを選択後、会場の空きスロットをクリックして配置できます
            </p>
          </div>
        )}
      </Card>

      {/* 使い方ガイド */}
      <Card className="bg-blue-50 border-blue-200">
        <CardBody>
          <h3 className="font-semibold text-blue-800 mb-2">使い方</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. 「自動配置」ボタンで地域分散を考慮した自動配置ができます</li>
            <li>2. チームをクリックして選択し、入れ替え先のチームをクリックすると入れ替えられます</li>
            <li>3. 未配置チームを選択後、空きスロットをクリックすると配置できます</li>
            <li>4. 同一地域のチームが同じ会場にいる場合、黄色の警告が表示されます</li>
          </ul>
        </CardBody>
      </Card>

      {/* 自動配置確認モーダル */}
      <Modal
        isOpen={showAutoGenerateModal}
        onClose={() => setShowAutoGenerateModal(false)}
        title={`Day${activeDay} 自動配置`}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            チームを会場に自動配置します。
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>注意:</strong> 既存の配置は上書きされます。
            </p>
          </div>
          <div className="space-y-2 text-sm text-gray-500">
            <p>配置ロジック:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>同一地域のチームが同じ会場に集中しないように配置</li>
              <li>各会場に均等にチームを配置</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAutoGenerateModal(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleAutoGenerate}
              isLoading={autoGenerateMutation.isPending}
            >
              自動配置を実行
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default VenueAssignment
