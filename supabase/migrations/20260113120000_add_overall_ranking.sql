-- =====================================================
-- 総合順位機能追加マイグレーション
-- =====================================================

-- tournaments テーブルに qualification_rule カラムを追加
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS qualification_rule VARCHAR(20) DEFAULT 'group_based';

-- 説明コメント
COMMENT ON COLUMN tournaments.qualification_rule IS '決勝進出ルール: group_based (グループ1位) or overall_ranking (総合順位1-4位)';

-- standings テーブルに overall_rank カラムを追加
ALTER TABLE standings
ADD COLUMN IF NOT EXISTS overall_rank INTEGER;

-- 説明コメント
COMMENT ON COLUMN standings.overall_rank IS '総合順位（全グループ通しての順位）';

-- インデックス追加（総合順位でのソート高速化）
CREATE INDEX IF NOT EXISTS idx_standings_overall_rank
ON standings(tournament_id, overall_rank)
WHERE overall_rank IS NOT NULL;
