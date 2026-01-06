/**
 * 対戦除外設定画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useTournamentId } from '../hooks/useTournament'

interface ExclusionPair {
  id: number
  team1_id: number
  team1_name: string
  team2_id: number
  team2_name: string
  group_id: string
  reason: string | null
}

interface Team {
  id: number
  name: string
  group_id: string
}

export function ExclusionSettings() {
  const tournamentId = useTournamentId()
  const queryClient = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [team1, setTeam1] = useState<number | null>(null)
  const [team2, setTeam2] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const { data: exclusions, isLoading } = useQuery<ExclusionPair[]>({
    queryKey: ['exclusions', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/exclusion-pairs`, {
        params: { tournament_id: tournamentId }
      })
      return res.data
    },
    enabled: !!tournamentId,
  })

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams-for-exclusion', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/teams`, {
        params: { tournament_id: tournamentId }
      })
      return res.data
    },
    enabled: !!tournamentId,
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`/api/exclusion-pairs`, {
        tournament_id: tournamentId,
        group_id: selectedGroup,
        team1_id: team1,
        team2_id: team2,
        reason,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions', tournamentId] })
      setTeam1(null)
      setTeam2(null)
      setReason('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/exclusion-pairs/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions', tournamentId] })
    },
  })

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  const groupTeams = teams?.filter((t) => t.group_id === selectedGroup) ?? []

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">対戦除外設定</h2>

      {/* 追加フォーム */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">除外ペアを追加</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            {['A', 'B', 'C', 'D'].map((g) => (
              <option key={g} value={g}>グループ{g}</option>
            ))}
          </select>
          <select
            value={team1 ?? ''}
            onChange={(e) => setTeam1(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="px-3 py-2 border rounded"
          >
            <option value="">チーム1</option>
            {groupTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={team2 ?? ''}
            onChange={(e) => setTeam2(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="px-3 py-2 border rounded"
          >
            <option value="">チーム2</option>
            {groupTeams.filter((t) => t.id !== team1).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="理由（任意）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <button
            onClick={() => addMutation.mutate()}
            disabled={!team1 || !team2}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            追加
          </button>
        </div>
      </div>

      {/* 除外リスト */}
      {isLoading ? (
        <div>読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">グループ</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">チーム1</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">チーム2</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">理由</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exclusions?.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-3">{ex.group_id}</td>
                  <td className="px-4 py-3">{ex.team1_name}</td>
                  <td className="px-4 py-3">{ex.team2_name}</td>
                  <td className="px-4 py-3">{ex.reason ?? '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMutation.mutate(ex.id)}
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
      )}
    </div>
  )
}
