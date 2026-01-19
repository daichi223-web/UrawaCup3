-- 対戦回避設定をtournamentsテーブルに追加
-- これらの設定はDB保存され、アプリケーション起動時に読み込まれる

-- =====================================================
-- 対戦回避設定（チーム属性）
-- =====================================================

-- 地元チーム同士の対戦を避ける
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS avoid_local_vs_local BOOLEAN DEFAULT false;

-- 同一地域チームの対戦を避ける
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS avoid_same_region BOOLEAN DEFAULT false;

-- 同一リーグチームの対戦を避ける
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS avoid_same_league BOOLEAN DEFAULT false;

-- =====================================================
-- 日程による制約設定
-- =====================================================

-- 連戦を警告
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS avoid_consecutive BOOLEAN DEFAULT true;

-- 1日3試合以上を警告
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS warn_daily_game_limit BOOLEAN DEFAULT true;

-- 2日間で5試合以上を警告
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS warn_total_game_limit BOOLEAN DEFAULT true;

-- =====================================================
-- マスタデータ（地域・リーグ一覧）
-- =====================================================

-- 地域マスタ（JSON配列）
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS region_master JSONB DEFAULT '[]'::jsonb;

-- リーグマスタ（JSON配列）
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS league_master JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- コメント追加
-- =====================================================

COMMENT ON COLUMN tournaments.avoid_local_vs_local IS '地元チーム同士の対戦を避ける';
COMMENT ON COLUMN tournaments.avoid_same_region IS '同一地域チームの対戦を避ける';
COMMENT ON COLUMN tournaments.avoid_same_league IS '同一リーグチームの対戦を避ける';
COMMENT ON COLUMN tournaments.avoid_consecutive IS '連戦を警告';
COMMENT ON COLUMN tournaments.warn_daily_game_limit IS '1日3試合以上を警告';
COMMENT ON COLUMN tournaments.warn_total_game_limit IS '2日間で5試合以上を警告';
COMMENT ON COLUMN tournaments.region_master IS '地域マスタ（JSON配列）';
COMMENT ON COLUMN tournaments.league_master IS 'リーグマスタ（JSON配列）';
