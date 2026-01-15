-- goalsテーブルに背番号カラムを追加
ALTER TABLE goals ADD COLUMN IF NOT EXISTS jersey_number INTEGER;

COMMENT ON COLUMN goals.jersey_number IS '得点者の背番号';
