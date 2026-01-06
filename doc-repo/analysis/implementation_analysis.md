# 実装分析ドキュメント

**作成日**: 2026-01-06
**対象**: impl-repo (D:\UrawaCup2\impl-repo)

---

## 1. 実装側システム構成図

```mermaid
graph TB
    subgraph "フロントエンド (React 18 + TypeScript)"
        FE[Vite Dev Server]
        PAGES[13 Pages]
        STORE[Zustand Store]
        QUERY[TanStack Query]
        AXIOS[Axios Client]
    end

    subgraph "バックエンド (FastAPI)"
        MAIN[main.py]

        subgraph "Routes (11ファイル)"
            AUTH[auth.py]
            TEAMS[teams.py]
            PLAYERS[players.py]
            MATCHES[matches.py]
            STANDINGS[standings.py]
            REPORTS[reports.py]
            FINAL[final_day.py]
            VENUES[venues.py]
            STAFF[staff.py]
            EXCL[exclusions.py]
            TOURN[tournaments.py]
        end

        subgraph "Services"
            SCHED[schedule.py]
            FDSVC[final_day.py]
            STDSVC[standings.py]
            AUTHSVC[auth.py]
        end

        subgraph "Reports"
            DAILY[daily_report.py]
            FINAL_RPT[final_result.py]
        end

        subgraph "Models (17テーブル)"
            MODELS[SQLAlchemy Models]
        end
    end

    subgraph "データ層"
        DB[(SQLite<br/>urawacup.db)]
    end

    FE --> PAGES
    PAGES --> STORE
    PAGES --> QUERY
    QUERY --> AXIOS
    AXIOS --> MAIN
    MAIN --> AUTH & TEAMS & PLAYERS & MATCHES
    MAIN --> STANDINGS & REPORTS & FINAL
    MAIN --> VENUES & STAFF & EXCL & TOURN

    MATCHES --> SCHED
    FINAL --> FDSVC
    STANDINGS --> STDSVC
    AUTH --> AUTHSVC
    REPORTS --> DAILY & FINAL_RPT

    AUTH & TEAMS & PLAYERS & MATCHES --> MODELS
    MODELS --> DB
```

---

## 2. 実装側ER図

```mermaid
erDiagram
    tournaments ||--o{ groups : has
    tournaments ||--o{ teams : has
    tournaments ||--o{ venues : has
    tournaments ||--o{ matches : has
    tournaments ||--o{ standings : has
    tournaments ||--o{ exclusion_pairs : has
    tournaments ||--o{ tournament_awards : has
    tournaments ||--o{ report_recipients : has

    groups ||--o{ teams : contains
    groups ||--o{ matches : hosts

    teams ||--o{ players : has
    teams ||--o{ staff : has
    teams ||--o{ team_uniforms : has
    teams ||--o{ goals : scores
    teams ||--o{ standings : ranked_in

    venues ||--o{ matches : hosts

    matches ||--o{ goals : has
    matches }o--|| users : locked_by
    matches }o--|| users : entered_by
    matches }o--|| users : approved_by

    players ||--o{ goals : scores
    players ||--o{ tournament_awards : receives

    tournaments {
        int id PK
        string name
        int edition
        date start_date
        date end_date
        string sender_organization
        string sender_name
        string sender_contact
    }

    teams {
        int id PK
        int tournament_id FK
        string group_id FK
        string name
        string short_name
        string team_type
        bool is_host
        int group_order
    }

    matches {
        int id PK
        int tournament_id FK
        int venue_id FK
        int home_team_id FK
        int away_team_id FK
        date match_date
        time match_time
        string stage
        string status
        int home_score_total
        int away_score_total
        bool is_locked
        int locked_by FK
    }

    standings {
        int id PK
        int tournament_id FK
        string group_id
        int team_id FK
        int rank
        int points
        int goal_difference
        string rank_reason
    }

    goals {
        int id PK
        int match_id FK
        int team_id FK
        int player_id FK
        string scorer_name
        int minute
        int half
    }

    users {
        int id PK
        string username
        string password_hash
        string role
        int venue_id FK
    }
```

