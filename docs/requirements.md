# 浦和カップ トーナメント管理システム — 要件定義書

**作成日**: 2026-03-02
**対象大会**: 第XX回さいたま市招待高校サッカーフェスティバル（浦和カップ）
**大会日程**: 2026-03-20（金）〜 2026-03-22（日）
**本番URL**: https://urawacup3.vercel.app

---

## 1. 目的と背景

### 1.1 解決する課題

浦和カップは3日間・24チーム・複数会場で行われる大規模な高校サッカー大会である。
従来の運営は紙ベース＋手作業で行われており、以下の課題があった。

| 課題 | 影響 |
|------|------|
| 対戦組み合わせの手作業作成 | 制約条件（同リーグ回避等）の考慮が困難、作成に数時間 |
| 試合結果の紙記録→手計算 | 順位表の計算ミス、反映遅延 |
| 関係者への結果共有 | FAX・LINE等で個別連絡、リアルタイム性なし |
| 県協会向け報告書の手作業作成 | 書式統一が困難、作成に数時間 |
| 会場間の情報伝達 | 電話連絡に依存、遅延・誤伝達のリスク |

### 1.2 システムで実現すること

| # | ビジネス要件 | 効果 |
|---|---|---|
| B1 | 大会運営の全工程をシステム化する | 紙作業の排除、ヒューマンエラーの削減 |
| B2 | 会場スタッフがスマホから試合結果を入力できる | 会場間移動なしで即時データ入力 |
| B3 | 関係者・一般がリアルタイムで結果・順位を閲覧できる | 問い合わせ対応の削減、観戦者の利便性向上 |
| B4 | 県協会向け公式報告書を自動生成できる | 報告書作成時間を数時間→数分に短縮 |
| B5 | 対戦組み合わせの制約を自動最適化できる | 公平性の担保、作成時間の短縮 |

### 1.3 対象ユーザー

| ユーザー | 人数（想定） | 利用場面 |
|----------|-------------|----------|
| 大会運営責任者（admin） | 1〜2名 | 事前準備〜大会中〜大会後の全工程 |
| 会場責任者（venue_staff） | 各会場1名、計6名 | 大会中の試合結果入力 |
| 閲覧者（viewer） | 数名 | 大会中の状況確認 |
| 一般（未認証） | 不特定多数 | 試合結果・順位の閲覧 |

---

## 2. 大会構造

### 2.1 規模

| 項目 | 値 |
|------|-----|
| 参加チーム数 | 24 |
| 会場数 | 6（各校グラウンド） |
| 大会日数 | 3日間 |
| 1チームあたりの予選試合数 | A戦4試合 + B戦2試合 = 6試合 |
| 予選日数 | 2日（Day1 + Day2） |
| 最終日 | 決勝トーナメント + 研修試合 |

### 2.2 大会形式（2形式対応）

#### グループ制（従来形式）
- 4グループ × 6チーム = 24チーム
- 各チーム4試合（対角ペアは対戦なし）
- グループ上位が決勝トーナメントへ

#### リーグ制（新形式）★ 今大会はこちら
- 6会場 × 4チーム = 24チーム
- A戦（順位対象）4試合 + B戦（順位対象外）2試合
- 全体順位上位4チームが決勝トーナメントへ

### 2.3 A戦・B戦システム

1会場4チームの総当たり6試合のうち：
- **A戦**（4試合）: 順位計算対象。勝=3点、分=1点、負=0点
- **B戦**（2試合）: 順位対象外。試合数制限・連戦判定からも除外

> 詳細アルゴリズムは `docs/schedule-generation-specification.md` を参照

### 2.4 最終日（Day3）

| 区分 | 試合 | 対象チーム |
|------|------|-----------|
| 準決勝 | 2試合 | 予選1〜4位 |
| 決勝 | 1試合 | 準決勝勝者 |
| 3位決定戦 | 1試合 | 準決勝敗者 |
| 研修試合 | 複数 | 5位以下チーム |

---

## 3. 機能要件

### 3.1 認証・ユーザー管理

| # | 要件 | 優先度 |
|---|------|--------|
| F-A1 | 3ロールを管理する: admin / venue_staff / viewer | 必須 |
| F-A2 | メール＋パスワードで認証する | 必須 |
| F-A3 | venue_staff は担当会場の試合のみ操作できる | 必須 |
| F-A4 | 未認証ユーザーは公開ページのみ閲覧できる | 必須 |

