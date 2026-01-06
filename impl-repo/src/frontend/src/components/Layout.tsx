/**
 * メインレイアウトコンポーネント
 * 左サイドバー + ヘッダー + メインコンテンツ
 */

import { ReactNode, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Header } from './layout/Header'
import { Sidebar } from './layout/Sidebar'
import { OfflineIndicator } from './pwa/OfflineIndicator'
import { UpdatePrompt } from './pwa/UpdatePrompt'
import { useAppStore } from '../store/appStore'
import { useRealtimeUpdates } from '../hooks/useRealtimeUpdates'

interface Tournament {
  id: number
  name: string
  year: number | null
}

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { currentTournament, setCurrentTournament } = useAppStore()

  // WebSocketリアルタイム更新を有効化
  useRealtimeUpdates()

  // 大会一覧を取得
  const { data: tournaments } = useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await axios.get('/api/tournaments')
      return res.data
    },
  })

  // 初回ロード時に大会を自動選択
  useEffect(() => {
    if (tournaments && tournaments.length > 0 && !currentTournament) {
      setCurrentTournament(tournaments[0])
    }
  }, [tournaments, currentTournament, setCurrentTournament])

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev)
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* サイドバー */}
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      {/* メインコンテンツ */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          {/* トーナメント未選択警告 */}
          {!currentTournament && tournaments && tournaments.length === 0 && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-yellow-700">
                大会が登録されていません。設定画面から大会を作成してください。
              </p>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* PWAコンポーネント */}
      <OfflineIndicator />
      <UpdatePrompt />
    </div>
  )
}