---

## 3. 実装側シーケンス図

### 3.1 試合結果入力フロー（実装）

```mermaid
sequenceDiagram
    actor User as 会場担当者
    participant FE as MatchResult.tsx
    participant API as matches.py
    participant Lock as ロック処理
    participant Score as スコア処理
    participant Stand as standings.py
    participant WS as WebSocket
    participant DB as SQLite

    User->>FE: 試合選択
    FE->>API: POST /matches/{id}/lock
    API->>Lock: acquire_lock()
    Lock->>DB: UPDATE matches SET is_locked=true
    DB-->>Lock: OK
    Lock-->>API: ロック成功
    API-->>FE: {locked: true, token: xxx}

    User->>FE: スコア入力
    FE->>API: PUT /matches/{id}/score
    API->>Score: update_score()
    Score->>DB: UPDATE matches (scores)
    Score->>DB: INSERT/UPDATE goals
    Score->>Stand: recalculate_standings()
    Stand->>DB: UPDATE standings
    DB-->>Stand: OK
    Stand-->>Score: 計算完了
    Score->>WS: broadcast("match_updated")
    WS-->>FE: リアルタイム更新
    Score-->>API: 更新成功
    API-->>FE: 200 OK + match data
    FE-->>User: 保存完了表示
```

### 3.2 予選日程生成フロー（実装）

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant FE as MatchSchedule.tsx
    participant API as matches.py
    participant Sched as schedule.py
    participant DB as SQLite

    Admin->>FE: 予選日程生成ボタン
    FE->>API: POST /matches/generate-schedule/{tournament_id}
    API->>Sched: generate_preliminary_schedule()

    Sched->>DB: SELECT groups WHERE tournament_id
    DB-->>Sched: グループ一覧

    Sched->>DB: SELECT exclusion_pairs WHERE tournament_id
    DB-->>Sched: 除外ペア一覧

    loop 各グループ
        Sched->>DB: SELECT teams WHERE group_id
        DB-->>Sched: チーム一覧（6チーム）
        Sched->>Sched: 総当たり対戦生成（除外ペア除く）
        Sched->>Sched: 日時・会場割当
        Sched->>DB: INSERT matches (複数)
    end

    DB-->>Sched: OK
    Sched-->>API: 生成完了
    API-->>FE: 200 OK + matches[]
    FE-->>Admin: 日程表示
```

### 3.3 最終日組み合わせ生成フロー（実装）

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant FE as FinalDaySchedule.tsx
    participant API as final_day.py
    participant Svc as FinalDayService
    participant Logic as FinalDayLogic
    participant DB as SQLite

    Admin->>FE: 最終日自動生成ボタン
    FE->>API: POST /tournaments/{id}/final-day-schedule/generate
    API->>Svc: generate_schedule(tournament_id)

    Svc->>DB: SELECT tournament WHERE id
    DB-->>Svc: 大会情報（end_date取得）

    Svc->>DB: SELECT DISTINCT group_id FROM teams
    DB-->>Svc: グループ一覧（A,B,C,D）

    loop 各グループ
        Svc->>DB: SELECT standings ORDER BY rank
        DB-->>Svc: 順位データ
    end

    Svc->>DB: SELECT matches WHERE stage=preliminary
    DB-->>Svc: 対戦履歴

    Svc->>Logic: new FinalDayLogic(standings, played_pairs)
    Logic->>Logic: generate()

    Note over Logic: 決勝T生成<br/>A1 vs C1, B1 vs D1<br/>SF敗者→3位決定戦<br/>SF勝者→決勝

    Note over Logic: 研修試合生成<br/>同順位対戦（A2 vs C2, B2 vs D2）<br/>対戦済み回避

    Logic-->>Svc: {tournament, training, warnings}

    Svc->>DB: DELETE matches WHERE stage IN (semifinal, final, training)
    Svc->>DB: INSERT matches (決勝T + 研修)
    DB-->>Svc: OK

    Svc-->>API: matches[]
    API-->>FE: 200 OK + matches[]
    FE-->>Admin: 組み合わせ表示
```

