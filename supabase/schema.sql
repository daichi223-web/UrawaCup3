-- =====================================================
-- 浦和カップ トーナメント管理システム - Supabase Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUM Types (Idempotent)
-- =====================================================

DO $$ BEGIN
    CREATE TYPE team_type AS ENUM ('local', 'invited');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_stage AS ENUM ('preliminary', 'semifinal', 'third_place', 'final', 'training');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_result AS ENUM ('home_win', 'away_win', 'draw');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'venue_staff', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. Tables (Create IF NOT EXISTS)
-- =====================================================

-- 大会テーブル
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(100),
    edition INTEGER NOT NULL DEFAULT 1,
    year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    match_duration INTEGER NOT NULL DEFAULT 50,
    half_duration INTEGER NOT NULL DEFAULT 25,
    interval_minutes INTEGER NOT NULL DEFAULT 15,
    preliminary_start_time TIME DEFAULT '09:00',
    finals_start_time TIME DEFAULT '09:00',
    finals_match_duration INTEGER DEFAULT 60,
    finals_interval_minutes INTEGER DEFAULT 20,
    group_count INTEGER DEFAULT 4,
    teams_per_group INTEGER DEFAULT 4,
    advancing_teams INTEGER DEFAULT 1,
    qualification_rule VARCHAR(20) DEFAULT 'group_based',  -- 'group_based' or 'overall_ranking'
    sender_organization VARCHAR(100),
    sender_name VARCHAR(100),
    sender_contact VARCHAR(100),
    -- 新フォーマット対応カラム
    venue_count INTEGER DEFAULT 6,                         -- 会場数
    teams_per_venue INTEGER DEFAULT 4,                     -- 1会場のチーム数
    matches_per_team_per_day INTEGER DEFAULT 2,            -- 1日の試合数/チーム
    preliminary_days INTEGER DEFAULT 2,                    -- 予選日数
    b_match_slots INTEGER[] DEFAULT '{3, 6}',              -- B戦スロット（第何試合がB戦か）
    use_group_system BOOLEAN DEFAULT TRUE,                 -- グループ制使用フラグ（後方互換のためTRUE）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- グループテーブル（複合主キー）
CREATE TABLE IF NOT EXISTS groups (
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    id VARCHAR(1) NOT NULL,
    name VARCHAR(50) NOT NULL,
    venue_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tournament_id, id)
);

-- 会場テーブル
CREATE TABLE IF NOT EXISTS venues (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(300),
    group_id VARCHAR(1),
    max_matches_per_day INTEGER NOT NULL DEFAULT 6,
    for_preliminary BOOLEAN NOT NULL DEFAULT TRUE,
    for_final_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_finals_venue BOOLEAN NOT NULL DEFAULT FALSE,
    manager_team_id INTEGER,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE SET NULL
);

-- リーグテーブル（制約設定用）
CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

-- 地域テーブル（制約設定用）
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

-- チームテーブル
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    team_type team_type NOT NULL DEFAULT 'invited',
    is_venue_host BOOLEAN NOT NULL DEFAULT FALSE,
    group_id VARCHAR(1),
    group_order INTEGER,
    prefecture VARCHAR(20),
    region VARCHAR(50),  -- 地域（制約チェック用）
    league_id INTEGER REFERENCES leagues(id) ON DELETE SET NULL,  -- リーグ（制約チェック用）
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE SET NULL
);

-- ユーザープロファイルテーブル
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role user_role NOT NULL DEFAULT 'viewer',
    venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 試合テーブル
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(1),
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    home_team_id INTEGER REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id INTEGER REFERENCES teams(id) ON DELETE RESTRICT,
    match_date DATE NOT NULL,
    match_time TIME NOT NULL,
    match_order INTEGER NOT NULL,
    stage match_stage NOT NULL DEFAULT 'preliminary',
    status match_status NOT NULL DEFAULT 'scheduled',
    home_score_half1 INTEGER,
    home_score_half2 INTEGER,
    home_score_total INTEGER,
    away_score_half1 INTEGER,
    away_score_half2 INTEGER,
    away_score_total INTEGER,
    home_pk INTEGER,
    away_pk INTEGER,
    has_penalty_shootout BOOLEAN NOT NULL DEFAULT FALSE,
    result match_result,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    entered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entered_at TIMESTAMPTZ,
    approval_status approval_status,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason VARCHAR(500),
    notes VARCHAR(500),
    home_seed VARCHAR(10),
    away_seed VARCHAR(10),
    referee_main VARCHAR(100),
    referee_assistant VARCHAR(100),
    venue_manager VARCHAR(100),
    -- 新フォーマット対応カラム
    is_b_match BOOLEAN DEFAULT FALSE,                      -- B戦フラグ（順位計算から除外）
    match_day INTEGER,                                     -- 試合日（1 or 2）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE SET NULL
);

