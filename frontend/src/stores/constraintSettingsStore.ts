/**
 * 制約設定ストア
 * 対戦回避条件の有効/無効を管理
 * 地域・リーグのマスタデータも管理
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

/** マスタデータ */
export interface MasterData {
  /** 地域一覧 */
  regions: string[]
  /** リーグ一覧 */
  leagues: string[]
}

interface ConstraintSettingsState {
  settings: ConstraintSettings
  masterData: MasterData
  setSettings: (settings: Partial<ConstraintSettings>) => void
  resetToDefaults: () => void
  // マスタデータ操作
  addRegion: (region: string) => void
  removeRegion: (region: string) => void
  addLeague: (league: string) => void
  removeLeague: (league: string) => void
}

const defaultSettings: ConstraintSettings = {
  avoidLocalVsLocal: false,
  avoidSameRegion: false,
  avoidSameLeague: false,
  avoidConsecutive: true,
  warnDailyGameLimit: true,
  warnTotalGameLimit: true,
}

const defaultMasterData: MasterData = {
  regions: [],
  leagues: [],
}

export const useConstraintSettingsStore = create<ConstraintSettingsState>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings },
      masterData: { ...defaultMasterData },
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetToDefaults: () =>
        set({ settings: { ...defaultSettings } }),
      // マスタデータ操作
      addRegion: (region) =>
        set((state) => ({
          masterData: {
            ...state.masterData,
            regions: state.masterData.regions.includes(region)
              ? state.masterData.regions
              : [...state.masterData.regions, region],
          },
        })),
      removeRegion: (region) =>
        set((state) => ({
          masterData: {
            ...state.masterData,
            regions: state.masterData.regions.filter((r) => r !== region),
          },
        })),
      addLeague: (league) =>
        set((state) => ({
          masterData: {
            ...state.masterData,
            leagues: state.masterData.leagues.includes(league)
              ? state.masterData.leagues
              : [...state.masterData.leagues, league],
          },
        })),
      removeLeague: (league) =>
        set((state) => ({
          masterData: {
            ...state.masterData,
            leagues: state.masterData.leagues.filter((l) => l !== league),
          },
        })),
    }),
    {
      name: 'constraint-settings',
    }
  )
)
