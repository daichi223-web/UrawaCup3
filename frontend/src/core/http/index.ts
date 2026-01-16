/**
 * DEPRECATED: 古いHTTP APIモジュール
 *
 * Supabaseに移行しました。@/lib/api を使用してください。
 * このファイルは後方互換性のために残していますが、
 * すべての呼び出しはエラーを投げます。
 */

const deprecatedError = (method: string) => {
  const error = new Error(
    `[DEPRECATED] ${method}() は廃止されました。` +
    `@/lib/api の Supabase API を使用してください。`
  );
  console.error(error.message);
  throw error;
};

// 古いAPIクライアントのスタブ
export const httpClient = {
  get: () => deprecatedError('httpClient.get'),
  post: () => deprecatedError('httpClient.post'),
  put: () => deprecatedError('httpClient.put'),
  patch: () => deprecatedError('httpClient.patch'),
  delete: () => deprecatedError('httpClient.delete'),
};

// 互換性のためのダミーエクスポート
export const authInterceptor = () => deprecatedError('authInterceptor');
export const errorInterceptor = () => deprecatedError('errorInterceptor');
export const transformInterceptor = () => deprecatedError('transformInterceptor');
export const apiRequest = () => deprecatedError('apiRequest');
export const createUploadConfig = () => deprecatedError('createUploadConfig');
export const downloadFile = () => deprecatedError('downloadFile');
export const retryRequest = () => deprecatedError('retryRequest');

export type ApiError = Error;
export type ApiSuccessResponse<T> = { data: T };
export type ApiErrorResponse = { error: string };
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export default httpClient;