-- 選手テーブル
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    number INTEGER,
    name VARCHAR(100) NOT NULL,
    name_kana VARCHAR(100),
    grade INTEGER,
    position VARCHAR(20),
    is_captain BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 得点テーブル
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    player_name VARCHAR(100) NOT NULL,
    minute INTEGER NOT NULL,
    half INTEGER NOT NULL,
    is_own_goal BOOLEAN NOT NULL DEFAULT FALSE,
    is_penalty BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 順位テーブル
CREATE TABLE IF NOT EXISTS standings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(1),                                   -- NULL許可（新フォーマット: 全体順位表の場合）
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL DEFAULT 0,
    played INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 0,
    drawn INTEGER NOT NULL DEFAULT 0,
    lost INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    goal_difference INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    overall_rank INTEGER,  -- 総合順位（全グループ通しての順位）
    rank_reason VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE CASCADE
);

-- 対戦除外ペアテーブル
CREATE TABLE IF NOT EXISTS exclusion_pairs (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(1) NOT NULL,
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE CASCADE
);

-- スタッフテーブル
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_kana VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(255),
    notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ユニフォームテーブル
CREATE TABLE IF NOT EXISTS team_uniforms (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    uniform_type VARCHAR(20) NOT NULL DEFAULT 'fp',
    color_primary VARCHAR(50),
    color_secondary VARCHAR(50),
    color_pants VARCHAR(50),
    color_socks VARCHAR(50),
    notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 大会設定テーブル
CREATE TABLE IF NOT EXISTS tournament_settings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    match_duration INTEGER NOT NULL DEFAULT 20,
    break_duration INTEGER NOT NULL DEFAULT 5,
    points_for_win INTEGER NOT NULL DEFAULT 3,
    points_for_draw INTEGER NOT NULL DEFAULT 1,
    points_for_loss INTEGER NOT NULL DEFAULT 0,
    interval_minutes INTEGER DEFAULT 15,
    half_time_minutes INTEGER DEFAULT 5,
    preliminary_rounds INTEGER DEFAULT 5,
    tiebreaker_rules JSONB DEFAULT '["points", "goal_difference", "goals_scored", "head_to_head", "lottery"]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id)
);

-- 会場スタッフテーブル
CREATE TABLE IF NOT EXISTS venue_staff (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(venue_id, user_id)
);

-- 報告書発信元設定テーブル
CREATE TABLE IF NOT EXISTS sender_settings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    sender_name VARCHAR(100),
    sender_title VARCHAR(100),
    sender_organization VARCHAR(100),
    recipient VARCHAR(200),
    contact VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id)
);

