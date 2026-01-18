# 浦和カップ 日程生成システム仕様書

## 概要

本システムは、サッカー大会の日程を自動生成・最適化するためのアルゴリズムを実装しています。
3つの大会形式に対応し、各種制約条件を考慮した最適な組み合わせを生成します。

---

## 1. 大会形式

### 1.1 グループ制（浦和カップ形式）
- **構成**: 4グループ × 6チーム = 24チーム
- **試合数**: 各チーム4試合（2日間）
- **特徴**: 固定パターンの総当たり（対角ペアは対戦なし）

### 1.2 1リーグ制（会場配置ベース）
- **構成**: 6会場 × 4チーム = 24チーム
- **試合数**: 各チーム4A戦 + 2B戦 = 6試合（2日間）
- **特徴**: 制約ベースの最適化配置

### 1.3 決勝・研修試合
- **決勝トーナメント**: 準決勝、3位決定戦、決勝
- **研修試合**: 決勝日の空き時間活用

---

## 2. 制約条件

### 2.1 ハード制約（エラー：保存不可）

| 制約名 | 説明 | B戦除外 |
|--------|------|---------|
| 同時刻重複 | 同チームが同時刻に2試合 | × |
| 対戦済み重複 | 同カードが2回以上 | ○ |
| 自チーム対戦 | 同チーム同士の対戦 | × |

### 2.2 ソフト制約（警告：保存可能）

| 制約名 | スコア | 説明 | B戦除外 | 設定可能 |
|--------|--------|------|---------|----------|
| Day2再戦 | 200 | Day1のA戦相手と再戦 | ○ | × |
| 同リーグ | 100 | 同リーグ所属チーム同士 | × | ○ |
| 同地域 | 50 | 同地域チーム同士 | × | ○ |
| 地元同士 | 30 | 地元チーム同士の対戦 | × | ○ |
| 連戦 | - | 連続時間枠で試合 | ○ | ○ |
| 1日3試合以上 | - | A戦が1日3試合以上 | ○ | ○ |
| 2日間5試合以上 | - | A戦合計5試合以上 | ○ | ○ |
| 試合数不足 | - | 1日の試合が2未満 | ○ | × |
| 審判中に試合 | - | 審判担当中に自チーム試合 | × | × |

### 2.3 情報制約（参考表示）

| 制約名 | 説明 |
|--------|------|
| 不戦ペア変更 | 元々対戦なしのペアが対戦 |
| 審判偏り | 審判担当回数が2回以上差 |

---

## 3. A戦・B戦システム

### 3.1 概念

```
1会場4チームの総当たり = 6試合
├── A戦: 4試合（順位計算対象）
└── B戦: 2試合（順位計算対象外 = 休憩枠扱い）
```

### 3.2 試合パターン（スロット順）

| スロット | 対戦 | 種別 | インデックス |
|----------|------|------|--------------|
| 1 | チーム1 vs チーム2 | A戦 | (0,1) |
| 2 | チーム3 vs チーム4 | A戦 | (2,3) |
| 3 | チーム1 vs チーム3 | **B戦** | (0,2) |
| 4 | チーム2 vs チーム3 | A戦 | (1,2) |
| 5 | チーム1 vs チーム4 | A戦 | (0,3) |
| 6 | チーム2 vs チーム4 | **B戦** | (1,3) |

### 3.3 B戦の特性

1. **順位計算対象外**: 勝敗は記録されるが順位に影響しない
2. **試合数カウント対象外**: 1日3試合制限等から除外
3. **連戦判定対象外**: スロット3,6は「空き」として扱う
4. **対戦済み判定対象外**: B戦で対戦しても「対戦済み」にならない
5. **完全マッチング**: B戦2試合で4チーム全員が1回ずつ出場

### 3.4 連戦判定への影響

```
スロット1→2: 連戦 ○（A戦→A戦）
スロット2→3: 連戦 ×（A戦→B戦=空き）
スロット3→4: 連戦 ×（B戦=空き→A戦）
スロット4→5: 連戦 ○（A戦→A戦）
スロット5→6: 連戦 ×（A戦→B戦=空き）
```

---

## 4. アルゴリズム

### 4.1 グループ制日程生成