### 3.2 大会設定

| # | 要件 | 優先度 |
|---|------|--------|
| F-B1 | 大会パラメータを設定できる（試合時間、インターバル、グループ数等） | 必須 |
| F-B2 | グループ制 / リーグ制を切り替えられる | 必須 |
| F-B3 | 会場情報を管理できる（名前、住所、用途、収容試合数） | 必須 |
| F-B4 | 対戦除外ペアを設定できる | 任意 |

### 3.3 チーム・選手管理

| # | 要件 | 優先度 |
|---|------|--------|
| F-C1 | チームのCRUD + グループ/シード割り当て | 必須 |
| F-C2 | Excel/CSVからの一括チームインポート | 必須 |
| F-C3 | 地元校（local）/ 招待校（invited）を区別する | 必須 |
| F-C4 | 選手登録（背番号、氏名、ふりがな、学年、ポジション、キャプテン） | 必須 |

### 3.4 日程生成・管理

| # | 要件 | 優先度 |
|---|------|--------|
| F-D1 | 予選日程を制約ベースで自動生成する | 必須 |
| F-D2 | 制約スコアで最適化する（既対戦回避、同リーグ回避、同地域回避、地元同士回避、連戦回避） | 必須 |
| F-D3 | A戦 / B戦を区別し、B戦は順位計算から除外する | 必須 |
| F-D4 | 決勝トーナメント（準決勝→決勝/3位決定戦）を生成する | 必須 |
| F-D5 | 研修試合（5位以下チームの最終日対戦）を生成する | 必須 |
| F-D6 | チーム→会場の日別配置を管理する（リーグ制） | 必須 |
| F-D7 | 準決勝の結果から決勝/3位決定戦の対戦カードを自動更新する | 必須 |

> アルゴリズム詳細は `docs/schedule-generation-specification.md` を参照

### 3.5 試合結果入力・承認

| # | 要件 | 優先度 |
|---|------|--------|
| F-E1 | 前後半スコアを入力し、合計を自動計算する | 必須 |
| F-E2 | 得点者を登録する（選手、時間、前後半、OG/PKフラグ） | 必須 |
| F-E3 | PK戦スコアを入力する（決勝トーナメントのみ） | 必須 |
| F-E4 | 試合をロックし、入力中の排他制御を行う | 推奨 |
| F-E5 | 承認フローを提供する（venue_staff 入力 → admin 承認/却下） | 推奨 |
| F-E6 | 連打・誤操作を防ぐレート制限を設ける | 推奨 |

### 3.6 順位・集計

| # | 要件 | 優先度 |
|---|------|--------|
| F-F1 | 試合結果から順位を自動計算する（勝点→得失点差→総得点の優先順） | 必須 |
| F-F2 | グループ別順位 / 全体順位を切り替えて表示する | 必須 |
| F-F3 | 得点ランキングを表示する | 必須 |

### 3.7 レポート生成

| # | 要件 | 優先度 |
|---|------|--------|
| F-G1 | 日報PDF（日別・会場別の試合結果一覧）を生成する | 必須 |
| F-G2 | 成績表PDF（順位表）を生成する | 必須 |
| F-G3 | 最終結果PDF（1〜4位、得点王、優秀選手）を生成する | 必須 |
| F-G4 | 宛先・差出人情報をカスタマイズできる | 必須 |
| F-G5 | 優秀選手（MVP＋優秀選手）を選出・登録できる | 必須 |
| F-G6 | バックエンド障害時にローカルPDFフォールバックを提供する | 推奨 |

### 3.8 公開ページ（未認証アクセス可）

| # | 要件 | 優先度 |
|---|------|--------|
| F-H1 | 試合一覧（日付・会場・スコア）を公開する | 必須 |
| F-H2 | 順位表を公開する | 必須 |
| F-H3 | 得点ランキングを公開する | 必須 |
| F-H4 | リアルタイムで更新する（認証不要） | 必須 |

---

## 4. 非機能要件

