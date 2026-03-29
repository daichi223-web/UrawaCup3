// src/pages/Standings/index.tsx
/**
 * 成績表・総合順位表画面
 * グループ別の対戦結果マトリックス表示と総合順位表（リアルタイム更新対応）
 */
import { AlertCircle, Trophy } from 'lucide-react'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { PRINT_STYLES } from './constants'
import { useStandings } from './useStandings'
import {
  StandingsHeader,
  ViewModeTabs,
  GroupStandingsView,
  SingleLeagueStandingsView,
  OverallRankingTable,
  RankingRules,
} from './components'

function Standings() {
  const {
    viewMode, setViewMode,
    recentlyUpdated,
    tournamentId,
    groupStandings,
    matchesData,
    teamsData,
    overallStandings,
    displayOverallEntries,
    overallRankingsMap,
    useGroupSystem,
    isOverallRanking,
    isConnected,
    isLoading,
    isLoadingOverall,
    isFetching,
    isError,
    error,
    lastUpdated,
    handlePrint,
    handleRefresh,
    handleExcelDownload,
    isExporting,
    isPdfExporting,
    handleStarTablePdf,
    isStarPdfExporting,
    refetch,
  } = useStandings()

  if (!tournamentId || isLoading) return <LoadingSpinner />

  if (isError) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">成績表の取得に失敗しました</p>
        <p className="text-gray-500 text-sm mt-2">{(error as Error)?.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          再試行
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div className="space-y-6 print-content">
        {/* ヘッダー */}
        <StandingsHeader
          viewMode={viewMode}
          useGroupSystem={useGroupSystem}
          isConnected={isConnected}
          lastUpdated={lastUpdated}
          isFetching={isFetching}
          isLoadingOverall={isLoadingOverall}
          isLoading={isLoading}
          recentlyUpdated={recentlyUpdated}
          onPrint={handlePrint}
          onRefresh={handleRefresh}
          onExcelDownload={handleExcelDownload}
          onStarTablePdf={handleStarTablePdf}
          isPdfExporting={isPdfExporting}
          isStarPdfExporting={isStarPdfExporting}
          isExporting={isExporting}
        />

        {/* 表示切り替えタブ */}
        <ViewModeTabs
          viewMode={viewMode}
          isOverallRanking={isOverallRanking}
          onViewModeChange={setViewMode}
        />

        {/* 暫定順位の注意書き */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 no-print">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">暫定{viewMode === 'star' ? '成績表' : '順位表'}</p>
            <p className="text-amber-700">
              試合結果が入力されるとリアルタイムで更新されます。
            </p>
          </div>
        </div>

        {viewMode === 'star' ? (
          // 成績表表示
          <>
            {useGroupSystem ? (
              <GroupStandingsView
                groupStandings={groupStandings}
                teamsData={teamsData}
                matchesData={matchesData}
                overallRankingsMap={overallRankingsMap}
                recentlyUpdated={recentlyUpdated}
              />
            ) : (
              <SingleLeagueStandingsView
                teamsData={teamsData}
                matchesData={matchesData}
                overallRankingsMap={overallRankingsMap}
                recentlyUpdated={recentlyUpdated}
              />
            )}
            <RankingRules
              useGroupSystem={useGroupSystem}
              isOverallRanking={isOverallRanking}
            />
          </>
        ) : (
          // 総合順位表表示
          <div className="card">
            <div className="card-header bg-amber-500 text-white">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                総合順位表
              </h3>
            </div>
            <div className="card-body p-0">
              <OverallRankingTable
                entries={displayOverallEntries}
                qualifyingCount={overallStandings?.qualifyingCount || 4}
                useGroupSystem={useGroupSystem}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default Standings
