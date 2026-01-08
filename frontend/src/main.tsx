console.log('[Main] 1. Starting imports...')
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
console.log('[Main] 2. Base imports done')
import App from './App'
console.log('[Main] 3. App imported')
import './index.css'
console.log('[Main] 4. CSS imported')

// PWA: 同期サービスを初期化
import { initSyncService } from './lib/syncService'
console.log('[Main] 5. syncService imported')

// ============================================
// キャッシュクリーンアップ（起動時に実行）
// ============================================
const APP_VERSION = '2.0.0' // バージョンが変わるとキャッシュをクリア
const STORAGE_VERSION_KEY = 'urawa-cup-version'

async function cleanupOldCache() {
  try {
    // バージョンチェック
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY)
    if (storedVersion !== APP_VERSION) {
      console.log(`[Cleanup] App version changed: ${storedVersion} -> ${APP_VERSION}`)

      // 古いService Workerを強制解除
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
          console.log('[Cleanup] Service Worker unregistered')
        }
      }

      // Cache Storageをクリア
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName)
          console.log(`[Cleanup] Cache deleted: ${cacheName}`)
        }
      }

      // 認証関連のlocalStorageをクリア（古いデータとの不整合を防ぐ）
      localStorage.removeItem('urawa-cup-auth')
      localStorage.removeItem('urawa-cup-app')
      console.log('[Cleanup] Old localStorage data cleared')

      // 新しいバージョンを保存
      localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION)
    }
  } catch (error) {
    console.error('[Cleanup] Error during cache cleanup:', error)
  }
}

// クリーンアップを実行
cleanupOldCache()

// 同期サービスを開始
initSyncService()

// React Query クライアント設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分間キャッシュ
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
