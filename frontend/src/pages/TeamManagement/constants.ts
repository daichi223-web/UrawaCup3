// src/pages/TeamManagement/constants.ts

export const GROUP_TABS = ['全チーム', 'Aグループ', 'Bグループ', 'Cグループ', 'Dグループ'] as const
export type GroupTab = typeof GROUP_TABS[number]

export const GROUP_MAP: Record<GroupTab, string | null> = {
  '全チーム': null,
  'Aグループ': 'A',
  'Bグループ': 'B',
  'Cグループ': 'C',
  'Dグループ': 'D',
}
