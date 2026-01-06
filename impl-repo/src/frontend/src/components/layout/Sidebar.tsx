import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  Calendar,
  ClipboardEdit,
  Trophy,
  FileText,
  Settings,
  UserCircle,
  ClipboardCheck,
  Ban,
  Award,
  CalendarDays,
  LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store/appStore'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  group: 'main' | 'management' | 'system'
}

const navItems: NavItem[] = [
  // メイン機能
  { path: '/', label: 'ダッシュボード', icon: Home, group: 'main' },
  { path: '/results', label: '試合結果入力', icon: ClipboardEdit, group: 'main' },
  { path: '/standings', label: '順位表', icon: Trophy, group: 'main' },
  { path: '/scorer-ranking', label: '得点ランキング', icon: Award, group: 'main' },
  { path: '/schedule', label: '日程管理', icon: Calendar, group: 'main' },
  { path: '/reports', label: '報告書出力', icon: FileText, group: 'main' },
  { path: '/approval', label: '結果承認', icon: ClipboardCheck, group: 'main' },
  { path: '/final-day', label: '最終日', icon: CalendarDays, group: 'main' },

  // 管理機能
  { path: '/teams', label: 'チーム管理', icon: Users, group: 'management' },
  { path: '/players', label: '選手管理', icon: UserCircle, group: 'management' },
  { path: '/exclusion', label: '対戦除外設定', icon: Ban, group: 'management' },

  // システム
  { path: '/settings', label: '設定', icon: Settings, group: 'system' },
]

const groupLabels: Record<string, string> = {
  main: 'メイン',
  management: '管理',
  system: 'システム',
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { currentTournament } = useAppStore()

  const groupedItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = []
    }
    acc[item.group].push(item)
    return acc
  }, {} as Record<string, NavItem[]>)

  return (
    <>
      {/* オーバーレイ（モバイル時） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* ロゴ・タイトル */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200 flex-shrink-0 bg-red-600">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-red-600" />
            </div>
            <span className="font-bold text-lg text-white truncate">
              {currentTournament?.name || '浦和カップ'}
            </span>
          </Link>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="flex-1 overflow-y-auto p-4">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="mb-6">
              <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {groupLabels[group]}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors',
                        isActive
                          ? 'bg-red-50 text-red-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      <Icon
                        size={20}
                        className={isActive ? 'text-red-600' : 'text-gray-400'}
                      />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* フッター */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            浦和カップ トーナメント管理
          </p>
        </div>
      </aside>
    </>
  )
}
