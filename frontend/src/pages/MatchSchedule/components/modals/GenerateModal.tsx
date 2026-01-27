// src/pages/MatchSchedule/components/modals/GenerateModal.tsx
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
  onGenerate: () => void
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
  const title =
    generateType === 'preliminary' ? '予選リーグ日程生成' :
    generateType === 'finals' ? '最終日生成' :
    '研修試合生成'

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
              決勝トーナメントの日程を生成します。
              <br />
              <span className="text-sm text-gray-500">
                ※ 各グループ1位チームによる準決勝・3位決定戦・決勝を生成します。
              </span>
            </>
          )}
          {generateType === 'training' && (
            <>
              研修試合の日程を生成します。
              <br />
              <span className="text-sm text-gray-500">
                ※ 各グループの2〜6位チームによる研修試合を生成します。
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
            onClick={onGenerate}
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
