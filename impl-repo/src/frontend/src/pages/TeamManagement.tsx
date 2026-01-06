/**
 * チーム管理画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId } from '../hooks/useTournament'

/**
 * エラーメッセージを取得するヘルパー関数
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message
    }
    if (error.response?.data?.detail) {
      return error.response.data.detail
    }
    if (!error.response) {
      return 'サーバーに接続できません'
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

interface Team {
  id: number
  name: string
  short_name: string
  group_id: string | null
  prefecture: string | null
  team_type: 'local' | 'invited'
  is_host: boolean
}

export function TeamManagement() {
  const tournamentId = useTournamentId()
  const queryClient = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<number | null>(null)

  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ['teams', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/teams`, {
        params: { tournament_id: tournamentId }
      })
      return res.data
    },
    enabled: !!tournamentId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (teamId: number) => {
      await axios.delete(`/api/teams/${teamId}`)
    },
    onSuccess: () => {
      toast.success('チームを削除しました')
      queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] })
      setDeleteConfirmOpen(false)
      setTeamToDelete(null)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'エラーが発生しました')
      toast.error(`チームの削除に失敗しました: ${message}`)
    },
  })

  const confirmDelete = (teamId: number) => {
    setTeamToDelete(teamId)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = () => {
    if (teamToDelete !== null) {
      deleteMutation.mutate(teamToDelete)
    }
  }

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  const groups = ['A', 'B', 'C', 'D']
  const filteredTeams = selectedGroup === 'all'
    ? teams
    : teams?.filter((t) => t.group_id === selectedGroup)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">チーム管理</h2>
        <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          チーム追加
        </button>
      </div>

      {/* グループフィルター */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedGroup('all')}
          className={`px-3 py-1 rounded ${selectedGroup === 'all' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
        >
          全て
        </button>
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-3 py-1 rounded ${selectedGroup === g ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
          >
            グループ{g}
          </button>
        ))}
      </div>

      {/* チームテーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">グループ</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">チーム名</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">略称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">都道府県</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">種別</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTeams?.map((team) => (
              <tr key={team.id}>
                <td className="px-4 py-3">{team.group_id ?? '-'}</td>
                <td className="px-4 py-3 font-medium">
                  {team.name}
                  {team.is_host && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">主催</span>}
                </td>
                <td className="px-4 py-3">{team.short_name}</td>
                <td className="px-4 py-3">{team.prefecture ?? '-'}</td>
                <td className="px-4 py-3">{team.team_type === 'local' ? '地元' : '招待'}</td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 hover:underline mr-2">編集</button>
                  <button
                    onClick={() => confirmDelete(team.id)}
                    className="text-red-600 hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 削除確認モーダル */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">チーム削除の確認</h3>
            <p className="text-gray-600 mb-6">
              このチームを削除してもよろしいですか？この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setTeamToDelete(null)
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
