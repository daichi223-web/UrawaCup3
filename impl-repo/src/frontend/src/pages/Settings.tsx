/**
 * 設定画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId, useTournament } from '../hooks/useTournament'

interface TournamentSettings {
  id: number
  name: string
  edition: number | null
  year: number | null
  start_date: string | null
  end_date: string | null
  match_duration: number
  half_duration: number
  interval_minutes: number
}

export function Settings() {
  const tournamentId = useTournamentId()
  const tournament = useTournament()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery<TournamentSettings>({
    queryKey: ['tournament-settings', tournamentId],
    queryFn: async () => {
      const res = await axios.get(`/api/tournaments/${tournamentId}`)
      return res.data
    },
    enabled: !!tournamentId,
  })

  const [formData, setFormData] = useState<Partial<TournamentSettings>>({})

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<TournamentSettings>) => {
      await axios.put(`/api/tournaments/${tournamentId}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-settings', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      toast.success('設定を保存しました')
    },
  })

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  if (isLoading) {
    return <div>読み込み中...</div>
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const getValue = <K extends keyof TournamentSettings>(key: K): TournamentSettings[K] | undefined => {
    return formData[key] ?? settings?.[key]
  }

  const setValue = <K extends keyof TournamentSettings>(key: K, value: TournamentSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{tournament?.name} - 設定</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 大会名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">大会名</label>
            <input
              type="text"
              value={getValue('name') ?? ''}
              onChange={(e) => setValue('name', e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 回数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">回（第N回）</label>
            <input
              type="number"
              value={getValue('edition') ?? ''}
              onChange={(e) => setValue('edition', parseInt(e.target.value, 10) || null)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 開催年 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開催年</label>
            <input
              type="number"
              value={getValue('year') ?? ''}
              onChange={(e) => setValue('year', parseInt(e.target.value, 10) || null)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 開始日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
            <input
              type="date"
              value={getValue('start_date') ?? ''}
              onChange={(e) => setValue('start_date', e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 終了日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
            <input
              type="date"
              value={getValue('end_date') ?? ''}
              onChange={(e) => setValue('end_date', e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 試合時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">試合時間（分）</label>
            <input
              type="number"
              value={getValue('match_duration') ?? 50}
              onChange={(e) => setValue('match_duration', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* 前後半時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">前後半時間（分）</label>
            <input
              type="number"
              value={getValue('half_duration') ?? 25}
              onChange={(e) => setValue('half_duration', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* インターバル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">試合間隔（分）</label>
            <input
              type="number"
              value={getValue('interval_minutes') ?? 15}
              onChange={(e) => setValue('interval_minutes', parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {updateMutation.isPending ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
