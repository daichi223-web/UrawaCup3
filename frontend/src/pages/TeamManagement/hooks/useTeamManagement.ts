// src/pages/TeamManagement/hooks/useTeamManagement.ts

import { useState, useEffect, useMemo } from 'react'
import { teamsApi, venuesApi, leaguesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useAppStore } from '@/stores/appStore'
import type { Team, League, Venue, EditFormState, DeleteAllValidation } from '../types'
import { GROUP_MAP, type GroupTab } from '../constants'

export function useTeamManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<GroupTab>('全チーム')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [deleteAllValidation, setDeleteAllValidation] = useState<DeleteAllValidation | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    groupId: '',
    teamType: 'invited',
    isVenueHost: false,
    region: '',
    leagueId: '',
  })
  const [addForm, setAddForm] = useState<EditFormState>({
    name: '',
    groupId: '',
    teamType: 'invited',
    isVenueHost: false,
    region: '',
    leagueId: '',
  })
  const [bulkText, setBulkText] = useState('')
  const [bulkTeamType, setBulkTeamType] = useState<'invited' | 'local'>('invited')
  const [saving, setSaving] = useState(false)
  const [updatingTeamId, setUpdatingTeamId] = useState<number | null>(null)

  const { currentTournament } = useAppStore()
  const tournamentId = currentTournament?.id
  const useGroupSystem = (currentTournament as { use_group_system?: boolean } | null)?.use_group_system ?? true

  // データ取得
  useEffect(() => {
    if (!tournamentId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const [teamsResponse, leaguesData, venuesResponse] = await Promise.all([
          teamsApi.getAll(tournamentId),
          leaguesApi.getByTournament(tournamentId),
          venuesApi.getAll(tournamentId),
        ])
        setTeams(teamsResponse.teams as Team[])
        setLeagues(leaguesData || [])
        setVenues((venuesResponse || []).map((v: { id: number; name: string; short_name?: string }) => ({
          id: v.id,
          name: v.name,
          shortName: v.short_name || v.name.charAt(0),
        })))
      } catch (e) {
        console.error('データ取得エラー:', e)
        toast.error('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [tournamentId])

  // タブでフィルタリング
  const filteredTeams = useMemo(() => {
    if (!teams.length) return []
    const groupId = GROUP_MAP[activeTab]
    if (!groupId) return teams
    return teams.filter(t => (t.groupId || t.group_id) === groupId)
  }, [teams, activeTab])

  // インライン更新処理
  const handleInlineUpdate = async (teamId: number, field: string, value: string | boolean | null) => {
    setUpdatingTeamId(teamId)
    try {
      const fieldMap: Record<string, string> = {
        groupId: 'group_id',
        teamType: 'team_type',
        isVenueHost: 'is_venue_host',
        shortName: 'short_name',
        groupOrder: 'group_order',
      }
      const snakeField = fieldMap[field] || field
      const data = await teamsApi.update(teamId, { [snakeField]: value })
      setTeams(prev => prev.map(t => t.id === teamId ? data as Team : t))
      toast.success('更新しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setUpdatingTeamId(null)
    }
  }

  // 編集モーダルを開く
  const openEditModal = (team: Team) => {
    setSelectedTeam(team)
    setEditForm({
      name: team.name,
      groupId: team.groupId || team.group_id || '',
      teamType: team.teamType || team.team_type || 'invited',
      isVenueHost: team.isVenueHost ?? team.is_venue_host ?? false,
      region: team.region || '',
      leagueId: String(team.leagueId ?? team.league_id ?? ''),
    })
    setShowEditModal(true)
  }

  // チームを保存
  const handleSave = async () => {
    if (!selectedTeam) return
    setSaving(true)
    try {
      const data = await teamsApi.update(selectedTeam.id, {
        name: editForm.name,
        group_id: editForm.groupId || null,
        team_type: editForm.teamType as 'local' | 'invited',
        is_venue_host: editForm.isVenueHost,
        region: editForm.region || null,
      })
      setTeams(prev => prev.map(t => t.id === selectedTeam.id ? data as Team : t))
      setShowEditModal(false)
      toast.success('チーム情報を更新しました')
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新に失敗しました'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // 新規チームを追加
  const handleAddTeam = async () => {
    if (!addForm.name.trim()) {
      toast.error('チーム名を入力してください')
      return
    }
    if (!tournamentId) return
    setSaving(true)
    try {
      const data = await teamsApi.create({
        name: addForm.name,
        short_name: null,
        tournament_id: tournamentId,
        group_id: addForm.groupId || null,
        team_type: addForm.teamType as 'local' | 'invited',
        is_venue_host: addForm.isVenueHost,
        region: addForm.region || null,
        notes: null,
        group_order: null,
        prefecture: null,
      })
      setTeams(prev => [...prev, data as Team])
      setShowAddModal(false)
      setAddForm({ name: '', groupId: '', teamType: 'invited', isVenueHost: false, region: '', leagueId: '' })
      toast.success('チームを追加しました')
    } catch (error) {
      const message = error instanceof Error ? error.message : '追加に失敗しました'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // 一括登録処理
  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(line => line.trim()).filter(line => line)
    if (lines.length === 0) {
      toast.error('略称を入力してください')
      return
    }
    if (!tournamentId) return

    setSaving(true)
    let successCount = 0
    const errors: string[] = []

    for (const line of lines) {
      const parts = line.split(/[\t\s]+/)
      const shortName = parts[0]?.trim()
      const groupId = parts[1]?.trim().toUpperCase() || null

      if (!shortName) continue

      const name = shortName

      try {
        await teamsApi.create({
          name,
          short_name: shortName,
          tournament_id: tournamentId,
          group_id: groupId && ['A', 'B', 'C', 'D'].includes(groupId) ? groupId : null,
          team_type: bulkTeamType,
          is_venue_host: false,
          region: null,
          notes: null,
          group_order: null,
          prefecture: null,
        })
        successCount++
      } catch {
        errors.push(shortName)
      }
    }

    const response = await teamsApi.getAll(tournamentId)
    setTeams(response.teams as Team[])

    if (successCount > 0) {
      toast.success(`${successCount}チームを登録しました`)
    }
    if (errors.length > 0) {
      toast.error(`${errors.length}チームの登録に失敗: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
    }

    setShowBulkModal(false)
    setBulkText('')
    setBulkTeamType('invited')
    setSaving(false)
  }

  // 削除確認モーダルを開く
  const openDeleteModal = (team: Team) => {
    setTeamToDelete(team)
    setShowDeleteModal(true)
  }

  // チーム削除処理
  const handleDeleteTeam = async () => {
    if (!teamToDelete) return
    setSaving(true)
    try {
      await teamsApi.delete(teamToDelete.id)
      setTeams(prev => prev.filter(t => t.id !== teamToDelete.id))
      setShowDeleteModal(false)
      setTeamToDelete(null)
      toast.success(`「${teamToDelete.name}」を削除しました`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // 一括削除モーダルを開く
  const openDeleteAllModal = async () => {
    if (!tournamentId) return
    setSaving(true)
    try {
      const validation = await teamsApi.validateDeleteAll(tournamentId)
      setDeleteAllValidation(validation)
      setShowDeleteAllModal(true)
    } catch {
      toast.error('削除可否の確認に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // 関連データ（試合・得点・順位）を削除
  const handleDeleteRelatedData = async () => {
    if (!tournamentId) return
    setSaving(true)
    try {
      await teamsApi.deleteRelatedData(tournamentId)
      toast.success('試合・得点・順位データを削除しました')
      // 再バリデーション
      const validation = await teamsApi.validateDeleteAll(tournamentId)
      setDeleteAllValidation(validation)
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // 全チーム一括削除処理
  const handleDeleteAllTeams = async () => {
    if (!tournamentId) return
    setSaving(true)
    try {
      await teamsApi.deleteAll(tournamentId)
      setTeams([])
      setShowDeleteAllModal(false)
      setDeleteAllValidation(null)
      toast.success('全チームを削除しました')
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return {
    // State
    teams,
    leagues,
    venues,
    loading,
    activeTab,
    selectedTeam,
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
    // Setters
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
    // Handlers
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
  }
}
