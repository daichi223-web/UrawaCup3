# Supabase移行 実装チェックリスト

## 🔴 セキュリティ（必須）

### 環境変数
- [ ] `.env.production` が `.gitignore` に含まれている
- [ ] Supabase anon key が Vercel 環境変数で設定されている（ファイルにハードコードしない）
- [ ] 本番デプロイ前に anon key をローテーション（既にGitに入っていた場合）

### 認証
- [ ] 開発用バイパス（admin/admin123）が `import.meta.env.DEV` で制限されている
- [ ] `/test` ルートが開発環境のみに制限されている
- [ ] `dev-token` が本番で使用されていない

### RLS（Row Level Security）
- [ ] Supabase Dashboard で全テーブルの RLS が「Enabled」になっている
- [ ] 以下のテーブルでRLSを確認:
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

---

## 🟠 データベース

### スキーマ適用
- [ ] `schema.sql` が本番 Supabase に適用済み
- [ ] `seed.sql` で初期データ投入済み（必要な場合）

### ENUM型の確認
```sql
-- 以下のENUMが正しく作成されているか確認
SELECT typname FROM pg_type WHERE typname IN (
  'team_type', 'match_stage', 'match_status',
  'match_result', 'approval_status', 'user_role'
);
```

### テーブル構造
- [ ] `teams` テーブルに `region` カラムを追加（対戦除外提案機能用）
```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region VARCHAR(50);
```

### Realtime有効化
- [ ] Supabase Dashboard → Database → Replication で以下を有効化:
  - [ ] matches
  - [ ] goals
  - [ ] standings

---

## 🟡 API実装時の注意点

### snake_case ↔ camelCase 変換

**Supabaseからの取得時（snake_case → camelCase）:**
```typescript
// ❌ 悪い例
const team = data.team_name;

// ✅ 良い例
const team = {
  teamName: data.team_name,
  shortName: data.short_name,
  groupId: data.group_id,
};
```

**Supabaseへの送信時（camelCase → snake_case）:**
```typescript
// ❌ 悪い例
await supabase.from('teams').update({ teamName: 'foo' });

// ✅ 良い例
await supabase.from('teams').update({ team_name: 'foo' });
```

### 必須の変換フィールド一覧

| TypeScript (camelCase) | Database (snake_case) |
|-----------------------|----------------------|
| `tournamentId` | `tournament_id` |
| `teamType` | `team_type` |
| `shortName` | `short_name` |
| `groupId` | `group_id` |
| `homeTeamId` | `home_team_id` |
| `awayTeamId` | `away_team_id` |
| `matchDate` | `match_date` |
| `matchTime` | `match_time` |
| `venueId` | `venue_id` |
| `homeScoreHalf1` | `home_score_half1` |
| `homeScoreHalf2` | `home_score_half2` |
| `awayScoreHalf1` | `away_score_half1` |
| `awayScoreHalf2` | `away_score_half2` |
| `approvalStatus` | `approval_status` |
| `matchStage` | `match_stage` |
| `matchStatus` | `match_status` |
| `isLocked` | `is_locked` |
| `playerId` | `player_id` |
| `scoredAt` | `scored_at` |
| `isOwnGoal` | `is_own_goal` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

---

## 🔵 Edge Functions（未実装）

### 実装が必要な機能

| 機能 | ファイル | 優先度 |
|------|---------|--------|
| 日程自動生成 | `features/matches/api.ts:135` | 高 |
| 研修試合生成 | `features/matches/api.ts:142` | 中 |
| 決勝T生成 | `features/matches/api.ts:148` | 高 |
| 最終日スケジュール | `features/final-day/api.ts:81` | 高 |
| 報告書生成 | `features/reports/api.ts:19` | 中 |

### Edge Function 実装テンプレート
```typescript
// supabase/functions/generate-schedule/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ロジック実装

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### フロントエンドからの呼び出し
```typescript
// Edge Function を呼び出す場合
const { data, error } = await supabase.functions.invoke('generate-schedule', {
  body: { tournamentId: 1 }
})
```

---

## 🟣 Realtime実装

### 現在の状態
- `useWebSocket.ts` → ダミー実装（何もしない）
- `useRealtimeUpdates.ts` → 旧WebSocket向け

### 推奨実装パターン
```typescript
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useMatchRealtime(tournamentId: number, onUpdate: (match: Match) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`matches:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`
        },
        (payload) => {
          onUpdate(payload.new as Match)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, onUpdate])
}
```

---

## ⚪ 型定義

### database.types.ts の生成
```bash
# Supabase CLI で型を自動生成
npx supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
```

### 型のインポート
```typescript
import type { Database } from '@/lib/database.types'

type Match = Database['public']['Tables']['matches']['Row']
type MatchInsert = Database['public']['Tables']['matches']['Insert']
type MatchUpdate = Database['public']['Tables']['matches']['Update']
```

---

## 📋 デプロイ前の最終チェック

### Vercel設定
- [ ] Environment Variables に設定:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Build & Development Settings が正しい:
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Framework: `Vite`

### Supabase設定
- [ ] Authentication → URL Configuration で本番URLを許可
- [ ] Authentication → Email Templates をカスタマイズ（必要な場合）
- [ ] Database → Extensions で必要な拡張を有効化

### 動作確認
- [ ] ログイン/ログアウトが動作する
- [ ] データの取得ができる
- [ ] データの作成/更新/削除ができる
- [ ] リアルタイム更新が動作する（実装後）
- [ ] PWAとしてインストールできる
- [ ] オフライン時にエラーにならない

---

## 🚨 よくあるエラーと対処法

### "relation does not exist"
```
原因: テーブルが作成されていない
対処: schema.sql を Supabase SQL Editor で実行
```

### "permission denied for table"
```
原因: RLSポリシーが未設定または不適切
対処:
1. RLSが有効か確認
2. ポリシーが正しく設定されているか確認
3. anon key ではなく service_role key が必要な操作かもしれない
```

### "JWT expired"
```
原因: セッショントークンの期限切れ
対処: supabase.auth.refreshSession() を呼び出す
```

### "Failed to fetch"
```
原因: CORS設定、またはSupabase URLの誤り
対処:
1. VITE_SUPABASE_URL が正しいか確認
2. Supabase Dashboard → API → CORS で許可URLを確認
```

### 400 Bad Request（PATCH/POST時）
```
原因: snake_case/camelCase の不一致
対処: 送信データのフィールド名を snake_case に変換
```

---

## 📁 ファイル構成（推奨）

```
src/
├── lib/
│   ├── supabase.ts          # Supabaseクライアント初期化
│   ├── database.types.ts    # 自動生成された型定義
│   └── api.ts               # 共通API関数
├── features/
│   ├── matches/
│   │   ├── api.ts           # 試合関連API
│   │   ├── hooks.ts         # React Query hooks
│   │   └── types.ts         # 型定義
│   ├── teams/
│   ├── standings/
│   └── ...
└── hooks/
    ├── useMatchRealtime.ts  # Realtime hooks
    └── ...
```

---

## 更新履歴
- 2024-01-07: 初版作成
