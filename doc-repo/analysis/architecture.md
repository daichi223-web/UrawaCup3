# 浦和カップ システム分析ドキュメント

## 1. システム構成図

```mermaid
graph TB
    subgraph "フロントエンド (React + TypeScript)"
        FE[Vite + React 18]
        STORE[Zustand Store]
        QUERY[TanStack Query]
        PAGES[Pages<br/>13画面]
    end

    subgraph "バックエンド (FastAPI)"
        API[FastAPI Router]
        AUTH[認証<br/>JWT]
        SERVICES[Services Layer]
        MODELS[SQLAlchemy Models]
    end

    subgraph "データ層"
        DB[(SQLite)]
    end

    subgraph "出力"
        PDF[ReportLab<br/>PDF生成]
        EXCEL[openpyxl<br/>Excel出力]
    end

    FE --> STORE
    FE --> QUERY
    QUERY --> API
    API --> AUTH
    API --> SERVICES
    SERVICES --> MODELS
    MODELS --> DB
    SERVICES --> PDF
    SERVICES --> EXCEL
```

## 2. データモデル ER図

```mermaid
erDiagram
    TOURNAMENT ||--o{ GROUP : has
    TOURNAMENT ||--o{ TEAM : has
    TOURNAMENT ||--o{ VENUE : has
    TOURNAMENT ||--o{ MATCH : has
    TOURNAMENT ||--o{ STANDING : has
    TOURNAMENT ||--o{ EXCLUSION_PAIR : has

    GROUP ||--o{ TEAM : contains
    GROUP ||--o{ MATCH : hosts

    TEAM ||--o{ PLAYER : has
    TEAM ||--o{ STAFF : has
    TEAM ||--o{ TEAM_UNIFORM : has
    TEAM ||--o{ GOAL : scores

    VENUE ||--o{ MATCH : hosts

    MATCH ||--o{ GOAL : has

    PLAYER ||--o{ GOAL : scores

    USER ||--o{ MATCH : locks
    USER ||--o{ MATCH : approves

    TOURNAMENT {
        int id PK
        string name
        int edition
        date start_date
        date end_date
    }

    TEAM {
        int id PK
        int tournament_id FK
        string group_id FK
        string name
        string team_type
        bool is_host
    }

    MATCH {
        int id PK
        int tournament_id FK
        int venue_id FK
        int home_team_id FK
        int away_team_id FK
        string stage
        string status
        int home_score_total
        int away_score_total
    }

    STANDING {
        int id PK
        int tournament_id FK
        string group_id
        int team_id FK
        int rank
        int points
    }
```

## 3. 主要フロー シーケンス図

### 3.1 試合結果入力フロー

```mermaid
sequenceDiagram
    actor User as 会場担当者
    participant FE as フロントエンド
    participant API as FastAPI
    participant Lock as ロックサービス
    participant Match as 試合サービス
    participant Standing as 順位計算
    participant WS as WebSocket
    participant DB as SQLite

    User->>FE: 試合選択
    FE->>API: POST /matches/{id}/lock
    API->>Lock: ロック取得
    Lock->>DB: ロック情報保存
    DB-->>Lock: OK
    Lock-->>API: ロック成功
    API-->>FE: ロックトークン

    User->>FE: スコア入力
    FE->>API: PUT /matches/{id}/score
    API->>Match: スコア更新
    Match->>DB: 試合結果保存
    Match->>Standing: 順位再計算トリガー
    Standing->>DB: 順位表更新
    DB-->>Standing: OK
    Standing-->>Match: 計算完了
    Match->>WS: 結果更新通知
    WS-->>FE: リアルタイム更新
    Match-->>API: 更新成功
    API-->>FE: 200 OK
    FE-->>User: 保存完了表示
```

### 3.2 日程生成フロー

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant FE as フロントエンド
    participant API as FastAPI
    participant Schedule as 日程生成サービス
    participant Exclusion as 除外ペアチェック
    participant DB as SQLite

    Admin->>FE: 予選日程生成ボタン
    FE->>API: POST /matches/generate-schedule/{tournament_id}
    API->>Schedule: 日程生成開始
    Schedule->>DB: チーム一覧取得
    DB-->>Schedule: 24チーム
    Schedule->>DB: 除外ペア取得
    DB-->>Schedule: 除外設定
    Schedule->>Exclusion: 除外チェック
    Exclusion-->>Schedule: 有効な対戦のみ

    loop 各グループ
        Schedule->>Schedule: ラウンドロビン生成
        Schedule->>Schedule: 会場・時間割当
    end

    Schedule->>DB: 48試合保存
    DB-->>Schedule: OK
    Schedule-->>API: 生成完了
    API-->>FE: 200 OK + 試合一覧
    FE-->>Admin: 日程表示
