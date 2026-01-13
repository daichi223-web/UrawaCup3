/**
 * 制約設定ストア
 * 対戦回避条件の有効/無効を管理
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConstraintSettings {
  /** 地元チーム同士の対戦を避ける */
  avoidLocalVsLocal: boolean
  /** 同一地域チーム同士の対戦を避ける */
  avoidSameRegion: boolean
  /** 同一リーグチーム同士の対戦を避ける */
  avoidSameLeague: boolean
  /** 連戦を避ける */
  avoidConsecutive: boolean
  /** 1日3試合以上を警告 */
  warnDailyGameLimit: boolean
  /** 2日間で5試合以上を警告 */
  warnTotalGameLimit: boolean
}

interface ConstraintSettingsState {
  settings: ConstraintSettings
  setSettings: (settings: Partial<ConstraintSettings>) => void
  resetToDefaults: () => void
}

const defaultSettings: ConstraintSettings = {
  avoidLocalVsLocal: false,
  avoidSameRegion: false,
  avoidSameLeague: false,
  avoidConsecutive: true,
  warnDailyGameLimit: true,
  warnTotalGameLimit: true,
}

export const useConstraintSettingsStore = create<ConstraintSettingsState>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings },
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetToDefaults: () =>
        set({ settings: { ...defaultSettings } }),
    }),
    {
      name: 'constraint-settings',
    }
  )
)
