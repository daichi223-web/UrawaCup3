/**
 * Service Worker for UrawaCup PWA
 *
 * キャッシュ戦略:
 * - 静的アセット: Cache First
 * - API: Network First with Cache Fallback
 * - オフライン時: キャッシュから返却
 */

const CACHE_NAME = 'urawacup-v1';
const STATIC_CACHE = 'urawacup-static-v1';
const API_CACHE = 'urawacup-api-v1';

// キャッシュする静的ファイル
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// キャッシュするAPIパス
const CACHEABLE_API_PATHS = [
  '/api/public/tournaments',
  '/api/public/standings',
  '/api/public/matches',
  '/api/public/scorers',
];

// インストールイベント
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    })
  );

  // 新しいSWを即座にアクティブ化
  self.skipWaiting();
});

// アクティベートイベント
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // 即座にクライアントを制御
  self.clients.claim();
});

// フェッチイベント
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // APIリクエスト
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // 静的ファイル
  event.respondWith(cacheFirstWithNetwork(request));
});

/**
 * Network First with Cache Fallback
 * API用：まずネットワークを試し、失敗したらキャッシュ
 */
async function networkFirstWithCache(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    // 成功したらキャッシュを更新（GETリクエストのみ）
    if (response.ok && request.method === 'GET') {
      const isCacheable = CACHEABLE_API_PATHS.some((path) =>
        url.pathname.startsWith(path)
      );

      if (isCacheable) {
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
      }
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // オフラインフォールバック（GETのみ）
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          error: 'offline',
          message: 'オフラインです。ネットワーク接続を確認してください。',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    throw error;
  }
}

/**
 * Cache First with Network Fallback
 * 静的ファイル用：まずキャッシュを試し、なければネットワーク
 */
async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    // 成功したらキャッシュに追加
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Fetch failed:', request.url);

    // HTMLリクエストの場合はオフラインページを返す
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-match-results') {
    event.waitUntil(syncMatchResults());
  }
});

/**
 * 試合結果の同期
 */
async function syncMatchResults() {
  // IndexedDBからペンディングデータを取得して送信
  // 実際の実装はsyncService.tsで行う
  console.log('[SW] Syncing match results...');
}

// プッシュ通知（将来の拡張用）
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || '新しい更新があります',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '浦和カップ', options)
  );
});

// 通知クリック
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
