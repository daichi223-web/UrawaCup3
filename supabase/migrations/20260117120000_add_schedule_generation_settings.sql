-- 試合生成設定の拡張
-- 決勝トーナメント、研修試合の詳細設定を追加

-- =====================================================
-- 決勝トーナメント設定
-- =====================================================

-- 組み合わせ方式: 'diagonal' (A1vsC1,B1vsD1) or 'seed_order' (1vs4,2vs3)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS bracket_method VARCHAR(20) DEFAULT 'seed_order';

COMMENT ON COLUMN tournaments.bracket_method IS '決勝組み合わせ方式: diagonal (対角線) or seed_order (順位順)';

-- =====================================================
-- 研修試合設定
-- =====================================================

-- 研修試合の試合時間（分）
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS training_match_duration INTEGER DEFAULT 40;

-- 研修試合の試合間隔（分）
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS training_interval_minutes INTEGER DEFAULT 5;

-- 研修試合のチームあたり試合数
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS training_matches_per_team INTEGER DEFAULT 2;

COMMENT ON COLUMN tournaments.training_match_duration IS '研修試合の試合時間（分）';
COMMENT ON COLUMN tournaments.training_interval_minutes IS '研修試合の試合間隔（分）';
COMMENT ON COLUMN tournaments.training_matches_per_team IS '研修試合のチームあたり試合数';

-- =====================================================
-- 対戦制約の優先度設定（JSON形式で柔軟に）
-- =====================================================

-- 対戦制約の優先度スコア設定
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS match_constraint_scores JSONB DEFAULT '{
  "already_played": 200,
  "same_league": 100,
  "same_region": 50,
  "local_teams": 30,
  "consecutive_match": 20
}'::jsonb;

COMMENT ON COLUMN tournaments.match_constraint_scores IS '対戦制約の優先度スコア（低いほど優先）';

-- =====================================================
-- schema.sql も更新
-- =====================================================