| # | カテゴリ | 要件 | 基準 |
|---|---------|------|------|
| N1 | リアルタイム性 | 試合結果入力から全クライアントのUI更新まで | 5秒以内 |
| N2 | オフライン耐性 | ネットワーク断でもアプリ画面を表示し、復帰後に自動再取得 | PWA Cache + NetworkOnly API |
| N3 | モバイルファースト | 会場スタッフがスマホ（375px〜）で結果入力できる | タッチ操作対応、横スクロール不要 |
| N4 | 日本語対応 | PDF・UI ともに日本語を正しく表示する | フォントフォールバック必須 |
| N5 | 同時接続 | 大会中20〜30人の同時利用に耐える | Supabase Free Tier の範囲 |
| N6 | セキュリティ | RLSによるデータアクセス制御、ロールベース画面制御 | 管理者以外はデータ変更不可 |
| N7 | 可用性 | 大会3日間（9:00〜17:00）の連続稼働 | フロントエンド: Vercel CDN、DB: Supabase マネージド |
| N8 | データ保全 | 試合結果の消失を防ぐ | Supabase PostgreSQL + 入力者・時刻の記録 |

---

## 5. 画面一覧

### 5.1 管理者画面（認証必須）

| # | 画面 | パス | 主な操作 | ロール |
|---|------|------|----------|--------|
| P1 | ダッシュボード | `/` | 大会概況の確認 | admin |
| P2 | 順位表 | `/standings` | グループ別/全体の順位確認 | admin, viewer |
| P3 | 得点ランキング | `/scorer-ranking` | 得点王の確認 | admin, viewer |
| P4 | チーム管理 | `/teams` | チームCRUD、Excel一括登録 | admin |
| P5 | 日程管理 | `/schedule` | 日程生成・編集・確認 | admin |
| P6 | 会場配置 | `/venue-assignment` | チーム→会場の日別配置 | admin |
| P7 | 研修試合編集 | `/training-editor` | 最終日の研修試合管理 | admin |
| P8 | 試合結果入力 | `/results` | スコア・得点者の入力 | admin, venue_staff |
| P9 | レポート | `/reports` | PDF/Excel の生成・ダウンロード | admin |
| P10 | 承認 | `/approval` | venue_staff 入力結果の承認/却下 | admin |
| P11 | 設定 | `/settings` | 大会パラメータの変更 | admin |
| P12 | 除外設定 | `/exclusions` | 対戦除外ペアの管理 | admin |
| P13 | 選手管理 | `/players` | 選手登録・編集 | admin |
| P14 | 最終日日程 | `/final-day` | 決勝トーナメント・研修試合の編集 | admin |
| P15 | ログイン | `/login` | 認証 | 全員 |

### 5.2 公開画面（認証不要）

| # | 画面 | パス | 内容 |
|---|------|------|------|
| P16 | 試合一覧 | `/public/matches` | 全試合のスコア・状態 |
| P17 | 順位表 | `/public/standings` | グループ別/全体の順位 |
| P18 | 得点ランキング | `/public/scorers` | 上位得点者 |

---

## 6. データモデル

### 6.1 ER図（主要テーブル）

```
tournaments 1──* groups
tournaments 1──* teams
tournaments 1──* venues
tournaments 1──* matches
tournaments 1──* standings
tournaments 1──* venue_assignments

groups    1──* teams        (グループ制の場合)
teams     1──* players
teams     1──* goals        (team_id)

venues    1──* matches      (venue_id)
matches   1──* goals        (match_id)

profiles  ──── auth.users   (Supabase Auth)
profiles  *──1 venues       (venue_staff の担当会場)
```

### 6.2 主要テーブル定義

#### tournaments
大会の設定情報を一元管理する。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | 大会ID |
| name | VARCHAR | 大会名 |
| start_date, end_date | DATE | 開催期間 |
| match_duration | INT | 試合時間（分） |
| half_duration | INT | ハーフ時間（分） |
| interval_minutes | INT | 試合間隔（分） |
| group_count | INT | グループ数 |
| teams_per_group | INT | グループあたりチーム数 |
| use_group_system | BOOLEAN | グループ制/リーグ制の切替 |
| qualification_rule | VARCHAR | 予選通過ルール |
| bracket_method | VARCHAR | トーナメント組み方 |
| match_constraint_scores | JSONB | 制約スコア設定 |
| sender_organization | VARCHAR | 報告書の差出人組織 |
| sender_name | VARCHAR | 報告書の差出人名 |
| sender_contact | VARCHAR | 報告書の連絡先 |

