// src/pages/MatchSchedule/components/GenerateButtons.tsx
import { Link } from 'react-router-dom'
import type { TabKey } from '../types'

interface GenerateButtonsProps {
  activeTab: TabKey
  hasPreliminaryMatches: boolean
  hasFinalsMatches: boolean
  hasTrainingMatches: boolean
  isGenerating: boolean
  isDeleting: boolean
  onGeneratePreliminary: () => void
  onGenerateFinals: () => void
  onGenerateTraining: () => void
  onDeletePreliminary: () => void
  onDeleteFinals: () => void
  onDeleteTraining: () => void
  onImportMatches?: () => void
}

export function GenerateButtons({
  activeTab,
  hasPreliminaryMatches,
  hasFinalsMatches,
  hasTrainingMatches,
  isGenerating,
  isDeleting,
  onGeneratePreliminary,
  onGenerateFinals,
  onGenerateTraining,
  onDeletePreliminary,
  onDeleteFinals,
  onDeleteTraining,
  onImportMatches,
}: GenerateButtonsProps) {
  const buttons = []

  if (activeTab === 'day1' || activeTab === 'day2') {
    buttons.push(
      <button
        key="preliminary-generate"
        className="btn-primary"
        onClick={onGeneratePreliminary}
        disabled={isGenerating || isDeleting}
      >
        予選リーグ日程を生成
      </button>
    )
    if (onImportMatches) {
      buttons.push(
        <button
          key="preliminary-import"
          className="btn-secondary"
          onClick={onImportMatches}
          disabled={isGenerating || isDeleting}
        >
          CSVインポート
        </button>
      )
    }
    if (hasPreliminaryMatches) {
      buttons.push(
        <button
          key="preliminary-delete"
          className="btn-danger"
          onClick={onDeletePreliminary}
          disabled={isGenerating || isDeleting}
        >
          予選リーグ日程を削除
        </button>
      )
    }
  } else if (activeTab === 'day3') {
    buttons.push(
      <button
        key="finalday-generate"
        className="btn-primary"
        onClick={onGenerateFinals}
        disabled={isGenerating || isDeleting || !hasPreliminaryMatches}
        title={!hasPreliminaryMatches ? '予選リーグを先に生成してください' : ''}
      >
        最終日生成
      </button>
    )
    if (!hasTrainingMatches) {
      buttons.push(
        <button
          key="training-generate"
          className="btn-primary bg-purple-600 hover:bg-purple-700"
          onClick={onGenerateTraining}
          disabled={isGenerating || isDeleting || !hasPreliminaryMatches}
          title={!hasPreliminaryMatches ? '予選リーグを先に生成してください' : ''}
        >
          研修試合を生成
        </button>
      )
    }
    if (hasFinalsMatches || hasTrainingMatches) {
      buttons.push(
        <button
          key="finalday-delete"
          className="btn-danger"
          onClick={onDeleteFinals}
          disabled={isGenerating || isDeleting}
        >
          最終日削除
        </button>
      )
    }
    if (hasTrainingMatches) {
      buttons.push(
        <button
          key="training-delete"
          className="btn-danger bg-red-400 hover:bg-red-500"
          onClick={onDeleteTraining}
          disabled={isGenerating || isDeleting}
        >
          研修試合削除
        </button>
      )
      buttons.push(
        <Link
          key="training-editor"
          to="/training-editor"
          className="btn-secondary bg-purple-600 text-white hover:bg-purple-700"
        >
          研修試合編集
        </Link>
      )
    }
  }

  return <>{buttons}</>
}

export default GenerateButtons
