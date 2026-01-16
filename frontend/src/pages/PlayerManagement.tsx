// src/frontend/src/pages/PlayerManagement.tsx
// 選手管理ページ
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTeams } from '@/features/teams/hooks';
import {
  usePlayersByTeam,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useImportExcel,
  usePreviewExcelImport,
} from '@/features/players/hooks';
import type { Player, CreatePlayerInput, UpdatePlayerInput, ImportPreviewResult } from '@/features/players/types';
import toast from 'react-hot-toast';
import { useAppStore } from '@/stores/appStore';
import { FileSpreadsheet, AlertTriangle, Check, X, Users, UserCog } from 'lucide-react';

const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const;
const GRADES = [1, 2, 3, 4, 5, 6] as const;

export default function PlayerManagement() {
  // appStoreから現在のトーナメントIDを取得
  const { currentTournament } = useAppStore();
  const tournamentId = currentTournament?.id || 1;
  const { data: teams = [] } = useTeams(tournamentId);

  // URLパラメータからチームIDを取得
  const [searchParams] = useSearchParams();
  const teamIdFromUrl = searchParams.get('team');

  // 選択中のチーム
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // URLパラメータがあれば自動選択
  useEffect(() => {
    if (teamIdFromUrl && !selectedTeamId) {
      setSelectedTeamId(Number(teamIdFromUrl));
    }
  }, [teamIdFromUrl, selectedTeamId]);
  const { data: players = [], isLoading: loadingPlayers } = usePlayersByTeam(selectedTeamId || 0);

  // モーダル状態
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Excelプレビューモーダル状態
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewResult | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState({
    replaceExisting: false,
    importStaff: true,
    skipWarnings: false,
  });

  // フォーム
  const [form, setForm] = useState<CreatePlayerInput>({
    teamId: 0,
    number: null,
    name: '',
    nameKana: '',
    grade: undefined,
    position: undefined,
    height: undefined,
    previousTeam: '',
    isCaptain: false,
    notes: '',
  });

  // Excelインポート
  const excelInputRef = useRef<HTMLInputElement>(null);
  const importExcelMutation = useImportExcel();
  const previewExcelMutation = usePreviewExcelImport();

  // Mutations
  const createMutation = useCreatePlayer();
  const updateMutation = useUpdatePlayer();
  const deleteMutation = useDeletePlayer();

  // 新規追加モーダルを開く
  const openAddModal = () => {
    if (!selectedTeamId) {
      toast.error('チームを選択してください');
      return;
    }
    setEditingPlayer(null);
    setForm({
      teamId: selectedTeamId,
      number: null,
      name: '',
      nameKana: '',
      grade: undefined,
      position: undefined,
      height: undefined,
      previousTeam: '',
      isCaptain: false,
      notes: '',
    });
    setShowModal(true);
  };

  // 編集モーダルを開く
  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setForm({
      teamId: player.teamId,
      number: player.number,
      name: player.name,
      nameKana: player.nameKana || '',
      grade: player.grade || undefined,
      position: player.position || undefined,
      height: player.height || undefined,
      previousTeam: player.previousTeam || '',
      isCaptain: player.isCaptain,
      notes: player.notes || '',
    });
    setShowModal(true);
  };

  // 保存
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('選手名を入力してください');
      return;
    }

    try {
      if (editingPlayer) {
        const updateData: UpdatePlayerInput = {
          number: form.number,
          name: form.name,
          nameKana: form.nameKana,
          grade: form.grade,
          position: form.position,
          height: form.height,
          previousTeam: form.previousTeam,
          isCaptain: form.isCaptain,
          notes: form.notes,
        };
        await updateMutation.mutateAsync({ id: editingPlayer.id, data: updateData });
        toast.success('選手を更新しました');
      } else {
        await createMutation.mutateAsync(form);
        toast.success('選手を追加しました');
      }
      setShowModal(false);
    } catch (error) {
      toast.error('保存に失敗しました');
    }
  };

  // 削除確認
  const confirmDelete = (player: Player) => {
    setDeletingPlayer(player);
    setShowDeleteConfirm(true);
  };

  // 削除実行
  const handleDelete = async () => {
    if (!deletingPlayer) return;
    try {
      await deleteMutation.mutateAsync(deletingPlayer.id);
      toast.success('選手を削除しました');
      setShowDeleteConfirm(false);
      setDeletingPlayer(null);
    } catch (error) {
      toast.error('削除に失敗しました');
    }
  };

  // Excelインポート（プレビュー表示）
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTeamId) return;

    try {
      // まずプレビューを取得
      const preview = await previewExcelMutation.mutateAsync({
        teamId: selectedTeamId,
        file,
      });
      setPreviewData(preview);
      setPreviewFile(file);
      setShowPreviewModal(true);
    } catch (error) {
      toast.error('ファイルの解析に失敗しました');
    }

    // ファイル入力をリセット
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  // プレビュー確認後のインポート実行
  const handleConfirmImport = async () => {
    if (!previewFile || !selectedTeamId) return;

    try {
      const result = await importExcelMutation.mutateAsync({
        teamId: selectedTeamId,
        file: previewFile,
        options: {
          replaceExisting: importOptions.replaceExisting,
          importStaff: importOptions.importStaff,
          skipWarnings: importOptions.skipWarnings,
        },
      });
      toast.success(`${result.imported}名をインポートしました`);
      setShowPreviewModal(false);
      setPreviewData(null);
      setPreviewFile(null);
    } catch (error) {
      toast.error('インポートに失敗しました');
    }
  };

  // 一括コピペ追加
  const handleBulkImport = async () => {
    if (!selectedTeamId || !bulkText.trim()) return;

    const lines = bulkText.trim().split('\n');
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      const parts = line.split(/[\t,]/).map(s => s.trim());
      if (parts.length < 2) continue;

      const number = parseInt(parts[0], 10);
      const name = parts[1];
      const grade = parts[2] ? parseInt(parts[2], 10) : undefined;

      if (!name) continue;

      try {
        await createMutation.mutateAsync({
          teamId: selectedTeamId,
          number: isNaN(number) ? null : number,
          name,
          nameKana: '',
          grade: isNaN(grade as number) ? undefined : grade,
          position: undefined,
          height: undefined,
          previousTeam: '',
          isCaptain: false,
          notes: '',
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount}名を追加しました`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount}名の追加に失敗しました`);
    }

    setShowBulkModal(false);
    setBulkText('');
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">選手管理</h1>
        <div className="flex items-center gap-3">
          {/* チーム選択 */}
          <select
            className="form-input w-64"
            value={selectedTeamId || ''}
            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">チームを選択...</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          {/* Excelインポート */}
          <input
            type="file"
            ref={excelInputRef}
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelImport}
          />
          <button
            className="btn-secondary"
            onClick={() => excelInputRef.current?.click()}
            disabled={!selectedTeamId || importExcelMutation.isPending}
          >
            Excelインポート
          </button>

          {/* 一括追加 */}
          <button
            className="btn-secondary"
            onClick={() => setShowBulkModal(true)}
            disabled={!selectedTeamId}
          >
            一括追加
          </button>

          {/* 選手追加 */}
          <button
            className="btn-primary"
            onClick={openAddModal}
            disabled={!selectedTeamId}
          >
            + 選手追加
          </button>
        </div>
      </div>

      {/* 選手一覧 */}
      {!selectedTeamId ? (
        <div className="text-center py-12 text-gray-500">
          チームを選択してください
        </div>
      ) : loadingPlayers ? (
        <div className="text-center py-12 text-gray-500">読み込み中...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          選手が登録されていません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">背番号</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">選手名</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">フリガナ</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">学年</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ポジション</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">身長</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">前所属</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">C</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.id} className={!player.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 text-sm">{player.number ?? '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium">{player.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{player.nameKana || '-'}</td>
                  <td className="px-4 py-3 text-sm">{player.grade ? `${player.grade}年` : '-'}</td>
                  <td className="px-4 py-3 text-sm">{player.position || '-'}</td>
                  <td className="px-4 py-3 text-sm">{player.height ? `${player.height}cm` : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{player.previousTeam || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {player.isCaptain && <span className="text-yellow-500">★</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-primary-600 hover:text-primary-800 mr-3"
                      onClick={() => openEditModal(player)}
                    >
                      編集
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800"
                      onClick={() => confirmDelete(player)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 追加/編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingPlayer ? '選手編集' : '選手追加'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">背番号</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    className="form-input w-full"
                    value={form.number ?? ''}
                    onChange={(e) => setForm({ ...form, number: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    選手名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
                <input
                  type="text"
                  className="form-input w-full"
                  value={form.nameKana}
                  onChange={(e) => setForm({ ...form, nameKana: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
                  <select
                    className="form-input w-full"
                    value={form.grade ?? ''}
                    onChange={(e) => setForm({ ...form, grade: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">-</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ポジション</label>
                  <select
                    className="form-input w-full"
                    value={form.position ?? ''}
                    onChange={(e) => setForm({ ...form, position: e.target.value as typeof POSITIONS[number] || undefined })}
                  >
                    <option value="">-</option>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">身長(cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="220"
                    className="form-input w-full"
                    value={form.height ?? ''}
                    onChange={(e) => setForm({ ...form, height: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">前所属チーム</label>
                <input
                  type="text"
                  className="form-input w-full"
                  value={form.previousTeam}
                  onChange={(e) => setForm({ ...form, previousTeam: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  className="form-input w-full"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isCaptain"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  checked={form.isCaptain}
                  onChange={(e) => setForm({ ...form, isCaptain: e.target.checked })}
                />
                <label htmlFor="isCaptain" className="ml-2 text-sm text-gray-700">
                  キャプテン
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && deletingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">選手の削除</h2>
            <p className="text-gray-600 mb-6">
              「{deletingPlayer.name}」を削除しますか？<br />
              この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingPlayer(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一括追加モーダル */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">選手一括追加</h2>
            <p className="text-sm text-gray-600 mb-3">
              以下の形式で選手情報を貼り付けてください（タブ区切りまたはカンマ区切り）
            </p>
            <div className="bg-gray-100 p-2 rounded text-xs mb-3 font-mono">
              背番号, 選手名, 学年<br />
              1, 山田太郎, 3<br />
              2, 鈴木次郎, 2<br />
              ...
            </div>
            <textarea
              className="form-input w-full h-48 font-mono text-sm"
              placeholder="1	山田太郎	3
2	鈴木次郎	2
3	佐藤三郎	3"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkText('');
                }}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={handleBulkImport}
                disabled={!bulkText.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? '追加中...' : '一括追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excelインポートプレビューモーダル */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="bg-primary-600 px-6 py-4 flex items-center gap-3">
              <FileSpreadsheet className="text-white" size={24} />
              <h2 className="text-xl font-bold text-white">Excelインポート プレビュー</h2>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                  setPreviewFile(null);
                }}
                className="ml-auto text-white/80 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-auto p-6">
              {/* サマリー */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                  <Users className="text-blue-600" size={32} />
                  <div>
                    <div className="text-2xl font-bold text-blue-800">{previewData.players.length}</div>
                    <div className="text-sm text-blue-600">選手</div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                  <UserCog className="text-green-600" size={32} />
                  <div>
                    <div className="text-2xl font-bold text-green-800">{previewData.staff?.length || 0}</div>
                    <div className="text-sm text-green-600">スタッフ</div>
                  </div>
                </div>
              </div>

              {/* 警告・エラー */}
              {(previewData.warnings.length > 0 || previewData.errors.length > 0) && (
                <div className="mb-6 space-y-2">
                  {previewData.errors.map((error, i) => (
                    <div key={`error-${i}`} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                      <X className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  ))}
                  {previewData.warnings.map((warning, i) => (
                    <div key={`warning-${i}`} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
                      <span className="text-sm text-amber-700">{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 選手一覧 */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users size={18} /> 選手一覧
                </h3>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">番号</th>
                        <th className="px-3 py-2 text-left">氏名</th>
                        <th className="px-3 py-2 text-left">ポジション</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewData.players.map((player, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{player.number || '-'}</td>
                          <td className="px-3 py-2 font-medium">{player.name}</td>
                          <td className="px-3 py-2 text-gray-600">{player.position || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* スタッフ一覧 */}
              {previewData.staff && previewData.staff.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <UserCog size={18} /> スタッフ一覧
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">役職</th>
                          <th className="px-3 py-2 text-left">氏名</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {previewData.staff.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{s.role}</td>
                            <td className="px-3 py-2 font-medium">{s.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* オプション */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">インポートオプション</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importOptions.replaceExisting}
                      onChange={(e) => setImportOptions(prev => ({ ...prev, replaceExisting: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">既存の選手を削除してインポート</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importOptions.importStaff}
                      onChange={(e) => setImportOptions(prev => ({ ...prev, importStaff: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">スタッフもインポート</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importOptions.skipWarnings}
                      onChange={(e) => setImportOptions(prev => ({ ...prev, skipWarnings: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">警告を無視してインポート</span>
                  </label>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                  setPreviewFile(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleConfirmImport}
                disabled={importExcelMutation.isPending || previewData.players.length === 0}
              >
                <Check size={18} />
                {importExcelMutation.isPending ? 'インポート中...' : `${previewData.players.length}名をインポート`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
