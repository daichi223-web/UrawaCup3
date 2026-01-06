/**
 * レポート出力画面
 * TASK-003: tournamentIdのコンテキスト化
 */

import { useState, useMemo } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTournamentId, useTournament } from '../hooks/useTournament'

type DateKey = 'day1' | 'day2' | 'day3'

type ReportType = 'daily' | 'standings' | 'final_bracket' | 'final_result'

export function Reports() {
  const tournamentId = useTournamentId()
  const tournament = useTournament()
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  // 大会日程から日付マッピングを動的に計算
  const dateMap = useMemo(() => {
    if (!tournament?.startDate) return { day1: '', day2: '', day3: '' }
    const start = new Date(tournament.startDate)

    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const day1 = new Date(start)
    const day2 = new Date(start)
    day2.setDate(day2.getDate() + 1)
    const day3 = new Date(start)
    day3.setDate(day3.getDate() + 2)

    return {
      day1: formatDate(day1),
      day2: formatDate(day2),
      day3: formatDate(day3)
    }
  }, [tournament])

  // 日付ラベル
  const dateLabels: Record<DateKey, string> = {
    day1: '1日目（予選リーグ）',
    day2: '2日目（予選リーグ）',
    day3: '3日目（決勝トーナメント）'
  }

  if (!tournamentId) {
    return <div className="text-gray-500">大会を選択してください</div>
  }

  const handleGenerate = async (reportType: ReportType) => {
    setIsGenerating(true)
    try {
      const params: Record<string, unknown> = {
        tournament_id: tournamentId,
        report_type: reportType,
      }
      if (reportType === 'daily' && selectedDate) {
        params.date = selectedDate
      }

      const res = await axios.get(`/api/reports/generate`, {
        params,
        responseType: 'blob',
      })

      // ダウンロード
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${reportType}_report.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Report generation failed:', error)
      toast.error('レポート生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const reports = [
    {
      type: 'daily' as ReportType,
      title: '日次報告書',
      description: '指定日の全試合結果を出力',
      requiresDate: true,
    },
    {
      type: 'standings' as ReportType,
      title: 'グループ順位表',
      description: '全グループの順位表を出力',
      requiresDate: false,
    },
    {
      type: 'final_bracket' as ReportType,
      title: '最終日組み合わせ表',
      description: '決勝トーナメントの組み合わせを出力',
      requiresDate: false,
    },
    {
      type: 'final_result' as ReportType,
      title: '最終結果報告書',
      description: '大会の最終結果を出力',
      requiresDate: false,
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{tournament?.name} - レポート出力</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div key={report.type} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-2">{report.title}</h3>
            <p className="text-gray-600 mb-4">{report.description}</p>

            {report.requiresDate && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日付を選択
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(dateMap) as DateKey[]).map((dayKey) => (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDate(dateMap[dayKey])}
                      className={`px-3 py-2 text-sm rounded border ${
                        selectedDate === dateMap[dayKey]
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      disabled={!dateMap[dayKey]}
                    >
                      <div>{dateLabels[dayKey]}</div>
                      <div className="text-xs opacity-75">{dateMap[dayKey]}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleGenerate(report.type)}
              disabled={isGenerating || (report.requiresDate && !selectedDate)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {isGenerating ? '生成中...' : 'PDF出力'}
            </button>
          </div>
        ))}
      </div>

      {/* Excel出力 */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-2">Excel出力</h3>
        <p className="text-gray-600 mb-4">全データをExcel形式で出力</p>
        <button
          onClick={() => {
            // Excel出力ロジック
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Excelダウンロード
        </button>
      </div>
    </div>
  )
}
