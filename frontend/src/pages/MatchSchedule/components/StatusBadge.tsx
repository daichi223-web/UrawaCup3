// src/pages/MatchSchedule/components/StatusBadge.tsx
import type { MatchStatus } from '../types'

const STYLES: Record<MatchStatus, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
}

const LABELS: Record<MatchStatus, string> = {
  scheduled: '予定',
  in_progress: '試合中',
  completed: '終了',
  cancelled: '中止',
}

interface StatusBadgeProps {
  status: MatchStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}

export default StatusBadge
