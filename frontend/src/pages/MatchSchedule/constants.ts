// src/pages/MatchSchedule/constants.ts
// 日程管理画面の定数

import type { TabInfo } from './types'

export const TABS: TabInfo[] = [
  { key: 'day1', label: 'Day1', dayOffset: 0, description: '予選リーグ1日目' },
  { key: 'day2', label: 'Day2', dayOffset: 1, description: '予選リーグ2日目' },
  { key: 'day3', label: 'Day3', dayOffset: 2, description: '決勝トーナメント・研修試合' },
]

export const GROUP_COLORS: Record<string, { bg: string; border: string; header: string; dot?: string }> = {
  A: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  B: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  C: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  D: { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  E: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  F: { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-pink-100 text-pink-800', dot: 'bg-pink-500' },
  G: { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  H: { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500' },
  default: { bg: 'bg-gray-50', border: 'border-gray-200', header: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' },
}

export const VENUE_COLORS_LIST = [
  { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800' },
  { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100 text-green-800' },
  { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100 text-yellow-800' },
  { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-pink-100 text-pink-800' },
  { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-100 text-orange-800' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-cyan-100 text-cyan-800' },
]
