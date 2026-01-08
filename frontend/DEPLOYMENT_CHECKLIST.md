# 本番デプロイ前チェックリスト

## 🔴 必須（デプロイ前に必ず確認）

### Vercel設定
- [ ] `VITE_SUPABASE_URL` を環境変数に設定
- [ ] `VITE_SUPABASE_ANON_KEY` を環境変数に設定
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Framework: `Vite`

### Supabase設定
- [ ] `schema.sql` を SQL Editor で実行済み
- [ ] Authentication → URL Configuration で本番URLを許可リストに追加
- [ ] anon key がGit履歴に含まれていた場合はローテーション実施

### RLS（Row Level Security）有効化確認
Supabase Dashboard → Table Editor → 各テーブル → RLS Enabled

- [ ] tournaments
- [ ] groups
- [ ] venues
- [ ] teams
- [ ] matches
- [ ] goals
- [ ] players
- [ ] standings
- [ ] profiles
- [ ] exclusion_pairs
- [ ] staff
- [ ] team_uniforms

### RLSポリシー確認
- [ ] `is_admin()` 関数が作成されている
- [ ] `can_edit_match()` 関数が作成されている
- [ ] 各テーブルにポリシーが設定されている

---

## 🟠 機能テスト

### 認証
- [ ] ログインできる（Supabase Auth）
- [ ] ログアウトできる
- [ ] セッションが維持される（リロード後も認証状態）
- [ ] 開発バイパス（admin/admin123）が本番で無効

### チーム管理
- [ ] チーム一覧が表示される
- [ ] チーム作成ができる
- [ ] チーム編集ができる
- [ ] 全角入力が正規化される（例：「チーム　ＡＢＣ」→「チーム ABC」）

### 選手管理
- [ ] 選手一覧が表示される
- [ ] 選手登録ができる
- [ ] 選手編集ができる
- [ ] 全角背番号が正規化される（例：「１０」→「10」）
- [ ] CSVインポートが動作する
- [ ] Excelインポートが動作する

### 会場管理
- [ ] 会場一覧が表示される
- [ ] 会場編集ができる
- [ ] 全角入力が正規化される

### 試合管理
- [ ] 試合一覧が表示される
- [ ] 試合結果入力ができる
- [ ] 得点者登録ができる
- [ ] 試合ステータス変更ができる

### 順位表
- [ ] グループ別順位表が表示される
- [ ] 順位計算が正しい

### 公開ページ
- [ ] `/public/matches` が表示される
- [ ] `/public/standings` が表示される
- [ ] `/public/scorers` が表示される
- [ ] `/test` が本番で非表示（404になる）

### PWA
- [ ] Service Worker が登録される
- [ ] オフライン時にエラーにならない
- [ ] インストールプロンプトが表示される（対応ブラウザ）

---

## 🟡 スキーマ追加（必要に応じて）

### teams テーブル
- [ ] `region` カラム追加（対戦除外自動提案機能用）
```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region VARCHAR(50);
```

### Realtime有効化
Supabase Dashboard → Database → Replication
- [ ] matches テーブル
- [ ] goals テーブル
- [ ] standings テーブル

---

## 🔵 未実装機能（Edge Functions）

以下の機能は `console.warn` のスタブのみで、サーバーサイドロジックが未実装：

| 機能 | 必要性 | 代替案 |
|------|--------|--------|
| 日程自動生成 | 高 | 手動で日程作成 |
| 研修試合生成 | 中 | 手動で作成 |
| 決勝T生成 | 高 | 手動で作成 |
| 最終日スケジュール | 高 | 手動で作成 |
| 報告書生成API | 低 | クライアント側PDF生成は実装済み |

---

## ⚪ コード品質（推奨）

### DEPRECATEDコード削除
- [ ] `stores/teamStore.ts` - 削除またはSupabase移行
- [ ] `stores/standingStore.ts` - 削除またはSupabase移行
- [ ] `hooks/useApi.ts` - 削除
- [ ] `core/sync/queue.ts` - 削除
- [ ] `core/auth/manager.ts` - authStoreと統合

### Realtime統合
- [ ] `hooks/useWebSocket.ts` → Supabase Realtime に置き換え
- [ ] `hooks/useRealtimeUpdates.ts` → postgres_changes 使用に変更

---

## 📱 動作確認環境

### ブラウザ
- [ ] Chrome（PC）
- [ ] Safari（PC）
- [ ] Chrome（スマートフォン）
- [ ] Safari（iPhone）

### 画面サイズ
- [ ] デスクトップ（1920x1080）
- [ ] タブレット（768x1024）
- [ ] スマートフォン（375x667）

---

## 🚨 トラブルシューティング

