// src/pages/MatchSchedule/components/modals/MatchImportModal.tsx
import { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImport: (csv: string) => void
  isImporting: boolean
  teamNames: string[]
  venueNames: string[]
}

export function MatchImportModal({
  isOpen,
  onClose,
  onImport,
  isImporting,
  teamNames,
  venueNames,
}: Props) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileRead = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsv(text.replace(/^\ufeff/, ''))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const lines = csv ? csv.trim().split('\n') : []
  const dataLines = lines.length > 1 ? lines.slice(1) : []

  // プレビュー用にパース
  const previewRows = dataLines.slice(0, 8).map(line => {
    const cols = line.split(',').map(c => c.trim())
    return {
      date: cols[0] || '',
      time: cols[1] || '',
      venue: cols[2] || '',
      home: cols[3] || '',
      away: cols[4] || '',
      group: cols[5] || '',
      bMatch: (cols[6] || '').trim().toUpperCase(),
    }
  })

  const handleClose = () => {
    setCsv('')
    setFileName('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="組み合わせ表インポート">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-bold mb-1">CSV形式（ヘッダー行必須）</p>
          <p className="font-mono text-xs">日付,時間,会場名,ホーム,アウェイ,グループ,B戦</p>
          <p className="mt-1 text-xs">例:</p>
          <p className="font-mono text-xs text-blue-600">2026-08-01,09:30,浦和南高G,浦和南,市立浦和,A,</p>
          <p className="font-mono text-xs text-blue-600">2026-08-01,12:00,浦和南高G,浦和学院,武南,A,B</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium">詳細仕様</summary>
            <ul className="mt-1 text-xs space-y-0.5 list-disc list-inside">
              <li>日付: YYYY-MM-DD 形式</li>
              <li>時間: HH:mm 形式（秒は省略可）</li>
              <li>会場名: 登録済みの会場名（部分一致可）</li>
              <li>ホーム/アウェイ: チーム名または略称（部分一致可）</li>
              <li>グループ: A, B, C, D 等（省略可 - チームのグループを自動使用）</li>
              <li>B戦: 「B」と記入でB戦（順位計算対象外）。省略で通常試合</li>
            </ul>
          </details>
        </div>

        {/* ファイル選択 */}
        <div>
          <label className="block text-sm font-medium mb-1">CSVファイル</label>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => fileRef.current?.click()}
            >
              ファイル選択
            </button>
            <span className="text-sm text-gray-500 self-center">
              {fileName || '未選択'}
              {dataLines.length > 0 && ` (${dataLines.length}試合)`}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileRead(file)
            }}
          />
        </div>

        {/* テキスト直接入力 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            または直接貼り付け
          </label>
          <textarea
            className="form-input w-full font-mono text-xs"
            rows={5}
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setFileName('') }}
            placeholder={'日付,時間,会場名,ホーム,アウェイ,グループ\n2026-08-01,09:30,浦和南高G,浦和南,市立浦和,A'}
          />
        </div>

        {/* プレビュー */}
        {previewRows.length > 0 && (
          <div className="bg-gray-50 rounded p-3 text-xs overflow-auto">
            <p className="font-bold mb-2">プレビュー（先頭{Math.min(previewRows.length, 8)}件）</p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="pb-1 pr-2">日付</th>
                  <th className="pb-1 pr-2">時間</th>
                  <th className="pb-1 pr-2">会場</th>
                  <th className="pb-1 pr-2">ホーム</th>
                  <th className="pb-1 pr-2">アウェイ</th>
                  <th className="pb-1 pr-2">G</th>
                  <th className="pb-1">B戦</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => {
                  const venueOk = venueNames.some(v => v.includes(row.venue) || row.venue.includes(v))
                  const homeOk = teamNames.some(t => t.includes(row.home) || row.home.includes(t))
                  const awayOk = teamNames.some(t => t.includes(row.away) || row.away.includes(t))
                  return (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-0.5 pr-2">{row.date}</td>
                      <td className="py-0.5 pr-2">{row.time}</td>
                      <td className={`py-0.5 pr-2 ${venueOk ? '' : 'text-red-600 font-bold'}`}>
                        {row.venue}{!venueOk && ' ?'}
                      </td>
                      <td className={`py-0.5 pr-2 ${homeOk ? '' : 'text-red-600 font-bold'}`}>
                        {row.home}{!homeOk && ' ?'}
                      </td>
                      <td className={`py-0.5 pr-2 ${awayOk ? '' : 'text-red-600 font-bold'}`}>
                        {row.away}{!awayOk && ' ?'}
                      </td>
                      <td className="py-0.5 pr-2">{row.group}</td>
                      <td className={`py-0.5 ${row.bMatch === 'B' ? 'text-orange-600 font-bold' : ''}`}>
                        {row.bMatch === 'B' ? 'B' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {dataLines.length > 8 && (
              <p className="text-gray-400 mt-1">...他{dataLines.length - 8}試合</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={handleClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={() => onImport(csv)}
            disabled={dataLines.length === 0 || isImporting}
          >
            {isImporting ? 'インポート中...' : `${dataLines.length}試合をインポート`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