### 3.4 順位計算フロー（実装）

```mermaid
sequenceDiagram
    participant Trigger as 試合結果入力
    participant Stand as standings.py
    participant DB as SQLite

    Trigger->>Stand: recalculate_standings(tournament_id, group_id)

    Stand->>DB: SELECT matches WHERE group_id AND status=completed
    DB-->>Stand: 試合結果一覧

    Stand->>Stand: Step1: 勝点計算
    Note right of Stand: 勝=3, 分=1, 負=0

    Stand->>Stand: Step2: 得失点差計算
    Note right of Stand: goals_for - goals_against

    Stand->>Stand: Step3: 総得点計算

    Stand->>Stand: Step4: 直接対決判定
    Note right of Stand: 同勝点チームの対戦結果で比較

    Stand->>Stand: Step5: 抽選（SHA256ハッシュ）
    Note right of Stand: hash(tournament_id + team_ids)<br/>決定的ランダム

    Stand->>Stand: rank_reason設定
    Note right of Stand: "勝点" / "得失点差" / "総得点" / "直接対決" / "抽選"

    Stand->>DB: UPSERT standings
    DB-->>Stand: OK
    Stand-->>Trigger: 計算完了
```

### 3.5 PDF生成フロー（実装）

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant FE as Reports.tsx
    participant API as reports.py
    participant Gen as DailyReportGenerator
    participant DB as SQLite
    participant PDF as ReportLab

    Admin->>FE: PDF出力ボタン
    FE->>API: GET /reports/daily/pdf?tournament_id=1&date=2026-03-25

    API->>Gen: new DailyReportGenerator(db)
    API->>Gen: generate(tournament_id, target_date)

    Gen->>DB: SELECT tournament WHERE id
    DB-->>Gen: 大会情報

    Gen->>DB: SELECT matches WHERE date AND status=completed
    DB-->>Gen: 試合一覧（会場別）

    Gen->>DB: SELECT goals WHERE match_id IN (...)
    DB-->>Gen: 得点者一覧

    Gen->>PDF: SimpleDocTemplate()

    loop 各会場
        Gen->>PDF: Table(ヘッダー情報)
        loop 各試合
            Gen->>PDF: Table(スコア + 得点経過)
        end
        Gen->>PDF: PageBreak()
    end

    Gen->>PDF: doc.build(story)
    PDF-->>Gen: PDF bytes
    Gen-->>API: BytesIO
    API-->>FE: StreamingResponse(PDF)
    FE-->>Admin: PDFダウンロード
