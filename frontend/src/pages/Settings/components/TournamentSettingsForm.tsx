// src/pages/Settings/components/TournamentSettingsForm.tsx
import type { TournamentForm } from '../types'

interface Props {
  form: TournamentForm
  setForm: React.Dispatch<React.SetStateAction<TournamentForm>>
  onSave: () => void
  isSaving: boolean
  tournaments: Array<{ id: number; name: string; year: number }> | undefined
  selectedTournamentId: number | null
  setSelectedTournamentId: (id: number | null) => void
  onNewTournament: () => void
}

export function TournamentSettingsForm({
  form,
  setForm,
  onSave,
  isSaving,
  tournaments,
  selectedTournamentId,
  setSelectedTournamentId,
  onNewTournament,
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">大会設定</h2>
        <button className="btn-secondary text-sm" onClick={onNewTournament}>
          新規大会作成
        </button>
      </div>

      {/* 大会選択 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">大会を選択</label>
        <select
          className="form-input w-full md:w-1/2"
          value={selectedTournamentId || ''}
          onChange={(e) => setSelectedTournamentId(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">選択してください</option>
          {tournaments?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.year})
            </option>
          ))}
        </select>
      </div>

      {selectedTournamentId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本設定 */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">基本設定</h3>
              <div>
                <label className="block text-sm font-medium mb-1">大会名</label>
                <input
                  type="text"
                  className="form-input w-full"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">開催年</label>
                <input
                  type="number"
                  className="form-input w-full"
                  value={form.year}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">開始日</label>
                  <input
                    type="date"
                    className="form-input w-full"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">終了日</label>
                  <input
                    type="date"
                    className="form-input w-full"
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">説明</label>
                <textarea
                  className="form-input w-full"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* 試合設定 */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">試合設定</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">試合時間（分）</label>
                  <input
                    type="number"
                    className="form-input w-full"
                    value={form.gameMinutes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, gameMinutes: parseInt(e.target.value) || 20 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">インターバル（分）</label>
                  <input
                    type="number"
                    className="form-input w-full"
                    value={form.intervalMinutes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 5 }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">勝利点</label>
                  <input
                    type="number"
                    className="form-input w-full"
                    value={form.pointsForWin}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pointsForWin: parseInt(e.target.value) || 3 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">引分点</label>
                  <input
                    type="number"
                    className="form-input w-full"
                    value={form.pointsForDraw}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pointsForDraw: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">敗戦点</label>
                  <input
                    type="number"
                    className="form-input w-full"
                    value={form.pointsForLoss}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pointsForLoss: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* グループ設定 */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">グループ設定</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.useGroupSystem}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, useGroupSystem: e.target.checked }))
                    }
                  />
                  <span className="text-sm">グループ制を使用</span>
                </label>
              </div>
              {form.useGroupSystem && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">1グループのチーム数</label>
                    <input
                      type="number"
                      className="form-input w-full"
                      value={form.teamsPerGroup}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, teamsPerGroup: parseInt(e.target.value) || 6 }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">1チームの試合数</label>
                    <input
                      type="number"
                      className="form-input w-full"
                      value={form.matchesPerTeam}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, matchesPerTeam: parseInt(e.target.value) || 4 }))
                      }
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.venue_per_group}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, venue_per_group: e.target.checked }))
                    }
                  />
                  <span className="text-sm">グループ毎に会場を割り当て</span>
                </label>
              </div>
            </div>

            {/* 単一リーグ設定 */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">単一リーグ設定</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isSingleLeague}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, isSingleLeague: e.target.checked }))
                    }
                  />
                  <span className="text-sm">単一リーグモード</span>
                </label>
              </div>
              {form.isSingleLeague && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">参加チーム数</label>
                    <input
                      type="number"
                      className="form-input w-full"
                      value={form.singleLeagueTeamCount}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          singleLeagueTeamCount: parseInt(e.target.value) || 8,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">1チームの試合数</label>
                    <input
                      type="number"
                      className="form-input w-full"
                      value={form.singleLeagueMatchesPerTeam}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          singleLeagueMatchesPerTeam: parseInt(e.target.value) || 7,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* タイムスケジュール設定 */}
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold border-b pb-2">タイムスケジュール設定</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">予選開始時間</label>
                <input
                  type="time"
                  className="form-input w-full"
                  value={form.preliminaryStartTime}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, preliminaryStartTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">1日目終了時間</label>
                <input
                  type="time"
                  className="form-input w-full"
                  value={form.dayEndTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, dayEndTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">2日目開始時間</label>
                <input
                  type="time"
                  className="form-input w-full"
                  value={form.day2StartTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, day2StartTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">2日目終了時間</label>
                <input
                  type="time"
                  className="form-input w-full"
                  value={form.day2EndTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, day2EndTime: e.target.value }))}
                />
              </div>
            </div>

            {/* 昼休み設定 */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enableLunchBreak}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, enableLunchBreak: e.target.checked }))
                  }
                />
                <span className="text-sm">昼休みを設定</span>
              </label>
            </div>
            {form.enableLunchBreak && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">昼休み開始</label>
                  <input
                    type="time"
                    className="form-input w-full"
                    value={form.lunchBreakStart}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lunchBreakStart: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">昼休み終了</label>
                  <input
                    type="time"
                    className="form-input w-full"
                    value={form.lunchBreakEnd}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lunchBreakEnd: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {/* 決勝トーナメント設定 */}
            <h4 className="font-medium mt-4">決勝トーナメント設定</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">決勝開始時間</label>
                <input
                  type="time"
                  className="form-input w-full"
                  value={form.finalsStartTime}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, finalsStartTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">決勝日</label>
                <select
                  className="form-input w-full"
                  value={form.finalsDay}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, finalsDay: parseInt(e.target.value) }))
                  }
                >
                  <option value={1}>1日目</option>
                  <option value={2}>2日目</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">決勝試合時間（分）</label>
                <input
                  type="number"
                  className="form-input w-full"
                  value={form.finalsMatchDuration}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      finalsMatchDuration: parseInt(e.target.value) || 25,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">決勝インターバル（分）</label>
                <input
                  type="number"
                  className="form-input w-full"
                  value={form.finalsIntervalMinutes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      finalsIntervalMinutes: parseInt(e.target.value) || 5,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="mt-6 flex justify-end">
            <button className="btn-primary" onClick={onSave} disabled={isSaving}>
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
