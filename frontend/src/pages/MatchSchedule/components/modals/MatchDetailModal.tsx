// src/pages/MatchSchedule/components/modals/MatchDetailModal.tsx
import { Modal } from '@/components/ui/Modal'
import type { MatchWithDetails } from '../../types'

interface MatchDetailModalProps {
  match: MatchWithDetails | null
  onClose: () => void
  getVenueName: (venueId: number) => string
  onEdit: () => void
  onGoToResults: () => void
}

export function MatchDetailModal({
  match,
  onClose,
  getVenueName,
  onEdit,
  onGoToResults,
}: MatchDetailModalProps) {
  if (!match) return null

  return (
    <Modal isOpen={!!match} onClose={onClose} title="試合詳細">
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-2">
            {match.matchDate} {match.matchTime?.substring(0, 5)} @ {getVenueName(match.venueId)}
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="font-bold text-lg">{match.homeTeam?.name}</div>
            </div>
            <div className="text-3xl font-bold">
              {match.homeScoreTotal ?? '-'} - {match.awayScoreTotal ?? '-'}
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{match.awayTeam?.name}</div>
            </div>
          </div>
          {match.hasPenaltyShootout && (
            <div className="text-sm text-gray-500 mt-2">
              PK: {match.homePK} - {match.awayPK}
            </div>
          )}
        </div>

        {(match.homeScoreHalf1 !== null || match.awayScoreHalf1 !== null) && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm text-center">
              <div>
                <div className="text-gray-500">前半</div>
                <div className="font-medium">
                  {match.homeScoreHalf1 ?? '-'} - {match.awayScoreHalf1 ?? '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">後半</div>
                <div className="font-medium">
                  {match.homeScoreHalf2 ?? '-'} - {match.awayScoreHalf2 ?? '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            閉じる
          </button>
          <button className="btn-secondary" onClick={onEdit}>
            日程編集
          </button>
          <button className="btn-primary" onClick={onGoToResults}>
            結果入力
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default MatchDetailModal