```
generateUrawaCupSchedule(teams, venues, config)
├── 1. 各グループ（A,B,C,D）を処理
│   ├── シード番号1-6のチームを取得
│   ├── グループの会場を特定
│   └── 固定パターンで試合生成
├── 2. Day1パターン適用（6試合）
├── 3. Day2パターン適用（6試合）
├── 4. 審判チーム割り当て
└── 5. 検証・統計出力
```

**対角ペア（対戦なし）**:
- チーム1 vs チーム6
- チーム2 vs チーム5
- チーム3 vs チーム4

### 4.2 1リーグ制 会場配置最適化 (Anchor-Pod CP アルゴリズム)

#### 4.2.0 設計思想

```
Anchor-Pod CP = ホストアンカー + 可変Podサイズ + 制約最適化
├── ホストは自会場に固定（移動しない）
├── Podサイズは 3/4/5 チームで可変（N,V に応じて計算）
├── Day1/Day2 再戦は絶対禁止（ハード制約）
└── 優先度: 同リーグ回避 > 同地域回避 > 地元同士回避
```

#### 4.2.1 PodPlan計算

```
computePodPlanOrThrow(N, V)
├── 条件: 3a + 4b + 5c = N, a + b + c = V
├── 全探索で解を発見
└── 例:
    ├── N=24, V=6 → 4×6=24 (a=0, b=6, c=0)
    ├── N=20, V=5 → 4×5=20 (a=0, b=5, c=0)
    └── N=19, V=5 → 3×1 + 4×4=19 (a=1, b=4, c=0)
```

#### 4.2.2 全体フロー

```
generateOptimalVenueAssignment(teams, venues, scores, day1Assignments?, bannedPairs?)
├── 1. Day1配置から禁止ペア（bannedPairs）を抽出
├── 2. PodPlan計算（各会場のチーム数を決定）
├── 3. Multi-start最適化（5回）
│   ├── 初回: ホストアンカー付き貪欲法
│   └── 2回目以降: ホスト維持ランダム配置
├── 4. 各試行で局所最適化
│   ├── 会場内スロット最適化（辞書式スコア）
│   └── 会場間スワップ最適化（ホスト除外）
├── 5. 最良解を保持
└── 6. Day1再戦なし＆同リーグなしなら早期終了
```

#### 4.2.3 辞書式スコアリング

```typescript
// 優先順位（上位が絶対的に優先）
LexPairScore {
  day1Repeat: number    // Day1再戦数（最優先＝ハード制約）
  sameLeague: number    // 同リーグ数
  sameRegion: number    // 同地域数
  localVsLocal: number  // 地元同士数
}

// エンコード（数値化）
encodeLexToScore(lex) =
  day1Repeat * 10^9 + sameLeague * 10^6 + sameRegion * 10^3 + localVsLocal
```

#### 4.2.4 ホストアンカー付き貪欲法

```
buildAssignmentsGreedyWithHosts(teams, venues, podSizes, bannedPairs?)
├── 1. ホストチームを自会場に配置
│   └── isHost=true かつ hostVenueId が一致するチーム
├── 2. 残りチームを貪欲に配置
│   ├── 各会場のPodSizeまで枠を埋める
│   ├── 既配置チームとの辞書式スコアを計算
│   └── 最小スコアのチームを選択
└── 全チーム配置完了
```

#### 4.2.5 会場内スロット最適化（辞書式）

```
optimizeIntraVenueSlotsLex(assignments, bannedPairs?)
├── 各会場（4チーム）を処理
│   ├── 24通りの順列を生成（4!）
│   ├── 各順列の辞書式スコアを計算
│   │   ├── A戦ペア: フルウェイト（×1.0）
│   │   └── B戦ペア: 極低ウェイト（×0.001）
│   └── 最小スコアの順列を採用
└── 制約違反ペアをB戦に移動
```

#### 4.2.6 会場間スワップ最適化（辞書式）

```
optimizeBySwapLex(assignments, bannedPairs?, maxIter=50)
├── 改善がなくなるまで繰り返し:
│   ├── 1. 全会場の内部スロット最適化
│   ├── 2. 会場ペアごとにスワップ試行
│   │   ├── ホストチームは除外（移動不可）
│   │   ├── チームを入れ替え
│   │   ├── 両会場の内部スロット再最適化
│   │   ├── 辞書式スコア比較
│   │   └── 改善なら確定、なければ戻す
│   └── 3. 改善があれば継続
└── 最終配置を返却
```

