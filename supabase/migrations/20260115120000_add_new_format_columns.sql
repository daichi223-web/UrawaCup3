-- 新方式（1リーグ制）対応カラムを追加
-- use_group_system: グループ制を使用するかどうか（FALSE=新方式）
-- venue_count: 会場数
-- teams_per_venue: 1会場あたりのチーム数
-- matches_per_team_per_day: 1日あたりの各チームの試合数
-- preliminary_days: 予選日数

-- use_group_systemカラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS use_group_system BOOLEAN DEFAULT TRUE;

-- venue_countカラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS venue_count INTEGER DEFAULT 6;

-- teams_per_venueカラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS teams_per_venue INTEGER DEFAULT 4;

-- matches_per_team_per_dayカラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS matches_per_team_per_day INTEGER DEFAULT 2;

-- preliminary_daysカラム追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS preliminary_days INTEGER DEFAULT 2;

-- b_match_slotsカラム追加（B戦スロット）
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS b_match_slots INTEGER[] DEFAULT '{3, 6}';

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_tournaments_use_group_system ON tournaments(use_group_system);

-- コメント
COMMENT ON COLUMN tournaments.use_group_system IS 'TRUE=グループリーグ制（旧方式）, FALSE=1リーグ制（新方式）';
COMMENT ON COLUMN tournaments.venue_count IS '会場数（新方式用）';
COMMENT ON COLUMN tournaments.teams_per_venue IS '1会場あたりのチーム数（新方式用）';
COMMENT ON COLUMN tournaments.matches_per_team_per_day IS '1日あたりの各チームの試合数（新方式用）';
COMMENT ON COLUMN tournaments.preliminary_days IS '予選日数（新方式用）';
COMMENT ON COLUMN tournaments.b_match_slots IS 'B戦スロット番号の配列（新方式用、例: {3, 6}は第3試合と第6試合がB戦）';
