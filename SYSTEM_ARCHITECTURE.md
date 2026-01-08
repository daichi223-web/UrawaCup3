# 浦和カップ トーナメント管理システム - システム構成書

**最終更新**: 2026-01-07

---

## 1. システム概要

浦和カップ（さいたま市招待高校サッカーフェスティバル）のトーナメント管理システム。
3日間で行われる大規模な高校サッカー大会の運営管理を目的とする。

### 1.1 本番環境
| 項目 | サービス | URL |
|------|----------|-----|
| フロントエンド | Vercel | https://urawa-cup2.vercel.app |
| データベース | Supabase | https://ulpdvtxqtwtmpzcnkelz.supabase.co |
| 認証 | Supabase Auth | 同上 |

### 1.2 主な技術スタック
- **フロントエンド**: React 18 + TypeScript + Vite + Tailwind CSS
- **状態管理**: Zustand + TanStack Query
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **リアルタイム**: Supabase Realtime (WebSocket)
- **ホスティング**: Vercel

---

## 2. ディレクトリ構造

### 2.1 使用中のコード（Supabase版）
```
D:\UrawaCup2\UrawaCup\new\src\
├── frontend/                    # メインのフロントエンド
│   ├── src/
│   │   ├── App.tsx             # ルーティング定義
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase初期化
│   │   │   ├── api.ts          # ★ 全APIコール（重要）
│   │   │   └── database.types.ts
│   │   ├── features/           # 機能別API
│   │   │   ├── matches/api.ts  # ★ 試合API（順位表更新含む）
│   │   │   ├── standings/api.ts
│   │   │   └── ...
│   │   ├── pages/              # ページコンポーネント
│   │   │   ├── MatchResult.tsx # 試合結果入力
│   │   │   ├── Standings.tsx   # 順位表（管理用）
│   │   │   └── public/         # 公開ページ
│   │   │       ├── PublicStandings.tsx  # ★ 公開順位表
│   │   │       └── ...
│   │   ├── stores/             # Zustand状態管理
│   │   │   └── authStore.ts    # ★ 認証状態
│   │   └── hooks/
│   │       └── useRealtimeUpdates.ts  # リアルタイム更新
│   ├── .env                    # 環境変数（Supabase設定）
│   └── .env.production
└── backend/                    # FastAPI（現在未使用）
```

### 2.2 Supabaseスキーマ
```
D:\UrawaCup2\UrawaCup\new\supabase\
├── schema.sql                  # テーブル定義・RLS
└── seed.sql                    # サンプルデータ
```

### 2.3 アーカイブ済み（未使用）
```
D:\UrawaCup2\impl-repo_archived_20260107\   # FastAPI版（旧実装・2026-01-07アーカイブ）
```
※ 削除しても問題なし

---

## 3. データベース構造

### 3.1 主要テーブル

| テーブル | 説明 |
|----------|------|
| tournaments | 大会情報 |
| groups | グループ(A/B/C/D) |
| teams | チーム |
| matches | 試合 |
| goals | 得点 |
| standings | 順位表 |
| venues | 会場 |
| players | 選手 |
| profiles | ユーザープロファイル（Supabase Auth連携） |

### 3.2 順位表（standings）の構造
```sql
tournament_id  -- 大会ID
group_id       -- グループ (A/B/C/D)
team_id        -- チームID
played         -- 試合数
won            -- 勝利数
drawn          -- 引分数
lost           -- 敗北数
goals_for      -- 得点
goals_against  -- 失点
goal_difference -- 得失点差
points         -- 勝点 (勝=3, 分=1)
rank           -- 順位
```

### 3.3 試合（matches）の重要フィールド
```sql
status         -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
stage          -- 'preliminary' | 'semifinal' | 'third_place' | 'final' | 'training'
group_id       -- グループID（予選リーグの場合）
home_score_total, away_score_total  -- 合計スコア
result         -- 'home_win' | 'away_win' | 'draw'（自動計算）
```

---

## 4. 主要な機能フロー

### 4.1 試合結果入力 → 順位表更新