### HTTPステータスコード別エラー対策

#### 400 Bad Request
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| camelCase→snake_case変換漏れ | API送信データのフィールド名確認 | `lib/api.ts` の各update/create関数 |
| 必須フィールド欠落 | 必須項目の入力チェック追加 | フォームのバリデーション |
| 型の不一致（string→number等） | 型変換を確認 | 背番号、ID等の数値フィールド |
| 不正なENUM値 | 定義済みENUM値のみ使用 | `match_status`, `team_type` 等 |
| JSON形式エラー | リクエストボディの形式確認 | Content-Type: application/json |

#### 401 Unauthorized
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| 未ログイン | ログインページへリダイレクト | `RequireAdmin`, `RequireVenueManager` |
| トークン期限切れ | セッションリフレッシュ | `authStore.checkAuth()` |
| 無効なトークン | 再ログイン促進 | `supabase.auth.getSession()` |
| anon key 未設定 | 環境変数確認 | `VITE_SUPABASE_ANON_KEY` |

#### 402 Payment Required
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| Supabaseプラン制限 | プランアップグレード | Supabase Dashboard |
| API呼び出し上限 | リクエスト数最適化 | バッチ処理、キャッシュ |

#### 403 Forbidden
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| RLSポリシー違反 | ポリシー設定確認 | 各テーブルのRLSポリシー |
| 権限不足（admin以外がadmin機能使用） | 権限チェック追加 | `hasRole()`, `canEditVenue()` |
| venue_staff が他会場を編集 | venue_id チェック | `authStore.canEditVenue()` |

#### 404 Not Found
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| 存在しないIDでアクセス | 存在確認後に処理 | `.single()` の前に件数確認 |
| テーブル未作成 | schema.sql実行 | Supabase SQL Editor |
| 削除済みデータへのアクセス | エラーハンドリング追加 | try-catchでユーザー通知 |
| ルーティングミス | パス確認 | App.tsx のRoute定義 |
| Vercel rewrite設定漏れ | vercel.json確認 | SPAルーティング設定 |

#### 405 Method Not Allowed
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| HTTPメソッド間違い | GET/POST/PATCH/DELETE確認 | Supabase APIドキュメント |
| Edge Function未実装 | 機能実装またはスタブ | console.warn箇所 |

#### 409 Conflict
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| 重複データ挿入 | UNIQUE制約確認 | team名、選手番号等 |
| 同時編集競合 | 楽観的ロック実装 | version フィールド |

#### 422 Unprocessable Entity
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| バリデーションエラー | 入力値検証強化 | フォーム送信前チェック |
| 外部キー制約違反 | 参照先存在確認 | tournament_id, team_id等 |

#### 500 Internal Server Error
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| Edge Function エラー | ログ確認、デバッグ | Supabase Dashboard → Logs |
| DBトリガーエラー | トリガー関数確認 | schema.sql のtrigger |

#### 503 Service Unavailable
| 原因 | 対処法 | 確認箇所 |
|------|--------|---------|
| Supabase メンテナンス | ステータス確認 | status.supabase.com |
| レート制限 | リクエスト間隔調整 | バッチ処理実装 |

---

### Supabase固有のエラー

| エラーメッセージ | 原因 | 対処 |
|-----------------|------|------|
| `relation "xxx" does not exist` | テーブル未作成 | schema.sql を実行 |
| `permission denied for table xxx` | RLS有効だがポリシー未設定 | ポリシー追加 |
| `new row violates row-level security policy` | RLSポリシー違反 | ユーザー権限確認 |
| `duplicate key value violates unique constraint` | 重複データ | UNIQUE制約確認 |
| `null value in column "xxx" violates not-null constraint` | 必須フィールドがnull | 入力バリデーション |
| `invalid input syntax for type xxx` | 型変換エラー | データ型確認 |
| `JWT expired` | セッション期限切れ | refreshSession() |
| `Invalid API key` | anon key 間違い | 環境変数確認 |
| `FetchError: Failed to fetch` | ネットワーク/CORS | URL設定確認 |

---

### フロントエンド共通エラー

| エラー | 原因 | 対処 |
|--------|------|------|
| `Cannot read properties of undefined` | データ未取得でアクセス | Optional chaining (`?.`) 使用 |
| `Objects are not valid as a React child` | オブジェクトを直接表示 | JSON.stringify または プロパティ抽出 |
| `Each child should have unique key` | リストのkey重複 | ユニークなID使用 |
| `Maximum update depth exceeded` | 無限ループ | useEffect依存配列確認 |

---

## 更新履歴
- 2024-01-07: 初版作成
- 2024-01-07: エラー対策詳細追加
