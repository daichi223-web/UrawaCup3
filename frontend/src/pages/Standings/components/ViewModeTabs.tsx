// src/pages/Standings/components/ViewModeTabs.tsx
import { Grid3X3, Trophy } from 'lucide-react'
import type { ViewMode } from '../types'

interface ViewModeTabsProps {
  viewMode: ViewMode
  isOverallRanking: boolean
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewModeTabs({ viewMode, isOverallRanking, onViewModeChange }: ViewModeTabsProps) {
  return (
    <div className="flex gap-2 no-print">
      <button
        onClick={() => onViewModeChange('star')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          viewMode === 'star'
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Grid3X3 className="w-4 h-4" />
        成績表
      </button>
      <button
        onClick={() => onViewModeChange('overall')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          viewMode === 'overall'
            ? 'bg-amber-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        } ${isOverallRanking ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
      >
        <Trophy className="w-4 h-4" />
        総合順位
        {isOverallRanking && <span className="text-xs bg-amber-600 px-1.5 py-0.5 rounded">採用中</span>}
      </button>
    </div>
  )
}

export default ViewModeTabs