-- 報告書受信者テーブル
CREATE TABLE IF NOT EXISTS report_recipients (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    fax VARCHAR(50),
    role VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 優秀選手テーブル
CREATE TABLE IF NOT EXISTS outstanding_players (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    team_name VARCHAR(100),
    player_name VARCHAR(100) NOT NULL,
    player_number INTEGER,
    award_type VARCHAR(20) NOT NULL DEFAULT 'outstanding',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. Circular Dependencies (Idempotent ALTERs)
-- =====================================================

DO $$ BEGIN
    ALTER TABLE groups ADD CONSTRAINT fk_groups_venue
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE venues ADD CONSTRAINT fk_venues_manager_team
        FOREIGN KEY (manager_team_id) REFERENCES teams(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 4. Helper Functions (Idempotent)
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_edit_match(match_venue_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR (role = 'venue_staff' AND venue_id = match_venue_id))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username, display_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        NEW.email,
        'viewer'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Triggers (Drop & Recreate for Idempotency)
-- =====================================================

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
    CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
    CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_venues_updated_at ON venues;
    CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
    CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
    CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_players_updated_at ON players;
    CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
    CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
    CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_team_uniforms_updated_at ON team_uniforms;
    CREATE TRIGGER update_team_uniforms_updated_at BEFORE UPDATE ON team_uniforms
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_tournament_settings_updated_at ON tournament_settings;
    CREATE TRIGGER update_tournament_settings_updated_at BEFORE UPDATE ON tournament_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_venue_staff_updated_at ON venue_staff;
    CREATE TRIGGER update_venue_staff_updated_at BEFORE UPDATE ON venue_staff
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_sender_settings_updated_at ON sender_settings;
    CREATE TRIGGER update_sender_settings_updated_at BEFORE UPDATE ON sender_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_report_recipients_updated_at ON report_recipients;
    CREATE TRIGGER update_report_recipients_updated_at BEFORE UPDATE ON report_recipients
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_outstanding_players_updated_at ON outstanding_players;
    CREATE TRIGGER update_outstanding_players_updated_at BEFORE UPDATE ON outstanding_players
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_venue_assignments_updated_at ON venue_assignments;
    CREATE TRIGGER update_venue_assignments_updated_at BEFORE UPDATE ON venue_assignments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION handle_new_user();
END $$;

-- =====================================================
-- 6. RLS Policies (Drop & Recreate for Idempotency)
-- =====================================================

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusion_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE outstanding_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_assignments ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies to avoid duplicates/errors
DO $$ BEGIN
    -- Public Read
    DROP POLICY IF EXISTS "Public read access" ON tournaments;
    DROP POLICY IF EXISTS "Public read access" ON groups;
    DROP POLICY IF EXISTS "Public read access" ON venues;
    DROP POLICY IF EXISTS "Public read access" ON teams;
    DROP POLICY IF EXISTS "Public read access" ON matches;
    DROP POLICY IF EXISTS "Public read access" ON players;
    DROP POLICY IF EXISTS "Public read access" ON goals;
    DROP POLICY IF EXISTS "Public read access" ON standings;
    DROP POLICY IF EXISTS "Public read access" ON staff;
    DROP POLICY IF EXISTS "Public read access" ON team_uniforms;
    DROP POLICY IF EXISTS "Public read access" ON tournament_settings;
    DROP POLICY IF EXISTS "Public read access" ON venue_staff;
    DROP POLICY IF EXISTS "Public read access" ON sender_settings;
    DROP POLICY IF EXISTS "Public read access" ON report_recipients;
    DROP POLICY IF EXISTS "Public read access" ON outstanding_players;
    DROP POLICY IF EXISTS "Public read access" ON venue_assignments;

    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

    -- Admin
    DROP POLICY IF EXISTS "Admin full access" ON tournaments;
    DROP POLICY IF EXISTS "Admin full access" ON groups;
    DROP POLICY IF EXISTS "Admin full access" ON venues;
    DROP POLICY IF EXISTS "Admin full access" ON teams;
    DROP POLICY IF EXISTS "Admin full access" ON players;
    DROP POLICY IF EXISTS "Admin full access" ON goals;
    DROP POLICY IF EXISTS "Admin full access" ON standings;
    DROP POLICY IF EXISTS "Admin full access" ON exclusion_pairs;
    DROP POLICY IF EXISTS "Admin full access" ON staff;
    DROP POLICY IF EXISTS "Admin full access" ON team_uniforms;
    DROP POLICY IF EXISTS "Admin full access" ON tournament_settings;
    DROP POLICY IF EXISTS "Admin full access" ON venue_staff;
    DROP POLICY IF EXISTS "Admin full access" ON sender_settings;
    DROP POLICY IF EXISTS "Admin full access" ON report_recipients;
    DROP POLICY IF EXISTS "Admin full access" ON outstanding_players;
    DROP POLICY IF EXISTS "Admin full access" ON venue_assignments;

    -- Venue Staff
    DROP POLICY IF EXISTS "Venue staff can update matches" ON matches;
    DROP POLICY IF EXISTS "Venue staff can insert goals" ON goals;
    DROP POLICY IF EXISTS "Venue staff can update goals" ON goals;
    DROP POLICY IF EXISTS "Venue staff can delete goals" ON goals;
END $$;

-- Re-create Policies
CREATE POLICY "Public read access" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read access" ON groups FOR SELECT USING (true);
CREATE POLICY "Public read access" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read access" ON players FOR SELECT USING (true);
CREATE POLICY "Public read access" ON goals FOR SELECT USING (true);
CREATE POLICY "Public read access" ON standings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON staff FOR SELECT USING (true);
CREATE POLICY "Public read access" ON team_uniforms FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tournament_settings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON venue_staff FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sender_settings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON report_recipients FOR SELECT USING (true);
CREATE POLICY "Public read access" ON outstanding_players FOR SELECT USING (true);
CREATE POLICY "Public read access" ON venue_assignments FOR SELECT USING (true);

CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin full access" ON tournaments FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON groups FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON venues FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON teams FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON players FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON goals FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON standings FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON exclusion_pairs FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON staff FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON team_uniforms FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON tournament_settings FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON venue_staff FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON sender_settings FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON report_recipients FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON outstanding_players FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON venue_assignments FOR ALL USING (is_admin());

CREATE POLICY "Venue staff can update matches" ON matches
    FOR UPDATE USING (can_edit_match(venue_id));
CREATE POLICY "Venue staff can insert goals" ON goals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.id = match_id AND can_edit_match(m.venue_id)
        )
    );
CREATE POLICY "Venue staff can update goals" ON goals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.id = match_id AND can_edit_match(m.venue_id)
        )
    );