```
[MatchResult.tsx] 試合結果入力
        ↓
[features/matches/api.ts] matchApi.updateScore()
        ↓
    ┌───────────────────────────────────────┐
    │ 1. matchesテーブルにスコア保存        │
    │ 2. goalsテーブルに得点者保存          │
    │ 3. standingsApi.recalculate() 呼出し  │
    └───────────────────────────────────────┘
        ↓
[lib/api.ts] standingsApi.recalculate()
        ↓
    ┌───────────────────────────────────────┐
    │ 1. 該当グループの完了済み試合を取得   │
    │ 2. チームごとの勝敗・得失点を集計     │
    │ 3. 勝点計算 (勝=3, 分=1)             │
    │ 4. ソート (勝点→得失点差→総得点)     │
    │ 5. standingsテーブルを更新           │
    └───────────────────────────────────────┘
        ↓
[PublicStandings.tsx] 30秒ごとに自動更新
```

### 4.2 認証フロー

```
[Login] ユーザー名・パスワード入力
        ↓
[authStore.ts] login()
        ↓
    ┌───────────────────────────────────────┐
    │ 開発環境: admin/admin123 でバイパス   │
    │ 本番環境: Supabase Auth で認証        │
    └───────────────────────────────────────┘
        ↓
profiles テーブルからロール取得
        ↓
admin / venue_staff / viewer
```

---

## 5. 重要ファイル一覧

### 5.1 API関連（最重要）
| ファイル | 役割 |
|----------|------|
| `lib/api.ts` | 全Supabase APIコール（standingsApi.recalculate含む） |
| `features/matches/api.ts` | 試合API（スコア入力→順位表更新をトリガー） |
| `features/standings/api.ts` | 順位表API（ラッパー） |

### 5.2 ページ
| ファイル | 役割 |
|----------|------|
| `pages/MatchResult.tsx` | 試合結果入力（管理用） |
| `pages/Standings.tsx` | 順位表（管理用） |
| `pages/public/PublicStandings.tsx` | 順位表（公開用・30秒自動更新） |
| `pages/public/PublicMatchList.tsx` | 試合一覧（公開用） |

### 5.3 状態管理
| ファイル | 役割 |
|----------|------|
| `stores/authStore.ts` | 認証状態（ログイン/ログアウト） |
| `stores/appStore.ts` | アプリ状態（選択中の大会など） |

---

## 6. 環境変数

### 6.1 フロントエンド (.env)
```
VITE_SUPABASE_URL=https://ulpdvtxqtwtmpzcnkelz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_APP_NAME=浦和カップ トーナメント管理システム
VITE_ENABLE_DEBUG_MODE=true
```

### 6.2 Vercel環境変数
同じ変数をVercelのProject Settings → Environment Variablesに設定

---

## 7. デプロイ方法

### 7.1 Vercelへのデプロイ
```bash
cd D:\UrawaCup2\UrawaCup3\frontend
git add -A
git commit -m "変更内容"
git push origin main
```
→ Vercelが自動でビルド・デプロイ

### 7.2 Supabaseスキーマ更新
1. Supabase Dashboard → SQL Editor
2. `supabase/schema.sql` の内容を実行

---

## 8. トラブルシューティング

### 8.1 順位表が更新されない
**原因**: `recalculate()` が呼ばれていない、または条件を満たしていない

**確認ポイント**:
1. ブラウザコンソール(F12)で `[Standings]` ログを確認
2. 試合の `group_id` が設定されているか
3. 試合の `status` が `completed` か

**修正箇所**: `features/matches/api.ts` の `updateScore()`

### 8.2 ログインできない
**原因**: Supabase Authにユーザーがいない、または開発モードでない

**対処**:
- 開発環境: `npm run dev` で起動（admin/admin123が使える）
- 本番環境: Supabase Dashboard → Authentication → Usersでユーザー作成

### 8.3 リアルタイム更新が動かない
**確認ポイント**:
1. Supabase Dashboard → Database → Replication で該当テーブルが有効か
2. RLSポリシーでSELECTが許可されているか

---

## 9. 今後の課題

1. ~~**FastAPIバックエンド削除**~~: 2026-01-07 アーカイブ済み（`impl-repo_archived_20260107`）
2. **エラーハンドリング統一**: 各ページでのエラー表示を統一
3. **テスト拡充**: E2Eテスト（Playwright）のカバレッジ向上
4. **型安全性向上**: `database.types.ts` をSupabase CLIで自動生成

---

## 10. 連絡先・参考リンク

- **Supabase Dashboard**: https://supabase.com/dashboard/project/ulpdvtxqtwtmpzcnkelz
- **Vercel Dashboard**: https://vercel.com/
- **本番URL**: https://urawa-cup2.vercel.app
