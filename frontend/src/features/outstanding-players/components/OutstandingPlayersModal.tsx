/**
 * 優秀選手登録モーダル
 * 最優秀選手1名、優秀選手11名を登録
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Trophy, Medal, Plus, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { outstandingPlayersApi } from '../api'
import { teamsApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { OutstandingPlayer, OutstandingPlayerCreate, Team, Player } from '@shared/types'

interface OutstandingPlayersModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: number
}

interface PlayerEntry {
  id?: number
  teamId?: number
  teamName: string
  playerId?: number
  playerName: string
  playerNumber?: number
  awardType: 'mvp' | 'outstanding'
}

export function OutstandingPlayersModal({
  isOpen,
  onClose,
  tournamentId,
}: OutstandingPlayersModalProps) {
  const queryClient = useQueryClient()

  // MVP
  const [mvp, setMvp] = useState<PlayerEntry | null>(null)

  // 優秀選手（11名）
  const [outstandingPlayers, setOutstandingPlayers] = useState<PlayerEntry[]>([])

  // 選手検索
  const [searchTeamId, setSearchTeamId] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<Player[]>([])

  // 現在の登録データを取得
  const { data: existingPlayers, isLoading } = useQuery({
    queryKey: ['outstanding-players', tournamentId],
    queryFn: () => outstandingPlayersApi.getAll(tournamentId),
    enabled: isOpen,
  })

  // チーム一覧を取得
  const { data: teams } = useQuery({
    queryKey: ['teams', tournamentId],
    queryFn: () => teamsApi.getAll(tournamentId),
    enabled: isOpen,
  })

  // 既存データをフォームに反映
  useEffect(() => {
    if (existingPlayers) {
      const mvpEntry = existingPlayers.find(p => p.awardType === 'mvp')
      if (mvpEntry) {
        setMvp({
          id: mvpEntry.id,
          teamId: mvpEntry.teamId,
          teamName: mvpEntry.teamName || mvpEntry.team?.name || '',
          playerId: mvpEntry.playerId,
          playerName: mvpEntry.playerName,
          playerNumber: mvpEntry.playerNumber,
          awardType: 'mvp',
        })
      } else {
        setMvp(null)
      }

      const outstanding = existingPlayers
        .filter(p => p.awardType === 'outstanding')
        .map(p => ({
          id: p.id,
          teamId: p.teamId,
          teamName: p.teamName || p.team?.name || '',
          playerId: p.playerId,
          playerName: p.playerName,
          playerNumber: p.playerNumber,
          awardType: 'outstanding' as const,
        }))
      setOutstandingPlayers(outstanding)
    }
  }, [existingPlayers])

  // チーム選択時に選手を検索
  const handleSearchTeam = async (teamId: number) => {
    setSearchTeamId(teamId)
    if (!teamId) {
      setSearchResults([])
      return
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('number')

    if (error) {
      console.error('Failed to fetch players:', error)
      return
    }

    setSearchResults(data || [])
  }

  // 選手を追加（MVP or 優秀選手）
  const handleAddPlayer = (player: Player, team: Team, asMvp: boolean) => {
    const entry: PlayerEntry = {
      teamId: team.id,
      teamName: team.shortName || team.name,
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      awardType: asMvp ? 'mvp' : 'outstanding',
    }

    if (asMvp) {
      setMvp(entry)
    } else {
      if (outstandingPlayers.length >= 11) {
        toast.error('優秀選手は11名までです')
        return
      }
      // 重複チェック
      if (outstandingPlayers.some(p => p.playerId === player.id)) {
        toast.error('既に登録されています')
        return
      }
      setOutstandingPlayers([...outstandingPlayers, entry])
    }
  }

  // 手動入力で選手を追加
  const [manualEntry, setManualEntry] = useState({
    teamName: '',
    playerName: '',
    playerNumber: '',
  })

  const handleAddManualPlayer = (asMvp: boolean) => {
    if (!manualEntry.playerName.trim()) {
      toast.error('選手名を入力してください')
      return
    }

    const entry: PlayerEntry = {
      teamName: manualEntry.teamName,
      playerName: manualEntry.playerName,
      playerNumber: manualEntry.playerNumber ? parseInt(manualEntry.playerNumber) : undefined,
      awardType: asMvp ? 'mvp' : 'outstanding',
    }

    if (asMvp) {
      setMvp(entry)
    } else {
      if (outstandingPlayers.length >= 11) {
        toast.error('優秀選手は11名までです')
        return
      }
      setOutstandingPlayers([...outstandingPlayers, entry])
    }

    setManualEntry({ teamName: '', playerName: '', playerNumber: '' })
  }

  // 選手を削除
  const handleRemovePlayer = (index: number) => {
    setOutstandingPlayers(outstandingPlayers.filter((_, i) => i !== index))
  }

  // 保存
  const saveMutation = useMutation({
    mutationFn: async () => {
      const players: OutstandingPlayerCreate[] = []

      if (mvp) {
        players.push({
          tournamentId,
          teamId: mvp.teamId,
          playerId: mvp.playerId,
          teamName: mvp.teamName,
          playerName: mvp.playerName,
          playerNumber: mvp.playerNumber,
          awardType: 'mvp',
          displayOrder: 0,
        })
      }

      outstandingPlayers.forEach((p, index) => {
        players.push({
          tournamentId,
          teamId: p.teamId,
          playerId: p.playerId,
          teamName: p.teamName,
          playerName: p.playerName,
          playerNumber: p.playerNumber,
          awardType: 'outstanding',
          displayOrder: index + 1,
        })
      })

      return outstandingPlayersApi.replaceAll(tournamentId, players)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-players', tournamentId] })
      toast.success('優秀選手を保存しました')
      onClose()
    },
    onError: (error: Error) => {
      toast.error(`保存に失敗しました: ${error.message}`)
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  const selectedTeam = teams?.find(t => t.id === searchTeamId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="優秀選手登録"
      size="xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* 最優秀選手 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <h3 className="font-bold text-yellow-800">最優秀選手（MVP）</h3>
                <span className="text-sm text-yellow-600">1名</span>
              </div>

              {mvp ? (
                <div className="flex items-center justify-between bg-white rounded p-3 border border-yellow-300">
                  <div>
                    <span className="font-medium">{mvp.playerName}</span>
                    {mvp.playerNumber && (
                      <span className="text-gray-500 ml-1">#{mvp.playerNumber}</span>
                    )}
                    <span className="text-gray-500 ml-2">({mvp.teamName})</span>
                  </div>
                  <button
                    onClick={() => setMvp(null)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">未登録</div>
              )}
            </div>

            {/* 優秀選手 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Medal className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-blue-800">優秀選手</h3>
                <span className="text-sm text-blue-600">{outstandingPlayers.length}/11名</span>
              </div>

              {outstandingPlayers.length > 0 ? (
                <div className="space-y-2">
                  {outstandingPlayers.map((player, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white rounded p-2 border border-blue-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                        <span className="font-medium">{player.playerName}</span>
                        {player.playerNumber && (
                          <span className="text-gray-500 text-sm">#{player.playerNumber}</span>
                        )}
                        <span className="text-gray-500 text-sm">({player.teamName})</span>
                      </div>
                      <button
                        onClick={() => handleRemovePlayer(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">未登録</div>
              )}
            </div>

            {/* 選手追加セクション */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">選手を追加</h4>

              {/* チームから検索 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="w-4 h-4 inline mr-1" />
                  チームから検索
                </label>
                <select
                  className="form-input w-full"
                  value={searchTeamId || ''}
                  onChange={(e) => handleSearchTeam(Number(e.target.value))}
                >
                  <option value="">チームを選択...</option>
                  {teams?.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.groupId ? `(${team.groupId}グループ)` : ''}
                    </option>
                  ))}
                </select>

                {searchResults.length > 0 && selectedTeam && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded">
                    {searchResults.map(player => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div>
                          <span className="text-gray-500 text-sm mr-2">#{player.number}</span>
                          <span>{player.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddPlayer(player, selectedTeam, true)}
                            disabled={!!mvp}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                          >
                            MVP
                          </button>
                          <button
                            onClick={() => handleAddPlayer(player, selectedTeam, false)}
                            disabled={outstandingPlayers.length >= 11}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            優秀
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 手動入力 */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手動で入力
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="チーム名"
                    className="form-input"
                    value={manualEntry.teamName}
                    onChange={(e) => setManualEntry({ ...manualEntry, teamName: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="選手名 *"
                    className="form-input"
                    value={manualEntry.playerName}
                    onChange={(e) => setManualEntry({ ...manualEntry, playerName: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="背番号"
                    className="form-input"
                    value={manualEntry.playerNumber}
                    onChange={(e) => setManualEntry({ ...manualEntry, playerNumber: e.target.value })}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAddManualPlayer(true)}
                      disabled={!!mvp || !manualEntry.playerName.trim()}
                      className="flex-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                    >
                      MVP
                    </button>
                    <button
                      onClick={() => handleAddManualPlayer(false)}
                      disabled={outstandingPlayers.length >= 11 || !manualEntry.playerName.trim()}
                      className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                    >
                      優秀
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* フッター */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <Button variant="ghost" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={saveMutation.isPending}
        >
          保存
        </Button>
      </div>
    </Modal>
  )
}

export default OutstandingPlayersModal
