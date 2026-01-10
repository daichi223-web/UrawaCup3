-- 発信元設定テーブル
CREATE TABLE IF NOT EXISTS sender_settings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    recipient TEXT DEFAULT '埼玉県サッカー協会 御中',
    sender_name TEXT DEFAULT '',
    sender_title TEXT DEFAULT '',
    sender_organization TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id)
);

-- RLSポリシー
ALTER TABLE sender_settings ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能
CREATE POLICY "sender_settings_select_policy" ON sender_settings
    FOR SELECT USING (true);

-- 認証済みユーザーのみ挿入・更新・削除可能
CREATE POLICY "sender_settings_insert_policy" ON sender_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sender_settings_update_policy" ON sender_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "sender_settings_delete_policy" ON sender_settings
    FOR DELETE USING (auth.role() = 'authenticated');

-- 更新時のタイムスタンプ自動更新
CREATE OR REPLACE FUNCTION update_sender_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sender_settings_updated_at_trigger
    BEFORE UPDATE ON sender_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_sender_settings_updated_at();

-- デフォルトデータ挿入（tournament_id=1用）
INSERT INTO sender_settings (tournament_id, recipient, sender_name, sender_organization, contact)
VALUES (1, '埼玉県サッカー協会 御中', '', '県立浦和高校', '')
ON CONFLICT (tournament_id) DO NOTHING;
