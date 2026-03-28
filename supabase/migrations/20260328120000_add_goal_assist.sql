-- goals テーブルにアシスト関連カラムを追加
ALTER TABLE goals ADD COLUMN IF NOT EXISTS assist_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS assist_player_name VARCHAR(100);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS assist_jersey_number INTEGER;