```

### 3.3 順位計算フロー

```mermaid
sequenceDiagram
    participant Match as 試合サービス
    participant Standing as 順位計算サービス
    participant DB as SQLite

    Match->>Standing: 順位再計算要求
    Standing->>DB: グループ内試合取得
    DB-->>Standing: 試合結果一覧

    Standing->>Standing: Step1: 勝点計算
    Note right of Standing: 勝=3, 分=1, 負=0

    Standing->>Standing: Step2: 得失点差計算

    Standing->>Standing: Step3: 総得点計算

    Standing->>Standing: Step4: 直接対決判定
    Note right of Standing: 同勝点チームの対戦結果

    Standing->>Standing: Step5: 抽選（SHA256ハッシュ）
    Note right of Standing: 決定的ランダム

    Standing->>DB: 順位表更新
    DB-->>Standing: OK
    Standing-->>Match: 計算完了
```

### 3.4 結果承認フロー

```mermaid
sequenceDiagram
    actor Venue as 会場担当者
    actor Admin as 管理者
    participant FE as フロントエンド
    participant API as FastAPI
    participant Match as 試合サービス
    participant WS as WebSocket
    participant DB as SQLite

    Venue->>FE: スコア入力・保存
    FE->>API: PUT /matches/{id}/score
    API->>Match: ステータス=pending
    Match->>DB: 保存
    Match->>WS: 承認待ち通知
    WS-->>Admin: 承認待ち表示

    Admin->>FE: 承認画面確認
    FE->>API: GET /matches/pending
    API-->>FE: 承認待ち一覧

    alt 承認する場合
        Admin->>FE: 承認ボタン
        FE->>API: POST /matches/{id}/approve
        API->>Match: ステータス=approved
        Match->>DB: 更新
        Match->>WS: 承認完了通知
    else 却下する場合
        Admin->>FE: 却下ボタン + 理由
        FE->>API: POST /matches/{id}/reject
        API->>Match: ステータス=rejected
        Match->>DB: 更新
        Match->>WS: 却下通知
        WS-->>Venue: 修正依頼
    end
```

### 3.5 最終日スケジュール生成フロー

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant FE as フロントエンド
    participant API as FastAPI
    participant FinalDay as 最終日サービス
    participant Standing as 順位サービス
    participant DB as SQLite

    Admin->>FE: 最終日自動生成
    FE->>API: POST /tournaments/{id}/final-day-schedule/generate
    API->>FinalDay: 生成開始

    FinalDay->>Standing: 各グループ順位取得
    Standing->>DB: 順位表クエリ
    DB-->>Standing: 順位データ
    Standing-->>FinalDay: グループ別順位

    FinalDay->>FinalDay: 決勝トーナメント生成
    Note right of FinalDay: A1 vs C1, B1 vs D1

    FinalDay->>DB: 予選対戦履歴取得
    DB-->>FinalDay: 対戦済みペア

    FinalDay->>FinalDay: 研修試合生成
    Note right of FinalDay: 同順位対戦（対戦済み回避）

    FinalDay->>DB: 試合データ保存
    DB-->>FinalDay: OK

    FinalDay-->>API: 警告含む結果
    API-->>FE: 生成結果 + 警告
    FE-->>Admin: 組み合わせ表示
```

## 4. 画面遷移図

```mermaid
stateDiagram-v2
    [*] --> Login: アクセス
    Login --> Dashboard: ログイン成功

    Dashboard --> TeamManagement: チーム管理
    Dashboard --> PlayerManagement: 選手管理
    Dashboard --> MatchSchedule: 日程管理
    Dashboard --> MatchResult: 結果入力
    Dashboard --> MatchApproval: 結果承認
    Dashboard --> Standings: 順位表
    Dashboard --> ScorerRanking: 得点ランキング
    Dashboard --> ExclusionSettings: 除外設定
    Dashboard --> Reports: レポート
    Dashboard --> Settings: 設定
    Dashboard --> FinalDaySchedule: 最終日

    TeamManagement --> Dashboard
    PlayerManagement --> Dashboard
    MatchSchedule --> Dashboard
    MatchResult --> Dashboard
    MatchApproval --> Dashboard
    Standings --> Dashboard
    ScorerRanking --> Dashboard
    ExclusionSettings --> Dashboard
    Reports --> Dashboard
    Settings --> Dashboard
    FinalDaySchedule --> Dashboard

    Dashboard --> Logout: ログアウト
    Logout --> [*]
```

