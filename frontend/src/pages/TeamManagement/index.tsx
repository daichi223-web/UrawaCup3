// src/pages/TeamManagement/index.tsx

import { Link } from 'react-router-dom'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { useTeamManagement } from './hooks/useTeamManagement'
import {
  TeamTable,
  TeamEditModal,
  TeamAddModal,
  TeamBulkAddModal,
  TeamDeleteModal,
  TeamDeleteAllModal,
  CsvImportModal,
} from './components'
import { GROUP_TABS } from './constants'

export default function TeamManagement() {
  const {
    teams,
    leagues,
    loading,
    activeTab,
    showEditModal,
    showAddModal,
    showBulkModal,
    showDeleteModal,
    teamToDelete,
    showDeleteAllModal,
    deleteAllValidation,
    editForm,
    addForm,
    bulkText,
    bulkTeamType,
    saving,
    updatingTeamId,
    tournamentId,
    useGroupSystem,
    filteredTeams,
    setActiveTab,
    setShowEditModal,
    setShowAddModal,
    setShowBulkModal,
    setShowDeleteModal,
    setShowDeleteAllModal,
    setDeleteAllValidation,
    setEditForm,
    setAddForm,
    setBulkText,
    setBulkTeamType,
    setTeamToDelete,
    handleInlineUpdate,
    openEditModal,
    handleSave,
    handleAddTeam,
    handleBulkAdd,
    openDeleteModal,
    handleDeleteTeam,
    openDeleteAllModal,
    handleDeleteAllTeams,
    handleDeleteRelatedData,
    handleCsvImport,
    showCsvImportModal,
    setShowCsvImportModal,
  } = useTeamManagement()

  if (!tournamentId) {
    return <LoadingSpinner />
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チーム管理</h1>
          <p className="text-gray-600 mt-1">
            {useGroupSystem
              ? '参加チームの登録・編集・グループ分けを行います'
              : '参加チームの登録・編集を行います'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setShowCsvImportModal(true)}
          >
            CSVインポート
          </button>
          <button
            className="btn-primary bg-purple-600 hover:bg-purple-700"
            onClick={() => setShowBulkModal(true)}
          >
            一括登録
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            チーム追加
          </button>
          {teams.length > 0 && (
            <button
              className="btn-secondary bg-red-600 text-white hover:bg-red-700"
              onClick={openDeleteAllModal}
              disabled={saving}
            >
              全削除
            </button>
          )}
          <Link to="/players" className="btn-secondary bg-green-600 text-white hover:bg-green-700">
            選手管理
          </Link>
        </div>
      </div>

      {/* グループタブとチーム一覧 */}
      <div className="card">
        {useGroupSystem && (
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {GROUP_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                  {activeTab === tab && filteredTeams.length > 0 && (
                    <span className="ml-2 bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                      {filteredTeams.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        )}

        <TeamTable
          teams={useGroupSystem ? filteredTeams : teams}
          leagues={leagues}
          useGroupSystem={useGroupSystem}
          updatingTeamId={updatingTeamId}
          onInlineUpdate={handleInlineUpdate}
          onEditClick={openEditModal}
          onDeleteClick={openDeleteModal}
        />
      </div>

      {/* モーダル群 */}
      <TeamEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editForm={editForm}
        setEditForm={setEditForm}
        leagues={leagues}
        useGroupSystem={useGroupSystem}
        saving={saving}
        onSave={handleSave}
      />

      <TeamAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        addForm={addForm}
        setAddForm={setAddForm}
        leagues={leagues}
        useGroupSystem={useGroupSystem}
        saving={saving}
        onAdd={handleAddTeam}
      />

      <TeamBulkAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        bulkText={bulkText}
        setBulkText={setBulkText}
        bulkTeamType={bulkTeamType}
        setBulkTeamType={setBulkTeamType}
        useGroupSystem={useGroupSystem}
        saving={saving}
        onBulkAdd={handleBulkAdd}
      />

      <TeamDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setTeamToDelete(null)
        }}
        team={teamToDelete}
        saving={saving}
        onDelete={handleDeleteTeam}
      />

      <CsvImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onImport={handleCsvImport}
        saving={saving}
      />

      <TeamDeleteAllModal
        isOpen={showDeleteAllModal}
        onClose={() => {
          setShowDeleteAllModal(false)
          setDeleteAllValidation(null)
        }}
        teamsCount={teams.length}
        validation={deleteAllValidation}
        saving={saving}
        onDeleteAll={handleDeleteAllTeams}
        onDeleteRelatedData={handleDeleteRelatedData}
      />
    </div>
  )
}
