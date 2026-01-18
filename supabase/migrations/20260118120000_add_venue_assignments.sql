-- 会場配置テーブル（新フォーマット対応: チームの会場・日別配置を管理）
CREATE TABLE IF NOT EXISTS venue_assignments (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_day INTEGER NOT NULL,                            -- 試合日（1 or 2）
    slot_order INTEGER NOT NULL,                           -- 会場内の順番（1, 2, 3, 4...）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, team_id, match_day)              -- 同一大会・同一チーム・同一日は1エントリのみ
);

-- RLS有効化
ALTER TABLE venue_assignments ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
DROP POLICY IF EXISTS "Public read access" ON venue_assignments;
CREATE POLICY "Public read access" ON venue_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full access" ON venue_assignments;
CREATE POLICY "Admin full access" ON venue_assignments FOR ALL USING (is_admin());

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_venue_assignments_tournament_id ON venue_assignments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_venue_id ON venue_assignments(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_team_id ON venue_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_match_day ON venue_assignments(match_day);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_tournament_match_day ON venue_assignments(tournament_id, match_day);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_venue_match_day ON venue_assignments(venue_id, match_day);

-- 更新トリガー
DROP TRIGGER IF EXISTS update_venue_assignments_updated_at ON venue_assignments;
CREATE TRIGGER update_venue_assignments_updated_at BEFORE UPDATE ON venue_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- コメント
COMMENT ON TABLE venue_assignments IS '会場配置テーブル（1リーグ制用）';
COMMENT ON COLUMN venue_assignments.tournament_id IS '大会ID';
COMMENT ON COLUMN venue_assignments.venue_id IS '会場ID';
COMMENT ON COLUMN venue_assignments.team_id IS 'チームID';
COMMENT ON COLUMN venue_assignments.match_day IS '試合日（1 or 2）';
COMMENT ON COLUMN venue_assignments.slot_order IS '会場内の順番（1, 2, 3, 4...）';

-- =====================================================
-- matchesテーブルに新フォーマット用カラムを追加
-- =====================================================

-- is_b_matchカラム追加（B戦フラグ）
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_b_match BOOLEAN DEFAULT FALSE;

-- match_dayカラム追加（試合日）
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_day INTEGER;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_matches_is_b_match ON matches(is_b_match);
CREATE INDEX IF NOT EXISTS idx_matches_match_day ON matches(match_day);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_match_day ON matches(tournament_id, match_day);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_is_b_match ON matches(tournament_id, is_b_match);

-- コメント
COMMENT ON COLUMN matches.is_b_match IS 'B戦フラグ（順位計算から除外）';
COMMENT ON COLUMN matches.match_day IS '試合日（1 or 2）';