#### 4.2.7 評価関数（辞書式）

```
evaluateAssignmentLex(assignments, bannedPairs?)
├── total = {day1Repeat:0, sameLeague:0, sameRegion:0, localVsLocal:0}
├── 各会場を処理:
│   ├── A戦ペア（4組）: 辞書式スコアを加算
│   └── B戦ペア（2組）: 評価対象外
├── return encodeLexToScore(total)
└── Day1再戦があれば 10^9 レベルのペナルティ
```

### 4.3 Day1対戦相手マップ

```
buildDay1OpponentsMap(day1Assignments)
├── 各会場の4チームを処理
├── A戦ペアのみを「対戦済み」として記録
│   ├── (0,1), (2,3), (1,2), (0,3) → 記録
│   └── (0,2), (1,3) → B戦なので除外
└── チームID → 対戦相手IDセット のマップを返却
```

---

## 5. スコア計算

### 5.1 ペア間コンフリクト

```typescript
calculatePairConflict(team1, team2, scores) {
  let score = 0

  // 同リーグチェック
  if (team1.leagueId && team1.leagueId === team2.leagueId)
    score += scores.sameLeague  // +100

  // 同地域チェック
  if (team1.region && team1.region === team2.region)
    score += scores.sameRegion  // +50

  // 地元同士チェック
  if (team1.teamType === 'local' && team2.teamType === 'local')
    score += scores.localTeams  // +30

  return score
}
```

### 5.2 会場スコア（順列評価用）

```
会場スコア = Σ(A戦ペアスコア × 1.0) + Σ(B戦ペアスコア × 0.1)
```

### 5.3 全体スコア

```
全体スコア = Σ(各会場のA戦スコア) + Σ(各会場のB戦スコア × 0.1)
           + Day1再戦ペナルティ（A戦: 200点、B戦: 20点）
```

---

## 6. 設定パラメータ

### 6.1 日程設定

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| startTime | '09:00' | 開始時刻 |
| matchDuration | 15 | 試合時間（分） |
| intervalMinutes | 10 | 試合間隔（分） |
| matchesPerTeamPerDay | 2 | 1日あたりA戦数 |
| venueHostFirstMatch | true | 会場校を第1試合に |

### 6.2 制約スコア

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| alreadyPlayed | 200 | Day2再戦ペナルティ |
| sameLeague | 100 | 同リーグペナルティ |
| sameRegion | 50 | 同地域ペナルティ |
| localTeams | 30 | 地元同士ペナルティ |

### 6.3 制約チェック設定

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| avoidLocalVsLocal | false | 地元同士を避ける |
| avoidSameRegion | false | 同地域を避ける |
| avoidSameLeague | false | 同リーグを避ける |
| avoidConsecutive | true | 連戦を避ける |
| warnDailyGameLimit | true | 1日3試合警告 |
| warnTotalGameLimit | true | 合計5試合警告 |

---

## 7. データ構造

### 7.1 チーム情報（制約評価用）

```typescript
interface TeamForAssignment {
  id: number
  name: string
  shortName?: string
  region?: string           // 地域（埼玉、東京等）
  leagueId?: string | number  // 所属リーグID
  teamType?: 'local' | 'invited'  // 地元校 or 招待校
  isHost?: boolean          // 会場ホストフラグ
  hostVenueId?: number      // ホストの場合、その会場ID
}
```

### 7.2 PodPlan

```typescript
interface PodPlan {
  pod3Count: number   // 3チームのPod数
  pod4Count: number   // 4チームのPod数
  pod5Count: number   // 5チームのPod数
  totalVenues: number
  totalTeams: number
}
```

### 7.3 辞書式スコア

```typescript
interface LexPairScore {
  sameLeague: number    // 同リーグペア数
  sameRegion: number    // 同地域ペア数
  localVsLocal: number  // 地元同士ペア数
  day1Repeat: number    // Day1再戦ペア数（ハード制約）
}
```

### 7.4 会場配置結果

