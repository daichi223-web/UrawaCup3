import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ============================================
// タイムアウト付きPromise実行ユーティリティ
// ============================================

/**
 * Promiseにタイムアウトを追加する
 * @param promise 実行するPromise
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param errorMessage タイムアウト時のエラーメッセージ
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  errorMessage: string = 'リクエストがタイムアウトしました'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

// Vercel環境変数が設定されていない場合のフォールバック値
// Note: anon key は公開しても安全です（Row Level Security で保護されています）
const FALLBACK_SUPABASE_URL = 'https://ulpdvtxqtwtmpzcnkelz.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscGR2dHhxdHd0bXB6Y25rZWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDI3NjQsImV4cCI6MjA4MzI3ODc2NH0.9LoNuSbJVHWOn5D6mDNEkWTGVIgLEKL7pd5kUZ879Ek'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

// Debugging: Expose URL and log configuration source
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__SUPABASE_URL__ = supabaseUrl

  const isFallback = supabaseUrl === FALLBACK_SUPABASE_URL
  console.log(
    `%c[Supabase] Initializing... Using ${isFallback ? 'FALLBACK' : 'VITE ENV VARS'}`,
    'background: #333; color: #00d1b2; padding: 4px; border-radius: 4px;'
  )
}

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

// 開発環境または設定不備時にクラッシュしないようにする
const createSafeClient = () => {
  if (isSupabaseConfigured) {
    return createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  console.warn('Supabase env vars missing. Using dummy client.')

  // ダミークライアント（API呼び出しでエラーを返す）
  return new Proxy({} as SupabaseClient<Database>, {
    get: (_target, prop) => {
      // 認証関連のモック（AuthStoreの初期化で落ちないように）
      if (prop === 'auth') {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
          getSession: async () => ({ data: { session: null }, error: null }),
          signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Supabase not configured') }),
          signOut: async () => ({ error: null }),
        }
      }

      // channel（realtime）のモック
      if (prop === 'channel') {
        return () => ({
          on: () => ({ subscribe: () => { } }),
          subscribe: () => { },
          unsubscribe: () => { }
        })
      }

      // その他のメソッド呼び出し
      return () => {
        console.error(`Supabase not configured: Calling ${String(prop)}`)
        throw new Error('Supabase environment variables are missing. Please check your Vercel settings.')
      }
    }
  })
}

export const supabase = createSafeClient()

// 認証ヘルパー
export const auth = supabase.auth

// リアルタイムサブスクリプション用
export const realtime = supabase.channel('public')
