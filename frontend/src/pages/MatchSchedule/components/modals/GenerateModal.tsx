// src/pages/MatchSchedule/components/modals/GenerateModal.tsx
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { GenerateType } from '../../types'

interface GenerateModalProps {
  isOpen: boolean
  onClose: () => void
  generateType: GenerateType
  useGroupSystem: boolean
  matchesPerTeamPerDay: number
  teamCount: number
  isGenerating: boolean
  onGenerate: (options?: { qualificationRule?: 'group_based' | 'overall_ranking' }) => void
}

export function GenerateModal({
  isOpen,
  onClose,
  generateType,
  useGroupSystem,
  matchesPerTeamPerDay,
  teamCount,
  isGenerating,
  onGenerate,
}: GenerateModalProps) {
  const [qualificationRule, setQualificationRule] = useState<'group_based' | 'overall_ranking'>(
    useGroupSystem ? 'group_based' : 'overall_ranking'
  )

  const title =
    generateType === 'preliminary' ? '予選リーグ日程生成' :
    generateType === 'finals' ? '最終日生成' :
    '研修試合生成'

  const handleGenerate = () => {
    if (generateType === 'finals') {
      onGenerate({ qualificationRule })
    } else {
      onGenerate()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-gray-600">
          {generateType === 'preliminary' && (
            <>
              予選リーグの日程を自動生成します。
              <br />
              <span className="text-sm text-gray-500">
                {useGroupSystem ? (
                  <>
                    ※ 各グループ6チーム × 4試合（変則総当たり）<br />
                    ※ 対角線ペア（1-6, 2-5, 3-4）は対戦しない<br />
                    ※ 連戦回避対応<br />
                    ※ 2日間で計48試合（4グループ × 12試合）
                  </>
                ) : (
                  <>
                    ※ 1リーグ制：各チーム1日{matchesPerTeamPerDay}試合<br />
                    ※ 同時刻の重複出場なし<br />
                    ※ 2日間で計{teamCount * matchesPerTeamPerDay}試合
                  </>
                )}
              </span>
            </>
          )}
          {generateType === 'finals' && (
            <>
              決勝トーナメント＋研修試合を生成します。
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">決勝進出チームの決定方法:</p>
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="qualificationRule"
                    value="group_based"
                    checked={qualificationRule === 'group_based'}
                    onChange={() => setQualificationRule('group_based')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-medium">各グループ1位</span>
                    <p className="text-xs text-gray-500">A, B, C, D... 各グループの1位チームが決勝T進出</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-green-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                  <input
                    type="radio"
                    name="qualificationRule"
                    value="overall_ranking"
                    checked={qualificationRule === 'overall_ranking'}
                    onChange={() => setQualificationRule('overall_ranking')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-medium">総合順位 上位4チーム</span>
                    <p className="text-xs text-gray-500">勝点→得失点差→得点で上位4チームが決勝T進出</p>
                  </div>
                </label>
              </div>
            </>
          )}
          {generateType === 'training' && (
            <>
              研修試合の日程を生成します。
              <br />
              <span className="text-sm text-gray-500">
                ※ 決勝進出チーム以外のチームによる研修試合を生成します。
              </span>
            </>
          )}
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '生成中...' : '生成する'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default GenerateModal
