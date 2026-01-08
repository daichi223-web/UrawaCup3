/**
 * エラーハンドリングユーティリティ
 *
 * Supabase/API エラーを統一的に処理
 */

import toast from 'react-hot-toast';

/**
 * HTTPステータスコード別エラーメッセージ
 */
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: '入力データに問題があります。入力内容を確認してください。',
  401: 'ログインが必要です。再度ログインしてください。',
  402: 'サービスの利用制限に達しました。',
  403: 'この操作を行う権限がありません。',
  404: '指定されたデータが見つかりません。',
  405: 'この操作は許可されていません。',
  409: 'データの競合が発生しました。ページを更新してください。',
  422: '入力データの形式が正しくありません。',
  429: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
  500: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
  502: 'サーバーに接続できません。',
  503: 'サービスが一時的に利用できません。',
  504: 'サーバーからの応答がありません。',
};

/**
 * Supabaseエラーメッセージの日本語変換
 */
const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  'relation does not exist': 'テーブルが存在しません。管理者に連絡してください。',
  'permission denied': 'この操作を行う権限がありません。',
  'violates row-level security policy': 'この操作を行う権限がありません。',
  'duplicate key value violates unique constraint': 'このデータは既に登録されています。',
  'violates not-null constraint': '必須項目が入力されていません。',
  'invalid input syntax': '入力形式が正しくありません。',
  'JWT expired': 'セッションの有効期限が切れました。再度ログインしてください。',
  'Invalid API key': 'API設定に問題があります。管理者に連絡してください。',
  'Failed to fetch': 'サーバーに接続できません。ネットワーク接続を確認してください。',
  'invalid input value for enum': '選択肢の値が不正です。',
  'foreign key violation': '関連するデータが存在しません。',
  'violates foreign key constraint': 'このチームは試合に登録されているため削除できません。先に関連する試合を削除してください。',
};

/**
 * エラーオブジェクトの型
 */
interface SupabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * エラーメッセージを取得
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return '不明なエラーが発生しました。';

  // Supabase/PostgreSQL エラー
  if (typeof error === 'object' && error !== null) {
    const supaError = error as SupabaseError;

    // HTTPステータスコードからメッセージ取得
    if (supaError.status && HTTP_ERROR_MESSAGES[supaError.status]) {
      return HTTP_ERROR_MESSAGES[supaError.status];
    }

    // エラーメッセージから日本語変換
    const message = supaError.message || supaError.details || '';
    for (const [key, value] of Object.entries(SUPABASE_ERROR_MESSAGES)) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    // 元のメッセージを返す
    if (message) return message;
  }

  // 文字列エラー
  if (typeof error === 'string') {
    for (const [key, value] of Object.entries(SUPABASE_ERROR_MESSAGES)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return error;
  }

  // Errorオブジェクト
  if (error instanceof Error) {
    for (const [key, value] of Object.entries(SUPABASE_ERROR_MESSAGES)) {
      if (error.message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return error.message;
  }

  return '不明なエラーが発生しました。';
}

/**
 * エラーをトーストで表示
 */
export function showError(error: unknown, customMessage?: string): void {
  const message = customMessage || getErrorMessage(error);
  toast.error(message);

  // 開発環境ではコンソールにも出力
  if (import.meta.env.DEV) {
    console.error('[Error]', error);
  }
}

/**
 * API呼び出しをラップしてエラーハンドリング
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    errorMessage?: string;
    showToast?: boolean;
    rethrow?: boolean;
  }
): Promise<T | null> {
  const { errorMessage, showToast = true, rethrow = false } = options || {};

  try {
    return await fn();
  } catch (error) {
    if (showToast) {
      showError(error, errorMessage);
    }
    if (rethrow) {
      throw error;
    }
    return null;
  }
}

/**
 * 401エラーかどうかチェック
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const supaError = error as SupabaseError;
    if (supaError.status === 401) return true;
    if (supaError.message?.includes('JWT expired')) return true;
    if (supaError.code === 'PGRST301') return true;
  }
  return false;
}

/**
 * 403エラーかどうかチェック
 */
export function isForbiddenError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const supaError = error as SupabaseError;
    if (supaError.status === 403) return true;
    if (supaError.message?.includes('permission denied')) return true;
    if (supaError.message?.includes('row-level security')) return true;
  }
  return false;
}

/**
 * 404エラーかどうかチェック
 */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const supaError = error as SupabaseError;
    if (supaError.status === 404) return true;
    if (supaError.code === 'PGRST116') return true; // single row not found
  }
  return false;
}

/**
 * ネットワークエラーかどうかチェック
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as SupabaseError).message || '';
    if (message.includes('Failed to fetch')) return true;
    if (message.includes('Network request failed')) return true;
  }
  return false;
}

/**
 * バリデーションエラーかどうかチェック
 */
export function isValidationError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const supaError = error as SupabaseError;
    if (supaError.status === 400 || supaError.status === 422) return true;
    if (supaError.message?.includes('violates')) return true;
    if (supaError.message?.includes('invalid input')) return true;
  }
  return false;
}
