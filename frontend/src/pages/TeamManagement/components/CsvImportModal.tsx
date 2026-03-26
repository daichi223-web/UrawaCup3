// src/pages/TeamManagement/components/CsvImportModal.tsx
import { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImport: (teamsCsv: string, playersCsv: string | null) => void
  saving: boolean
}

export function CsvImportModal({ isOpen, onClose, onImport, saving }: Props) {
  const [teamsCsv, setTeamsCsv] = useState('')
  const [playersCsv, setPlayersCsv] = useState('')
  const [teamsFileName, setTeamsFileName] = useState('')
  const [playersFileName, setPlayersFileName] = useState('')
  const teamsFileRef = useRef<HTMLInputElement>(null)
  const playersFileRef = useRef<HTMLInputElement>(null)

  const handleFileRead = (
    file: File,
    setter: (v: string) => void,
    nameSetter: (v: string) => void
  ) => {
    nameSetter(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      // BOM除去
      setter(text.replace(/^\ufeff/, ''))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const teamsLines = teamsCsv ? teamsCsv.trim().split('\n').length - 1 : 0
  const playersLines = playersCsv ? playersCsv.trim().split('\n').length - 1 : 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CSV一括インポート">
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-bold mb-1">CSV形式</p>
          <p>チーム: チーム名,略称,種別(local/invited),都道府県,監督</p>
          <p>選手: チーム略称,背番号,ポジション,氏名,前所属,身長,学年</p>
        </div>

        {/* チームCSV */}
        <div>
          <label className="block text-sm font-medium mb-1">
            チームCSV <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => teamsFileRef.current?.click()}
            >
              ファイル選択
            </button>
            <span className="text-sm text-gray-500 self-center">
              {teamsFileName || '未選択'}
              {teamsLines > 0 && ` (${teamsLines}チーム)`}
            </span>
          </div>
          <input
            ref={teamsFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileRead(file, setTeamsCsv, setTeamsFileName)
            }}
          />
        </div>

        {/* 選手CSV */}
        <div>
          <label className="block text-sm font-medium mb-1">
            選手CSV <span className="text-gray-400 text-xs">（任意）</span>
          </label>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => playersFileRef.current?.click()}
            >
              ファイル選択
            </button>
            <span className="text-sm text-gray-500 self-center">
              {playersFileName || '未選択'}
              {playersLines > 0 && ` (${playersLines}選手)`}
            </span>
          </div>
          <input
            ref={playersFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileRead(file, setPlayersCsv, setPlayersFileName)
            }}
          />
        </div>

        {/* プレビュー */}
        {teamsLines > 0 && (
          <div className="bg-gray-50 rounded p-3 text-xs max-h-40 overflow-auto">
            <p className="font-bold mb-1">プレビュー（先頭5件）</p>
            {teamsCsv.trim().split('\n').slice(1, 6).map((line, i) => {
              const cols = line.split(',')
              return (
                <p key={i} className="text-gray-700">
                  {cols[1] || cols[0]} ({cols[2] === 'local' ? '地元' : '招待'}) - {cols[3]}
                </p>
              )
            })}
            {teamsLines > 5 && <p className="text-gray-400">...他{teamsLines - 5}チーム</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={() => onImport(teamsCsv, playersCsv || null)}
            disabled={!teamsCsv || saving}
          >
            {saving ? 'インポート中...' : `インポート実行`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