```typescript
interface VenueAssignmentResult {
  assignments: Map<number, TeamForAssignment[]>  // 会場ID → チーム配列
  score: number                                   // 総スコア（低いほど良い）
  details: {
    // A戦の制約
    sameLeaguePairs: number
    sameRegionPairs: number
    localVsLocalPairs: number
    day1RepeatPairs: number
    // B戦の制約（参考）
    bMatchSameLeaguePairs?: number
    bMatchSameRegionPairs?: number
    bMatchLocalVsLocalPairs?: number
  }
}
```

### 7.5 制約違反

```typescript
interface ConstraintViolation {
  level: 'error' | 'warning' | 'info'
  type: string          // 制約タイプID
  label: string         // 表示名
  description: string   // 詳細説明
  matchIds: number[]    // 関連試合ID
  teamIds?: number[]    // 関連チームID
  day?: number
  slot?: number
}
```

---

## 8. 計算量

| アルゴリズム | 時間計算量 | 備考 |
|-------------|-----------|------|
| グループ制生成 | O(G × S) | G=グループ数、S=スロット数 |
| 貪欲法 | O(V × T²) | V=会場数、T=チーム数 |
| 会場内最適化 | O(V × 24) | 24=4!（順列数） |
| 会場間スワップ | O(I × V² × T² × 24) | I=反復回数 |
| Multi-start | O(R × (貪欲+スワップ)) | R=5（リスタート回数） |

---

## 9. 実装ファイル

| ファイル | 役割 |
|---------|------|
| `urawaCupScheduleGenerator.ts` | メイン日程生成ロジック |
| `matchConstraints.ts` | 制約チェックロジック |
| `constraintSettingsStore.ts` | 制約設定の状態管理 |
| `MatchSchedule.tsx` | 日程画面UI・生成呼び出し |
| `DraggableMatchList.tsx` | 試合リスト表示・編集UI |

---

## 10. 更新履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-01-19 | **Anchor-Pod CP アルゴリズム実装** |
| 2026-01-19 | PodPlan計算（3/4/5チーム可変Pod）追加 |
| 2026-01-19 | 辞書式スコアリング（Day1再戦 > 同リーグ > 同地域 > 地元同士）追加 |
| 2026-01-19 | ホストアンカー付き貪欲法を追加 |
| 2026-01-19 | Day1 A戦ペア抽出機能を追加 |
| 2026-01-18 | B戦を対戦済みロジックから除外 |
| 2026-01-18 | 会場内スロット最適化を追加 |
| 2026-01-18 | B戦制約の副次的最適化を追加 |
| 2026-01-18 | 会場色の一貫性を修正 |

---

## 付録A: 試合パターン詳細（グループ制）

### Day1
```
枠1: 1vs2, 枠2: 3vs5, 枠3: 4vs6
枠4: 1vs3, 枠5: 2vs4, 枠6: 5vs6
```

### Day2
```
枠1: 1vs5, 枠2: 2vs3, 枠3: 4vs5
枠4: 3vs6, 枠5: 1vs4, 枠6: 2vs6
```

### 対戦マトリクス
```
     1  2  3  4  5  6
  1  -  D1 D1 D2 D2 ×
  2  D1 -  D2 D1 ×  D2
  3  D1 D2 -  ×  D1 D2
  4  D2 D1 ×  -  D2 D1
  5  D2 ×  D1 D2 -  D1
  6  ×  D2 D2 D1 D1 -

D1=Day1対戦, D2=Day2対戦, ×=対戦なし（対角ペア）
```

---

## 付録B: 最適化の例

### ケース: 地元同士の制約解消

**初期配置**:
```
会場A: [地元1, 地元2, 招待1, 招待2]
→ A戦ペア: (地元1,地元2), (招待1,招待2), (地元2,招待1), (地元1,招待2)
→ 地元同士がA戦に含まれる → 制約違反
```

**最適化後**:
```
会場A: [地元1, 招待1, 地元2, 招待2]
→ A戦ペア: (地元1,招待1), (地元2,招待2), (招待1,地元2), (地元1,招待2)
→ B戦ペア: (地元1,地元2), (招待1,招待2)
→ 地元同士がB戦に移動 → 制約解消
```