```

---

## 4. 要件 vs 実装 比較表

### 4.1 機能要件チェックリスト

| ID | 機能 | 要件 | 実装状態 | 備考 |
|----|------|------|----------|------|
| F-01 | 大会作成・編集 | 高 | ✅完全 | グループA-D自動作成 |
| F-02 | 大会設定 | 高 | ✅完全 | Settings.tsx |
| F-03 | グループ自動作成 | 高 | ✅完全 | 大会作成時に自動 |
| F-04 | 送信元情報設定 | 高 | ✅完全 | Settings.tsx |
| F-10 | チーム登録・編集・削除 | 高 | ⚠️部分的 | **削除UIなし** |
| F-11 | グループ割当 | 高 | ✅完全 | |
| F-12 | CSVインポート | 中 | ✅完全 | teams.py /import |
| F-13 | チーム区分設定 | 高 | ✅完全 | local/invited |
| F-14 | 会場担当校フラグ | 高 | ✅完全 | is_host |
| F-20 | 選手登録・編集・削除 | 高 | ⚠️部分的 | **編集・削除UIスタブ** |
| F-21 | Excel/CSVインポート | 高 | ⚠️部分的 | **CSVのみ実装** |
| F-22 | 参加申込書インポート | 中 | ❌未実装 | 2列構成未対応 |
| F-23 | 得点者サジェスト | 高 | ✅完全 | /players/suggest |
| F-24 | 選手検索 | 中 | ✅完全 | |
| F-30 | スタッフ登録 | 高 | ✅完全 | staff.py |
| F-31 | 役割設定 | 高 | ✅完全 | manager/coach/referee |
| F-40 | 会場登録・編集・削除 | 高 | ✅完全 | venues.py |
| F-41 | グループ紐付け | 高 | ✅完全 | |
| F-42 | 試合数上限設定 | 中 | ✅完全 | max_matches_per_day |
| F-50 | 対戦除外設定 | 高 | ✅完全 | exclusions.py |
| F-51 | 予選日程自動生成 | 高 | ✅完全 | schedule.py |
| F-52 | 決勝トーナメント生成 | 高 | ✅完全 | final_day.py |
| F-53 | 研修試合生成 | 中 | ✅完全 | 同順位対戦 |
| F-54 | 日程手動調整 | 中 | ✅完全 | |
| F-55 | 組み合わせ変更 | 中 | ✅完全 | 入れ替えボタン |
| F-60 | スコア入力 | 最高 | ✅完全 | |
| F-61 | PK戦スコア入力 | 高 | ✅完全 | |
| F-62 | 得点者入力 | 中 | ✅完全 | サジェスト付き |
| F-63 | 入力ロック機能 | 高 | ✅完全 | is_locked統合 |
| F-64 | 結果承認フロー | 中 | ✅完全 | approve/reject/resubmit |
| F-70 | 順位表自動計算 | 最高 | ✅完全 | |
| F-71 | グループ別順位表 | 高 | ✅完全 | |
| F-72 | 得点ランキング | 中 | ✅完全 | /standings/scorers |
| F-73 | 統計ダッシュボード | 低 | ⚠️部分的 | 基本のみ |
| F-80 | 日次報告書PDF | 最高 | ✅完全 | Platypus実装 |
| F-81 | グループ順位表PDF | 高 | ⚠️部分的 | Excel出力のみ |
| F-82 | 最終日組み合わせ表PDF | 高 | ❌未実装 | |
| F-83 | 最終結果報告書PDF | 高 | ✅完全 | Platypus実装 |
| F-84 | Excel出力 | 中 | ⚠️部分的 | 順位表のみ |
| F-90 | 公開順位表 | 高 | ✅完全 | /public/standings |
| F-91 | 公開試合一覧 | 高 | ✅完全 | /public/matches |
| F-92 | リアルタイム更新 | 中 | ✅完全 | WebSocket |
| F-100 | オフライン入力対応 | 中 | ❌未実装 | PWA未実装 |
| F-101 | IndexedDBローカル保存 | 中 | ❌未実装 | |
| F-102 | 競合解決UI | 中 | ❌未実装 | |
| F-103 | オンライン復帰時同期 | 中 | ❌未実装 | |

### 4.2 API比較

| 要件パス | 要件メソッド | 実装パス | 実装メソッド | 状態 |
|---------|-------------|---------|-------------|------|
| /api/auth/login | POST | /api/auth/login | POST | ✅一致 |
| /api/auth/logout | POST | /api/auth/logout | POST | ✅一致 |
| /api/auth/me | GET | /api/auth/me | GET | ✅一致 |
| /api/tournaments | GET/POST | /api/tournaments | GET/POST | ✅一致 |
| /api/tournaments/{id} | PATCH | /api/tournaments/{id} | PUT/PATCH | ✅一致 |
| /api/teams | GET/POST | /api/teams | GET/POST | ✅一致 |
| /api/teams/{id} | PATCH | /api/teams/{id} | PUT | ⚠️PUT |
| /api/matches/{id}/lock | DELETE | /api/matches/{id}/lock | DELETE | ✅一致 |
| /api/reports/daily | GET | /api/reports/daily/pdf | GET | ⚠️パス異なる |
| /api/final-day-matches/swap | POST | なし | - | ❌未実装 |

### 4.3 画面比較

| 要件画面 | URL | 実装ファイル | 状態 |
|---------|-----|-------------|------|
| S-01 ログイン | /login | Login.tsx | ✅完全 |
| S-02 ダッシュボード | / | Dashboard.tsx | ✅完全 |
| S-03 チーム管理 | /teams | TeamManagement.tsx | ⚠️削除UIなし |
| S-04 選手管理 | /players | PlayerManagement.tsx | ⚠️編集UIスタブ |
| S-05 日程管理 | /schedule | MatchSchedule.tsx | ✅完全 |
| S-06 結果入力 | /results | MatchResult.tsx | ✅完全 |
| S-07 結果承認 | /approval | MatchApproval.tsx | ✅完全 |
| S-08 順位表 | /standings | Standings.tsx | ✅完全 |
| S-09 得点ランキング | /scorers | ScorerRanking.tsx | ✅完全 |
| S-10 対戦除外設定 | /exclusions | ExclusionSettings.tsx | ✅完全 |
| S-11 レポート | /reports | Reports.tsx | ⚠️Excel出力スタブ |
| S-12 設定 | /settings | Settings.tsx | ✅完全 |
| S-13 最終日組み合わせ | /final-day | FinalDaySchedule.tsx | ✅完全 |
| P-01 公開順位表 | /public/standings | 要確認 | ⚠️tournamentIdハードコード |
| P-02 公開試合一覧 | /public/matches | 要確認 | ⚠️tournamentIdハードコード |

---

## 5. 発見された差異（新規イシュー候補）

### 5.1 高優先度

| # | 差異 | 影響 |
|---|------|------|
| 1 | F-82 最終日組み合わせ表PDF未実装 | 最終日の印刷物がない |
| 2 | F-100〜103 PWA/オフライン機能未実装 | 会場でのネット障害時に使用不可 |
| 3 | チーム削除UIなし（F-10） | 誤登録時の削除が不便 |
| 4 | 選手編集・削除UIスタブ（F-20） | 選手管理が不完全 |

### 5.2 中優先度

| # | 差異 | 影響 |
|---|------|------|
| 5 | F-21 Excelインポート未実装 | CSVのみ対応 |
| 6 | F-22 参加申込書インポート未実装 | 2列構成フォーマット未対応 |
| 7 | F-81 順位表PDF未実装（Excel only） | PDF出力不可 |
| 8 | 公開画面tournamentIdハードコード | 複数大会運用不可 |
| 9 | /api/final-day-matches/swap未実装 | API経由の入れ替え不可 |

---

## 6. 実装完了率サマリー

| カテゴリ | 要件数 | 完全実装 | 部分実装 | 未実装 | 完了率 |
|---------|-------|---------|---------|--------|--------|
| 大会管理 (F-01〜04) | 4 | 4 | 0 | 0 | 100% |
| チーム管理 (F-10〜14) | 5 | 4 | 1 | 0 | 90% |
| 選手管理 (F-20〜24) | 5 | 2 | 2 | 1 | 60% |
| スタッフ管理 (F-30〜31) | 2 | 2 | 0 | 0 | 100% |
| 会場管理 (F-40〜42) | 3 | 3 | 0 | 0 | 100% |
| 日程管理 (F-50〜55) | 6 | 6 | 0 | 0 | 100% |
| 試合結果 (F-60〜64) | 5 | 5 | 0 | 0 | 100% |
| 順位表 (F-70〜73) | 4 | 3 | 1 | 0 | 88% |
| レポート (F-80〜84) | 5 | 2 | 2 | 1 | 60% |
| 公開機能 (F-90〜92) | 3 | 3 | 0 | 0 | 100% |
| PWA (F-100〜103) | 4 | 0 | 0 | 4 | 0% |
| **合計** | **46** | **34** | **6** | **6** | **74%** |

---

## 7. 推奨アクション

### 即時対応（大会運用に影響）
1. チーム削除UIの追加
2. 選手編集・削除UIの実装
3. 公開画面のtournamentId動的化

### 短期対応（利便性向上）
4. 最終日組み合わせ表PDF実装
5. 順位表PDF実装
6. Excelインポート対応

### 中長期対応（機能拡張）
7. PWA/オフライン対応
8. 参加申込書インポート
