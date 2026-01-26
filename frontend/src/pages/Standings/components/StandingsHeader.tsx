// src/pages/Standings/components/StandingsHeader.tsx
import { RefreshCw, Clock, Printer, WifiOff } from 'lucide-react'
import type { ViewMode } from '../types'

interface StandingsHeaderProps {
  viewMode: ViewMode
  useGroupSystem: boolean
  isConnected: boolean
  lastUpdated: string | null
  isFetching: boolean
  isLoadingOverall: boolean
  isLoading: boolean
  recentlyUpdated: boolean
  onPrint: () => void
  onRefresh: () => void
}

export function StandingsHeader({
  viewMode,
  useGroupSystem,
  isConnected,
  lastUpdated,
  isFetching,
  isLoadingOverall,
  isLoading,
  recentlyUpdated,
  onPrint,
  onRefresh,
}: StandingsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewMode === 'star' ? '成績表' : '総合順位表'}
          </h1>
          <p className="text-gray-600 mt-1">
            {viewMode === 'star'
              ? (useGroupSystem ? '各グループの対戦結果を確認できます' : '全チームの対戦結果を確認できます')
              : (useGroupSystem ? '全グループを通じた総合順位を確認できます' : '全チームの総合順位を確認できます')}
          </p>
        </div>
        {/* LIVE インジケーター */}
        <div className={`no-print flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              LIVE
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              オフライン
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 no-print">
        {lastUpdated && (
          <span className={`text-sm flex items-center gap-1.5 transition-colors ${
            recentlyUpdated ? 'text-green-600 font-medium' : 'text-gray-500'
          }`}>
            <Clock className="w-4 h-4" />
            最終更新: {lastUpdated}
            {(isFetching || isLoadingOverall) && !isLoading && (
              <span className="ml-2 text-primary-600">更新中...</span>
            )}
          </span>
        )}
        <button
          onClick={onPrint}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" />
          PDF印刷
        </button>
        <button
          onClick={onRefresh}
          disabled={isFetching || isLoadingOverall}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${(isFetching || isLoadingOverall) ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>
    </div>
  )
}

export default StandingsHeader
