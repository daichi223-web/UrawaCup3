-- 混合会場（決勝＋研修）のサポート
-- 決勝トーナメントの試合を行った後、同じ会場で研修試合を行う設定

-- venues テーブルに混合会場フラグと決勝試合数を追加
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS is_mixed_use BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS finals_match_count INTEGER NOT NULL DEFAULT 1;

-- matches テーブルに試合時間（分）を追加（会場/試合種別による動的計算用）
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS match_duration_minutes INTEGER;

-- コメント
COMMENT ON COLUMN venues.is_mixed_use IS '混合会場フラグ（決勝トーナメント＋研修試合を同一会場で行う）';
COMMENT ON COLUMN venues.finals_match_count IS '混合会場での決勝トーナメント試合数（デフォルト1）';
COMMENT ON COLUMN matches.match_duration_minutes IS '試合時間（分）。NULL の場合は大会設定を使用';