#### teams

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | チームID |
| tournament_id | INT FK | 所属大会 |
| name, short_name | VARCHAR | チーム名 |
| team_type | VARCHAR | 'local' \| 'invited' |
| is_venue_host | BOOLEAN | 会場校フラグ |
| group_id | VARCHAR FK | グループ（グループ制の場合） |
| group_order | INT | グループ内シード順 |
| prefecture, region | VARCHAR | 都道府県・地域 |
| league_id | INT FK | 所属リーグ |

#### matches

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | 試合ID |
| tournament_id | INT FK | 大会 |
| venue_id | INT FK | 会場 |
| home_team_id, away_team_id | INT FK | 対戦チーム |
| match_date | DATE | 試合日 |
| match_time | TIME | 開始時刻 |
| stage | VARCHAR | 'preliminary' \| 'semifinal' \| 'final' \| 'third_place' \| 'training' |
| status | VARCHAR | 'scheduled' \| 'in_progress' \| 'completed' \| 'cancelled' |
| home_score_half1, home_score_half2 | INT | 前後半スコア |
| home_score_total, away_score_total | INT | 合計スコア |
| result | VARCHAR | 'home_win' \| 'away_win' \| 'draw' |
| has_penalty_shootout | BOOLEAN | PK戦フラグ |
| home_pk, away_pk | INT | PKスコア |
| is_b_match | BOOLEAN | B戦フラグ（順位対象外） |
| is_locked | BOOLEAN | 入力ロック |
| locked_by | UUID | ロック者 |
| approval_status | VARCHAR | 'pending' \| 'approved' \| 'rejected' |
| entered_by | UUID | 入力者 |
| home_seed, away_seed | VARCHAR | シード表記（例: "A1", "4位③"） |

#### goals

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | 得点ID |
| match_id | INT FK | 試合 |
| team_id | INT FK | 得点チーム |
| player_id | INT FK (nullable) | 得点選手 |
| player_name | VARCHAR | 選手名（常に記録） |
| minute | INT | 得点時間 |
| half | INT | 前半(1)/後半(2) |
| is_own_goal | BOOLEAN | オウンゴール |
| is_penalty | BOOLEAN | PK |

#### standings

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | |
| tournament_id | INT FK | 大会 |
| group_id | VARCHAR FK (nullable) | グループ（null=全体順位） |
| team_id | INT FK | チーム |
| rank | INT | 順位 |
| played, won, drawn, lost | INT | 試合数・勝敗 |
| goals_for, goals_against | INT | 得失点 |
| goal_difference | INT | 得失点差 |
| points | INT | 勝点（勝=3, 分=1） |

#### players

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | |
| team_id | INT FK | チーム |
| number | INT | 背番号 |
| name | VARCHAR | 氏名 |
| name_kana | VARCHAR | ふりがな |
| grade | INT | 学年 |
| position | VARCHAR | ポジション |
| is_captain | BOOLEAN | キャプテン |

#### profiles（Supabase Auth連携）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID PK | auth.users.id |
| username | VARCHAR | ユーザー名 |
| role | VARCHAR | 'admin' \| 'venue_staff' \| 'viewer' |
| venue_id | INT FK (nullable) | 担当会場（venue_staff のみ） |
| is_active | BOOLEAN | 有効フラグ |

#### venue_assignments（リーグ制用）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL PK | |
| tournament_id | INT FK | 大会 |
| venue_id | INT FK | 会場 |
| team_id | INT FK | チーム |
| match_day | INT | 日（1 or 2） |
| slot_order | INT | 会場内の順番 |

---

## 7. 主要ワークフロー

### 7.1 大会準備（大会前）

```
[admin] 大会設定 → 会場登録 → チーム登録（Excel一括可）
    → 選手登録 → 会場配置 → 除外ペア設定（任意）
    → 予選日程生成 → 日程確認・微調整 → 準備完了
```

### 7.2 予選運営（Day1〜Day2）

```
[venue_staff] 試合結果入力（スコア＋得点者）
    → [system] 順位自動計算 → Realtime で全端末に反映
    → [admin] 承認（任意）
    → [public] 公開ページで結果・順位を即時閲覧
    → [admin] 日報PDF生成 → 県協会に提出
```

