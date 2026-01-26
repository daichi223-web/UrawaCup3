// src/pages/Settings/index.tsx
/**
 * 設定ページ
 *
 * 大会設定、会場設定、チーム属性設定を管理
 */

import { useSettings } from './useSettings'
import {
  TournamentSettingsForm,
  VenueSettingsTable,
  TeamSettingsButtons,
  NewTournamentModal,
  AddVenueModal,
  EditVenueModal,
  LocalTeamModal,
  RegionModal,
  LeagueModal,
} from './components'

function Settings() {
  const {
    // Form state
    tournamentForm,
    setTournamentForm,
    venueForm,
    setVenueForm,
    addVenueForm,
    setAddVenueForm,
    newTournamentForm,
    setNewTournamentForm,
    selectedVenue,
    newRegion,
    setNewRegion,
    newLeague,
    setNewLeague,

    // Modal state
    showVenueModal,
    setShowVenueModal,
    showNewTournamentModal,
    setShowNewTournamentModal,
    showAddVenueModal,
    setShowAddVenueModal,
    showLocalTeamModal,
    setShowLocalTeamModal,
    showRegionModal,
    setShowRegionModal,
    showLeagueModal,
    setShowLeagueModal,

    // Data
    teamsData,
    leaguesData,
    regionsData,
    venues,
    tournaments,
    selectedTournamentId,
    setSelectedTournamentId,

    // Mutations
    updateTournamentMutation,
    createTournamentMutation,
    updateVenueMutation,
    addVenueMutation,
    deleteVenueMutation,
    updateTeamTypeMutation,
    updateTeamRegionMutation,
    updateTeamLeagueMutation,
    addRegionMutation,
    deleteRegionMutation,
    addLeagueMutation,
    deleteLeagueMutation,

    // Handlers
    handleSaveTournament,
    handleCreateTournament,
    handleOpenVenueModal,
    handleSaveVenue,
    handleDeleteVenue,
    handleAddVenue,
  } = useSettings()

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* 大会設定 */}
      <TournamentSettingsForm
        form={tournamentForm}
        setForm={setTournamentForm}
        onSave={handleSaveTournament}
        isSaving={updateTournamentMutation.isPending}
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        setSelectedTournamentId={setSelectedTournamentId}
        onNewTournament={() => setShowNewTournamentModal(true)}
      />

      {/* 会場設定 */}
      {selectedTournamentId && (
        <VenueSettingsTable
          venues={venues}
          onEdit={handleOpenVenueModal}
          onAdd={() => setShowAddVenueModal(true)}
        />
      )}

      {/* チーム属性設定 */}
      {selectedTournamentId && (
        <TeamSettingsButtons
          onLocalTeam={() => setShowLocalTeamModal(true)}
          onRegion={() => setShowRegionModal(true)}
          onLeague={() => setShowLeagueModal(true)}
        />
      )}

      {/* Modals */}
      <NewTournamentModal
        isOpen={showNewTournamentModal}
        onClose={() => setShowNewTournamentModal(false)}
        form={newTournamentForm}
        setForm={setNewTournamentForm}
        onSubmit={handleCreateTournament}
        isLoading={createTournamentMutation.isPending}
      />

      <AddVenueModal
        isOpen={showAddVenueModal}
        onClose={() => setShowAddVenueModal(false)}
        form={addVenueForm}
        setForm={setAddVenueForm}
        onSubmit={handleAddVenue}
        isLoading={addVenueMutation.isPending}
      />

      <EditVenueModal
        isOpen={showVenueModal}
        onClose={() => setShowVenueModal(false)}
        form={venueForm}
        setForm={setVenueForm}
        venue={selectedVenue}
        onSave={handleSaveVenue}
        onDelete={handleDeleteVenue}
        isSaving={updateVenueMutation.isPending}
        isDeleting={deleteVenueMutation.isPending}
      />

      <LocalTeamModal
        isOpen={showLocalTeamModal}
        onClose={() => setShowLocalTeamModal(false)}
        teams={teamsData}
        updateTeamTypeMutation={updateTeamTypeMutation}
      />

      <RegionModal
        isOpen={showRegionModal}
        onClose={() => setShowRegionModal(false)}
        teams={teamsData}
        regions={regionsData}
        newRegion={newRegion}
        setNewRegion={setNewRegion}
        addRegionMutation={addRegionMutation}
        deleteRegionMutation={deleteRegionMutation}
        updateTeamRegionMutation={updateTeamRegionMutation}
      />

      <LeagueModal
        isOpen={showLeagueModal}
        onClose={() => setShowLeagueModal(false)}
        teams={teamsData}
        leagues={leaguesData}
        newLeague={newLeague}
        setNewLeague={setNewLeague}
        addLeagueMutation={addLeagueMutation}
        deleteLeagueMutation={deleteLeagueMutation}
        updateTeamLeagueMutation={updateTeamLeagueMutation}
      />
    </div>
  )
}

export default Settings
