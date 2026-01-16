import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { teamsApi } from '@/lib/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';

// Team type for this component
interface Team {
  id: number;
  name: string;
  short_name?: string;
  group_id?: string;
  groupId?: string;
  team_type?: string;
  teamType?: string;
  is_venue_host?: boolean;
  isVenueHost?: boolean;
  tournament_id: number;
  group_order?: number;
}

// タブの定義
const GROUP_TABS = ['全チーム', 'Aグループ', 'Bグループ', 'Cグループ', 'Dグループ'] as const;
type GroupTab = typeof GROUP_TABS[number];
const GROUP_MAP: Record<GroupTab, string | null> = {
  '全チーム': null,
  'Aグループ': 'A',
  'Bグループ': 'B',
  'Cグループ': 'C',
  'Dグループ': 'D',
};

function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GroupTab>('全チーム');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [editForm, setEditForm] = useState({ name: '', groupId: '', teamType: 'invited', isVenueHost: false });
  const [addForm, setAddForm] = useState({ name: '', groupId: '', teamType: 'invited', isVenueHost: false });
  const [bulkText, setBulkText] = useState('');
  const [bulkTeamType, setBulkTeamType] = useState<'invited' | 'local'>('invited');
  const [saving, setSaving] = useState(false);
  const [updatingTeamId, setUpdatingTeamId] = useState<number | null>(null);

  // appStoreから現在のトーナメントIDを取得
  const { currentTournament } = useAppStore();
  const tournamentId = currentTournament?.id || 1;

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const response = await teamsApi.getAll(tournamentId);
        setTeams(response.teams as Team[]);
      } catch (e) {
        console.error('チーム取得エラー:', e);
        toast.error('チームデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [tournamentId]);

  // タブでフィルタリング
  const filteredTeams = useMemo(() => {
    const groupId = GROUP_MAP[activeTab];
    if (!groupId) return teams;
    return teams.filter(t => (t.groupId || t.group_id) === groupId);
  }, [teams, activeTab]);

  // インライン更新処理
  const handleInlineUpdate = async (teamId: number, field: string, value: string | boolean | null) => {
    setUpdatingTeamId(teamId);
    try {
      // camelCase to snake_case変換
      const fieldMap: Record<string, string> = {
        groupId: 'group_id',
        teamType: 'team_type',
        isVenueHost: 'is_venue_host',
        shortName: 'short_name',
        groupOrder: 'group_order',
      };
      const snakeField = fieldMap[field] || field;
      const data = await teamsApi.update(teamId, { [snakeField]: value });
      setTeams(prev => prev.map(t => t.id === teamId ? data as Team : t));
      toast.success('更新しました');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました');
    } finally {
      setUpdatingTeamId(null);
    }
  };

  // 編集モーダルを開く
  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setEditForm({
      name: team.name,
      groupId: team.groupId || team.group_id || '',
      teamType: team.teamType || team.team_type || 'invited',
      isVenueHost: team.isVenueHost ?? team.is_venue_host ?? false,
    });
    setShowEditModal(true);
  };

  // チームを保存
  const handleSave = async () => {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      const data = await teamsApi.update(selectedTeam.id, {
        name: editForm.name,
        group_id: editForm.groupId || null,
        team_type: editForm.teamType,
        is_venue_host: editForm.isVenueHost,
      });
      setTeams(prev => prev.map(t => t.id === selectedTeam.id ? data as Team : t));
      setShowEditModal(false);
      toast.success('チーム情報を更新しました');
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新に失敗しました';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // 新規チームを追加
  const handleAddTeam = async () => {
    if (!addForm.name.trim()) {
      toast.error('チーム名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const data = await teamsApi.create({
        name: addForm.name,
        tournament_id: tournamentId,
        group_id: addForm.groupId || null,
        team_type: addForm.teamType,
        is_venue_host: addForm.isVenueHost,
      });
      setTeams(prev => [...prev, data as Team]);
      setShowAddModal(false);
      setAddForm({ name: '', groupId: '', teamType: 'invited', isVenueHost: false });
      toast.success('チームを追加しました');
    } catch (error) {
      const message = error instanceof Error ? error.message : '追加に失敗しました';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // 一括登録処理
  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) {
      toast.error('略称を入力してください');
      return;
    }

    setSaving(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const line of lines) {
      // タブ/スペース区切り: 略称 グループ
      const parts = line.split(/[\t\s]+/);
      const shortName = parts[0]?.trim();
      const groupId = parts[1]?.trim().toUpperCase() || null;

      if (!shortName) continue;

      // 略称をチーム名としても使用
      const name = shortName;

      try {
        await teamsApi.create({
          name,
          short_name: shortName,
          tournament_id: tournamentId,
          group_id: groupId && ['A', 'B', 'C', 'D'].includes(groupId) ? groupId : null,
          team_type: bulkTeamType,
          is_venue_host: false,
        });
        successCount++;
      } catch (error) {
        errors.push(shortName);
      }
    }

    // チーム一覧を再取得
    const response = await teamsApi.getAll(tournamentId);
    setTeams(response.teams as Team[]);

    if (successCount > 0) {
      toast.success(`${successCount}チームを登録しました`);
    }
    if (errors.length > 0) {
      toast.error(`${errors.length}チームの登録に失敗: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
    }

    setShowBulkModal(false);
    setBulkText('');
    setBulkTeamType('invited');
    setSaving(false);
  };

  // 削除確認モーダルを開く
  const openDeleteModal = (team: Team) => {
    setTeamToDelete(team);
    setShowDeleteModal(true);
  };

  // チーム削除処理
  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    setSaving(true);
    try {
      await teamsApi.delete(teamToDelete.id);
      setTeams(prev => prev.filter(t => t.id !== teamToDelete.id));
      setShowDeleteModal(false);
      setTeamToDelete(null);
      toast.success(`「${teamToDelete.name}」を削除しました`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '削除に失敗しました';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">チーム管理</h1>
          <p className="text-gray-600 mt-1">
            参加チームの登録・編集・グループ分けを行います
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary bg-purple-600 hover:bg-purple-700"
            onClick={() => setShowBulkModal(true)}
          >
            一括登録
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>チーム追加</button>
          <Link to="/players" className="btn-secondary bg-green-600 text-white hover:bg-green-700">
            選手管理
          </Link>
        </div>
      </div>

      {/* グループタブ */}
      <div className="card">
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

        {/* チーム一覧テーブル */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>グループ</th>
                <th>番号</th>
                <th>チーム名</th>
                <th>区分</th>
                <th>会場担当</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>

              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    チームが登録されていません
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <select
                        className={`w-16 h-8 rounded-full font-bold text-center border-0 cursor-pointer
                          ${(team.groupId || team.group_id) === 'A' ? 'bg-red-100 text-red-800' :
                            (team.groupId || team.group_id) === 'B' ? 'bg-blue-100 text-blue-800' :
                              (team.groupId || team.group_id) === 'C' ? 'bg-green-100 text-green-800' :
                                (team.groupId || team.group_id) === 'D' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        value={team.groupId || team.group_id || ''}
                        onChange={(e) => handleInlineUpdate(team.id, 'groupId', e.target.value || null)}
                        disabled={updatingTeamId === team.id}
                        style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                      >
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{team.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-gray-900">{team.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer
                          ${(team.teamType || team.team_type) === 'local' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                        value={team.teamType || team.team_type || 'invited'}
                        onChange={(e) => handleInlineUpdate(team.id, 'teamType', e.target.value)}
                        disabled={updatingTeamId === team.id}
                        style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                      >
                        <option value="invited">招待</option>
                        <option value="local">地元</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <input
                        type="checkbox"
                        checked={team.isVenueHost || team.is_venue_host || false}
                        onChange={(e) => handleInlineUpdate(team.id, 'isVenueHost', e.target.checked)}
                        disabled={updatingTeamId === team.id}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        style={{ opacity: updatingTeamId === team.id ? 0.5 : 1 }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                          onClick={() => openEditModal(team)}
                        >
                          編集
                        </button>
                        <Link
                          to={`/players?team=${team.id}`}
                          className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                        >
                          選手登録
                        </Link>
                        <button
                          className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                          onClick={() => openDeleteModal(team)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 編集モーダル */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="チーム編集"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">チーム名</label>
            <input
              type="text"
              className="form-input"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">グループ</label>
            <select
              className="form-input"
              value={editForm.groupId}
              onChange={(e) => setEditForm(prev => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">未設定</option>
              <option value="A">Aグループ</option>
              <option value="B">Bグループ</option>
              <option value="C">Cグループ</option>
              <option value="D">Dグループ</option>
            </select>
          </div>
          <div>
            <label className="form-label">チーム区分</label>
            <select
              className="form-input"
              value={editForm.teamType}
              onChange={(e) => setEditForm(prev => ({ ...prev, teamType: e.target.value }))}
            >
              <option value="invited">招待チーム</option>
              <option value="local">地元チーム</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isVenueHost"
              checked={editForm.isVenueHost}
              onChange={(e) => setEditForm(prev => ({ ...prev, isVenueHost: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isVenueHost" className="text-sm text-gray-700">
              会場担当チーム
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => setShowEditModal(false)}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>

      {/* チーム追加モーダル */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="チーム追加"
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">チーム名 *</label>
            <input
              type="text"
              className="form-input"
              value={addForm.name}
              onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="チーム名を入力"
            />
          </div>
          <div>
            <label className="form-label">グループ</label>
            <select
              className="form-input"
              value={addForm.groupId}
              onChange={(e) => setAddForm(prev => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">未設定</option>
              <option value="A">Aグループ</option>
              <option value="B">Bグループ</option>
              <option value="C">Cグループ</option>
              <option value="D">Dグループ</option>
            </select>
          </div>
          <div>
            <label className="form-label">チーム区分</label>
            <select
              className="form-input"
              value={addForm.teamType}
              onChange={(e) => setAddForm(prev => ({ ...prev, teamType: e.target.value }))}
            >
              <option value="invited">招待チーム</option>
              <option value="local">地元チーム</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addIsVenueHost"
              checked={addForm.isVenueHost}
              onChange={(e) => setAddForm(prev => ({ ...prev, isVenueHost: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="addIsVenueHost" className="text-sm text-gray-700">
              会場担当チーム
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => setShowAddModal(false)}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleAddTeam}
              disabled={saving}
            >
              {saving ? '追加中...' : '追加'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 一括登録モーダル */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="チーム一括登録"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">入力形式（1行1チーム）:</p>
            <p className="text-xs">略称（スペースまたはタブ）グループ</p>
          </div>
          <div>
            <label className="form-label">チーム区分</label>
            <select
              className="form-input"
              value={bulkTeamType}
              onChange={(e) => setBulkTeamType(e.target.value as 'invited' | 'local')}
            >
              <option value="invited">招待チーム</option>
              <option value="local">地元チーム</option>
            </select>
          </div>
          <div>
            <label className="form-label">チーム一覧 *</label>
            <textarea
              className="form-input min-h-[200px] font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`浦和南  A
市浦和  B
前橋育  A
青森山田  B
流経柏  C
静岡学園  D`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {bulkText.split('\n').filter(l => l.trim()).length}チーム検出
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => {
                setShowBulkModal(false);
                setBulkText('');
                setBulkTeamType('invited');
              }}
            >
              キャンセル
            </button>
            <button
              className="btn-primary"
              onClick={handleBulkAdd}
              disabled={saving || !bulkText.trim()}
            >
              {saving ? '登録中...' : '一括登録'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTeamToDelete(null);
        }}
        title="チーム削除の確認"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              <span className="font-bold">「{teamToDelete?.name}」</span>を削除しますか？
            </p>
            <p className="text-red-600 text-sm mt-2">
              この操作は取り消せません。チームに関連する選手データも削除される可能性があります。
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn-secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setTeamToDelete(null);
              }}
            >
              キャンセル
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              onClick={handleDeleteTeam}
              disabled={saving}
            >
              {saving ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TeamManagement