CREATE POLICY "Venue staff can delete goals" ON goals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.id = match_id AND can_edit_match(m.venue_id)
        )
    );

-- =====================================================
-- 7. Initial Data (Idempotent Insert)
-- =====================================================

INSERT INTO tournaments (id, name, short_name, edition, year, start_date, end_date)
VALUES (1, '第1回 浦和カップ', '浦和カップ', 1, 2025, '2025-08-01', '2025-08-03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (tournament_id, id, name) VALUES
(1, 'A', 'グループA'),
(1, 'B', 'グループB'),
(1, 'C', 'グループC'),
(1, 'D', 'グループD')
ON CONFLICT (tournament_id, id) DO NOTHING;

-- Publication (Idempotent)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE goals;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE standings;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 8. Indexes for New Tables
-- =====================================================

-- tournament_settings indexes
CREATE INDEX IF NOT EXISTS idx_tournament_settings_tournament_id ON tournament_settings(tournament_id);

-- venue_staff indexes
CREATE INDEX IF NOT EXISTS idx_venue_staff_venue_id ON venue_staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_staff_user_id ON venue_staff(user_id);

-- sender_settings indexes
CREATE INDEX IF NOT EXISTS idx_sender_settings_tournament_id ON sender_settings(tournament_id);

-- report_recipients indexes
CREATE INDEX IF NOT EXISTS idx_report_recipients_tournament_id ON report_recipients(tournament_id);
CREATE INDEX IF NOT EXISTS idx_report_recipients_is_active ON report_recipients(is_active);

-- outstanding_players indexes
CREATE INDEX IF NOT EXISTS idx_outstanding_players_tournament_id ON outstanding_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_players_team_id ON outstanding_players(team_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_players_player_id ON outstanding_players(player_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_players_award_type ON outstanding_players(award_type);
CREATE INDEX IF NOT EXISTS idx_outstanding_players_display_order ON outstanding_players(display_order);

-- =====================================================
-- 9. Indexes for New Format Tables (venue_assignments, matches)
-- =====================================================

-- venue_assignments indexes
CREATE INDEX IF NOT EXISTS idx_venue_assignments_tournament_id ON venue_assignments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_venue_id ON venue_assignments(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_team_id ON venue_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_match_day ON venue_assignments(match_day);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_tournament_match_day ON venue_assignments(tournament_id, match_day);
CREATE INDEX IF NOT EXISTS idx_venue_assignments_venue_match_day ON venue_assignments(venue_id, match_day);

-- matches indexes for new format columns
CREATE INDEX IF NOT EXISTS idx_matches_is_b_match ON matches(is_b_match);
CREATE INDEX IF NOT EXISTS idx_matches_match_day ON matches(match_day);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_match_day ON matches(tournament_id, match_day);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_is_b_match ON matches(tournament_id, is_b_match);

-- tournaments indexes for new format columns
CREATE INDEX IF NOT EXISTS idx_tournaments_use_group_system ON tournaments(use_group_system);