### 7.3 最終日運営（Day3）

```
[admin] 予選結果から決勝トーナメント生成
    → 研修試合生成
    → [venue_staff] 準決勝結果入力
    → [system] 決勝/3位決定戦の対戦カード自動更新
    → 決勝・3位決定戦・研修試合の結果入力
    → [admin] 優秀選手選出
    → 最終結果PDF生成
```

### 7.4 大会後

```
[admin] 成績表PDF生成 → 最終結果PDF生成 → 県協会に提出
```

---

## 8. 技術構成

| 層 | 技術 | 役割 |
|----|------|------|
| フロントエンド | React 18 + TypeScript + Vite + Tailwind CSS | SPA、PWA |
| 状態管理 | Zustand + TanStack Query | ローカル状態 + サーバー状態 |
| データベース | Supabase (PostgreSQL) | データ永続化、RLS |
| 認証 | Supabase Auth | メール/パスワード認証 |
| リアルタイム | Supabase Realtime (postgres_changes) | 全端末への即時反映 |
| バックエンド | FastAPI (Python) | PDF生成、スケジュール生成 |
| PDF生成 | ReportLab (Python) | 日本語フォント対応PDF |
| ホスティング | Vercel (FE) + Render (BE) + Supabase (DB) | マネージド運用 |

> 構成の詳細は `SYSTEM_ARCHITECTURE.md` を参照

---

## 9. セキュリティ要件

| # | 要件 |
|---|------|
| S1 | Supabase RLS を全テーブルに適用し、ロールに応じたアクセス制御を行う |
| S2 | admin のみがデータ変更可能（venue_staff は担当会場の試合結果入力のみ） |
| S3 | 公開ページは SELECT のみ許可、INSERT/UPDATE/DELETE を禁止する |
| S4 | 開発バイパス（admin/admin123）を本番環境で無効化する |
| S5 | Supabase anon key が Git 履歴に残っている場合はローテーションする |
| S6 | バックエンド PDF エンドポイントに認証を追加する（未実装） |

---

## 10. 制約・前提条件

| # | 制約 |
|---|------|
| C1 | Supabase Free Tier の範囲で運用する（500MB DB、50K月間アクティブユーザー） |
| C2 | Render Free Tier の範囲で運用する（スピンダウンあり、初回アクセス時に30秒待ち） |
| C3 | 会場スタッフのデバイスは個人スマホを想定（iPhone Safari / Android Chrome） |
| C4 | 会場のネットワーク環境はモバイル回線を想定（Wi-Fi 保証なし） |
| C5 | 報告書の日本語フォントは、Render の Linux 環境では Noto Sans CJK を使用する |

---

## 11. 受入基準

### 11.1 大会前（〜2026-03-19）

- [ ] 24チーム分の登録が完了している
- [ ] 予選日程が制約違反なく生成されている
- [ ] 全会場スタッフがログインし、結果入力ができることを確認している
- [ ] 公開ページ（/public/*）が閲覧可能である
- [ ] PDF報告書が日本語で正しく出力される

### 11.2 大会中（2026-03-20〜22）

- [ ] 試合結果入力から順位表更新まで5秒以内で反映される
- [ ] 公開ページがリアルタイムで更新される
- [ ] 日報PDFが各日終了時に生成・提出できる
- [ ] 最終日にブラケットが自動更新される

### 11.3 大会後

- [ ] 最終結果PDF（1〜4位、得点王、優秀選手）が生成できる
- [ ] 成績表PDFが生成できる

---

## 12. 関連ドキュメント

| ドキュメント | 場所 | 内容 |
|---|---|---|
| 日程生成アルゴリズム仕様書 | `docs/schedule-generation-specification.md` | Anchor-Pod CP、制約、A/B戦 |
| システム構成書 | `SYSTEM_ARCHITECTURE.md` | 技術スタック、DB構造、デプロイ |
| デプロイチェックリスト | `frontend/DEPLOYMENT_CHECKLIST.md` | RLS、機能テスト、環境変数 |
| コード分析レポート | `code_analysis_report.md` | 技術的負債の指摘（一部解決済み） |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-03-02 | 初版作成（コードベースからの逆算 + ドキュメント統合） |
