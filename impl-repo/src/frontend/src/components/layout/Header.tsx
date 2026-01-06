import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Trophy,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'

interface Tournament {
  id: number
  name: string
  year: number | null
}

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ isSidebarOpen, onToggleSidebar }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { user, isAuthenticated, currentTournament, setCurrentTournament, logout } = useAppStore()
  const navigate = useNavigate()

  // 大会一覧を取得
  const { data: tournaments } = useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await axios.get('/api/tournaments')
      return res.data
    },
  })

  const handleTournamentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10)
    const tournament = tournaments?.find((t) => t.id === id)
    if (tournament) {
      setCurrentTournament(tournament)
    }
  }

  const handleLogout = () => {
    logout()
    setIsUserMenuOpen(false)
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-200 lg:pl-64">
      <div className="flex items-center justify-between h-full px-4">
        {/* 左側: モバイルメニューボタン */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={isSidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* モバイル用ロゴ */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              {currentTournament?.name || '浦和カップ'}
            </span>
          </Link>

          {/* 大会選択（デスクトップ） */}
          <div className="hidden lg:block">
            {tournaments && tournaments.length > 0 && (
              <select
                value={currentTournament?.id ?? ''}
                onChange={handleTournamentChange}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="" disabled>大会を選択</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.year && `(${t.year})`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 右側: ユーザーメニュー */}
        <div className="flex items-center gap-3">
          {/* 大会選択（モバイル） */}
          {tournaments && tournaments.length > 0 && (
            <select
              value={currentTournament?.id ?? ''}
              onChange={handleTournamentChange}
              className="lg:hidden px-2 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white"
            >
              <option value="" disabled>大会選択</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* ユーザーメニュー */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="ユーザーメニュー"
            >
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <User size={18} className="text-red-600" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {isAuthenticated ? user?.displayName : 'ゲスト'}
              </span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {/* ドロップダウンメニュー */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  {isAuthenticated ? (
                    <>
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user?.role === 'admin' && '管理者'}
                          {user?.role === 'venue_staff' && '会場担当者'}
                          {user?.role === 'viewer' && '閲覧者'}
                        </p>
                      </div>
                      <Link
                        to="/settings"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Settings size={16} />
                        設定
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} />
                        ログアウト
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <User size={16} />
                      ログイン
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
