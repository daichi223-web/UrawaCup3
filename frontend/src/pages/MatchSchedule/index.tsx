// src/pages/MatchSchedule/index.tsx
/**
 * 日程管理画面
 * 予選リーグ・決勝トーナメントの日程管理
 * Supabase版
 */
import { Edit3, Eye } from 'lucide-react'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { TABS } from './constants'
import { useMatchSchedule } from './useMatchSchedule'
import {
  MatchScheduleTabs,
  GenerateButtons,
  ConstraintBadges,
  FinalsView,
  EditModeView,
  PreliminaryViewMode,
  VenueMatchList,
  GenerateModal,
  DeleteModal,
  MatchDetailModal,
  EditMatchModal,
  MatchImportModal,
} from './components'

function MatchSchedule() {
  const {
    // State
    activeTab, setActiveTab,
    selectedMatch, setSelectedMatch,
    showGenerateModal, setShowGenerateModal,
    generateType,
    showDeleteModal, setShowDeleteModal,
    deleteType, setDeleteType,
    editingMatch, setEditingMatch,
    editForm, setEditForm,
    isEditMode, setIsEditMode,
    crossVenueSelectedTeam, setCrossVenueSelectedTeam,
    showImportModal, setShowImportModal,

    // Data
    tournament, venues, allTeams, allMatches,
    filteredMatches, day1Matches, day2Matches,
    finalsMatches,
    useGroupSystem,

    // Computed
    consecutiveMatchTeams,
    localVsLocalMatches, sameRegionMatches, sameLeagueMatches, day1RepeatPairs,
    hasPreliminaryMatches, hasFinalsMatches, hasTrainingMatches,

    // Status
    isLoading, isGenerating, isDeleting, isImporting,
    isUpdatingMatch, isUpdatingBracket, isBulkUpdating,

    // Handlers
    handleSwapTeams, handleEditorSave, handleUpdateBracket,
    startEditing, saveEdit,
    openGenerateModal, openDeleteModal,
    handleDelete, handleGenerate,
    handleImportMatches,
    getVenueName, getDateString,
  } = useMatchSchedule()

  if (isLoading) {
    return <LoadingSpinner />
  }

  const currentTabInfo = TABS.find(t => t.key === activeTab)
  const isDay3WithContent = activeTab === 'day3' && (finalsMatches.length > 0 || hasTrainingMatches)
  const isPreliminaryTab = activeTab === 'day1' || activeTab === 'day2'

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日程管理</h1>
          <p className="text-gray-600 mt-1">試合日程の生成・編集を行います</p>
        </div>
      </div>

      {/* 日付選択タブ */}
      <div className="card">
        <MatchScheduleTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allMatches={allMatches}
          getDateString={getDateString}
        />

        {/* 生成ボタンエリア */}
        <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600 mr-2">
            {currentTabInfo?.description}
          </span>
          <GenerateButtons
            activeTab={activeTab}
            hasPreliminaryMatches={hasPreliminaryMatches}
            hasFinalsMatches={hasFinalsMatches}
            hasTrainingMatches={hasTrainingMatches}
            isGenerating={isGenerating}
            isDeleting={isDeleting}
            onGeneratePreliminary={() => openGenerateModal('preliminary')}
            onGenerateFinals={() => openGenerateModal('finals')}
            onGenerateTraining={() => openGenerateModal('training')}
            onDeletePreliminary={() => openDeleteModal('preliminary')}
            onDeleteFinals={() => openDeleteModal('finals')}
            onDeleteTraining={() => openDeleteModal('training')}
            onImportMatches={() => setShowImportModal(true)}
          />

          {/* 編集モードトグル */}
          {isPreliminaryTab && hasPreliminaryMatches && useGroupSystem && (
            <>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors
                  ${isEditMode
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {isEditMode ? (
                  <>
                    <Eye className="w-4 h-4" />
                    閲覧モード
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    編集モード
                  </>
                )}
              </button>
              <ConstraintBadges
                consecutiveMatchTeams={consecutiveMatchTeams}
                localVsLocalMatches={localVsLocalMatches}
                sameRegionMatches={sameRegionMatches}
                sameLeagueMatches={sameLeagueMatches}
                day1RepeatPairs={day1RepeatPairs}
              />
            </>
          )}

          {/* 試合数サマリー */}
          <div className="ml-auto text-sm text-gray-500">
            全{allMatches.length}試合 /
            予選: {allMatches.filter(m => m.stage === 'preliminary').length} /
            決勝T: {finalsMatches.length} /
            研修: {allMatches.filter(m => m.stage === 'training').length}
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="p-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">この日の試合はありません</p>
              <p className="text-sm">
                {isPreliminaryTab
                  ? (hasPreliminaryMatches
                      ? '他の日に予選リーグの試合が登録されています'
                      : '上の「予選リーグ日程を生成」ボタンから日程を作成してください')
                  : '予選リーグが終了後、決勝トーナメントと研修試合を生成できます'}
              </p>
            </div>
          ) : isDay3WithContent ? (
            <FinalsView
              finalsMatches={finalsMatches}
              allMatches={allMatches}
              venues={venues}
              allTeams={allTeams}
              hasTrainingMatches={hasTrainingMatches}
              isUpdatingBracket={isUpdatingBracket}
              onSwapTeams={handleSwapTeams}
              onUpdateBracket={handleUpdateBracket}
            />
          ) : isEditMode && isPreliminaryTab ? (
            <EditModeView
              useGroupSystem={useGroupSystem}
              venues={venues}
              allTeams={allTeams}
              allMatches={allMatches}
              day1Matches={day1Matches}
              day2Matches={day2Matches}
              consecutiveMatchTeams={consecutiveMatchTeams}
              getDateString={getDateString}
              onEditorSave={handleEditorSave}
              isBulkUpdating={isBulkUpdating}
            />
          ) : isPreliminaryTab && hasPreliminaryMatches ? (
            <PreliminaryViewMode
              activeTab={activeTab}
              useGroupSystem={useGroupSystem}
              venues={venues}
              allTeams={allTeams}
              day1Matches={day1Matches}
              day2Matches={day2Matches}
              consecutiveMatchTeams={consecutiveMatchTeams}
              crossVenueSelectedTeam={crossVenueSelectedTeam}
              onCrossVenueSelect={setCrossVenueSelectedTeam}
              onSwapTeams={handleSwapTeams}
            />
          ) : (
            <VenueMatchList
              filteredMatches={filteredMatches}
              venues={venues}
              allTeams={allTeams}
              useGroupSystem={useGroupSystem}
              consecutiveMatchTeams={consecutiveMatchTeams}
              onSwapTeams={handleSwapTeams}
            />
          )}
        </div>
      </div>

      {/* モーダル */}
      <GenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        generateType={generateType}
        useGroupSystem={useGroupSystem}
        matchesPerTeamPerDay={(tournament as { matchesPerTeamPerDay?: number } | undefined)?.matchesPerTeamPerDay || 2}
        teamCount={allTeams.length}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteType(null) }}
        deleteType={deleteType}
        isDeleting={isDeleting}
        onDelete={handleDelete}
      />

      <MatchDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        getVenueName={getVenueName}
        onEdit={() => {
          if (selectedMatch) {
            startEditing(selectedMatch)
            setSelectedMatch(null)
          }
        }}
        onGoToResults={() => { window.location.href = '/results' }}
      />

      <EditMatchModal
        match={editingMatch}
        editForm={editForm}
        venues={venues}
        teams={allTeams}
        isUpdating={isUpdatingMatch}
        onClose={() => { setEditingMatch(null); setEditForm(null) }}
        onFormChange={setEditForm}
        onSave={saveEdit}
      />

      <MatchImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportMatches}
        isImporting={isImporting}
        teamNames={allTeams.flatMap(t => [t.name, t.shortName].filter(Boolean) as string[])}
        venueNames={venues.map(v => v.name || '').filter(Boolean)}
      />
    </div>
  )
}

export default MatchSchedule
