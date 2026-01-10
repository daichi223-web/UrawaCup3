-- 大会時間設定カラムを追加
-- 予選リーグと決勝トーナメントで別々の開始時刻・試合時間・間隔を設定可能にする

-- 予選リーグ用
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS preliminary_start_time TIME DEFAULT '09:00';

-- 決勝トーナメント用
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS finals_start_time TIME DEFAULT '09:00';

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS finals_match_duration INTEGER DEFAULT 60;

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS finals_interval_minutes INTEGER DEFAULT 20;

-- コメント追加
COMMENT ON COLUMN tournaments.preliminary_start_time IS '予選リーグ第1試合開始時刻';
COMMENT ON COLUMN tournaments.finals_start_time IS '決勝トーナメント第1試合開始時刻';
COMMENT ON COLUMN tournaments.finals_match_duration IS '決勝トーナメント試合時間（分）';
COMMENT ON COLUMN tournaments.finals_interval_minutes IS '決勝トーナメント試合間隔（分）';
