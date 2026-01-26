// src/pages/MatchSchedule/components/MatchScheduleTabs.tsx
import { TABS } from '../constants'
import type { TabKey, MatchWithDetails } from '../types'

interface MatchScheduleTabsProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  allMatches: MatchWithDetails[]
  getDateString: (dayOffset: number) => string
}

export function MatchScheduleTabs({
  activeTab,
  onTabChange,
  allMatches,
  getDateString,
}: MatchScheduleTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex -mb-px overflow-x-auto">
        {TABS.map((tab) => {
          const dateStr = getDateString(tab.dayOffset)
          const matchCount = allMatches.filter(m => m.matchDate === dateStr).length

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div>{tab.label}</div>
              <div className="text-xs text-gray-400">{dateStr}</div>
              {matchCount > 0 && (
                <span className="ml-2 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                  {matchCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default MatchScheduleTabs