## 5. 機能要件マトリクス

| 機能ID | 機能名 | 要件 | 実装状況 | 備考 |
|--------|--------|------|----------|------|
| F-01 | 大会作成・編集 | 高 | ✅ | |
| F-02 | 大会設定 | 高 | ✅ | |
| F-03 | グループ自動作成 | 高 | ✅ | |
| F-04 | 送信元情報設定 | 高 | ✅ | |
| F-10 | チーム登録・編集・削除 | 高 | ⚠️ | 削除UIなし |
| F-11 | グループ割当 | 高 | ✅ | |
| F-12 | CSVインポート | 中 | ✅ | |
| F-13 | チーム区分設定 | 高 | ✅ | |
| F-14 | 会場担当校フラグ | 高 | ✅ | |
| F-20 | 選手登録・編集・削除 | 高 | ✅ | |
| F-21 | Excel/CSVインポート | 高 | ✅ | |
| F-22 | 参加申込書インポート | 中 | ❓ | 要確認 |
| F-23 | 得点者サジェスト | 高 | ✅ | |
| F-24 | 選手検索 | 中 | ✅ | |
| F-30 | スタッフ登録 | 高 | ✅ | |
| F-31 | 役割設定 | 高 | ✅ | |
| F-40 | 会場登録・編集・削除 | 高 | ✅ | |
| F-41 | グループ紐付け | 高 | ✅ | |
| F-42 | 試合数上限設定 | 中 | ✅ | |
| F-50 | 対戦除外設定 | 高 | ✅ | |
| F-51 | 予選日程自動生成 | 高 | ✅ | |
| F-52 | 決勝トーナメント生成 | 高 | ✅ | |
| F-53 | 研修試合生成 | 中 | ✅ | |
| F-54 | 日程手動調整 | 中 | ✅ | |
| F-55 | 組み合わせ変更 | 中 | ✅ | |
| F-60 | スコア入力 | 最高 | ✅ | |
| F-61 | PK戦スコア入力 | 高 | ✅ | |
| F-62 | 得点者入力 | 中 | ✅ | |
| F-63 | 入力ロック機能 | 高 | ✅ | |
| F-64 | 結果承認フロー | 中 | ✅ | |
| F-70 | 順位表自動計算 | 最高 | ✅ | |
| F-71 | グループ別順位表 | 高 | ✅ | |
| F-72 | 得点ランキング | 中 | ✅ | |
| F-73 | 統計ダッシュボード | 低 | ⚠️ | 基本のみ |
| F-80 | 日次報告書PDF | 最高 | ⚠️ | core未移植 |
| F-81 | グループ順位表PDF | 高 | ⚠️ | 簡易実装 |
| F-82 | 最終日組み合わせ表PDF | 高 | ⚠️ | core未移植 |
| F-83 | 最終結果報告書PDF | 高 | ❌ | 未実装 |
| F-84 | Excel出力 | 中 | ✅ | |
| F-90 | 公開順位表 | 高 | ✅ | |
| F-91 | 公開試合一覧 | 高 | ✅ | |
| F-92 | リアルタイム更新 | 中 | ✅ | WebSocket |
| F-100 | オフライン入力対応 | 中 | ✅ | PWA |
| F-101 | IndexedDBローカル保存 | 中 | ✅ | Dexie.js |
| F-102 | 競合解決UI | 中 | ⚠️ | 基本のみ |
| F-103 | オンライン復帰時同期 | 中 | ✅ | |

### 凡例
- ✅ 実装完了
- ⚠️ 部分実装/改善必要
- ❌ 未実装
- ❓ 要確認

## 6. 発見された差異（イシュー候補）

### 6.1 高優先度

| # | 差異 | 要件 | 実装状況 | 影響度 |
|---|------|------|----------|--------|
| 1 | チーム削除UI | F-10 | UIなし | 中 |
| 2 | 最終結果報告書PDF | F-83 | 未実装 | 高 |
| 3 | 日次報告書PDF品質 | F-80 | core版と差異 | 高 |

### 6.2 中優先度

| # | 差異 | 要件 | 実装状況 | 影響度 |
|---|------|------|----------|--------|
| 4 | 統計ダッシュボード | F-73 | 基本のみ | 低 |
| 5 | 競合解決UI | F-102 | 簡易版 | 中 |
| 6 | 参加申込書インポート | F-22 | 要確認 | 中 |

## 7. 次のアクション

1. 上記差異をissues.yamlにイシューとして登録
2. 優先度順に対応計画を策定
3. coreのPDF生成機能をimpl-repoに移植
