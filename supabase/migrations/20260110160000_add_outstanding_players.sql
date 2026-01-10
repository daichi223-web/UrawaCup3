-- 優秀選手テーブル
-- 最優秀選手1名、優秀選手11名を登録

CREATE TABLE IF NOT EXISTS outstanding_players (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  -- 選手情報
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  -- 手動入力用（選手マスタに登録がない場合）
  team_name VARCHAR(100),
  player_name VARCHAR(100) NOT NULL,
  player_number INTEGER,
  -- 賞の種類: mvp = 最優秀選手, outstanding = 優秀選手
  award_type VARCHAR(20) NOT NULL CHECK (award_type IN ('mvp', 'outstanding')),
  -- 表示順序
  display_order INTEGER NOT NULL DEFAULT 0,
  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_outstanding_players_tournament ON outstanding_players(tournament_id);
CREATE INDEX idx_outstanding_players_award_type ON outstanding_players(award_type);

-- 最優秀選手は1名のみの制約
CREATE UNIQUE INDEX idx_outstanding_players_mvp_unique
ON outstanding_players(tournament_id)
WHERE award_type = 'mvp';

-- コメント
COMMENT ON TABLE outstanding_players IS '優秀選手テーブル';
COMMENT ON COLUMN outstanding_players.award_type IS '賞の種類: mvp=最優秀選手, outstanding=優秀選手';
COMMENT ON COLUMN outstanding_players.display_order IS '表示順序（優秀選手内での並び順）';

-- RLS有効化
ALTER TABLE outstanding_players ENABLE ROW LEVEL SECURITY;

-- ポリシー（認証ユーザーのみ）
CREATE POLICY "Allow all for authenticated users" ON outstanding_players
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 閲覧は全員可能
CREATE POLICY "Allow read for all" ON outstanding_players
  FOR SELECT TO anon
  USING (true);
