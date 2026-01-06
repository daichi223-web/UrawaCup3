-- =====================================================
-- 浦和カップ トーナメント管理システム - Supabase Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM Types (skip if already exists)
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
-- Tables
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
    group_count INTEGER DEFAULT 4,
    teams_per_group INTEGER DEFAULT 4,
    advancing_teams INTEGER DEFAULT 1,
    sender_organization VARCHAR(100),
    sender_name VARCHAR(100),
    sender_contact VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- グループテーブル（複合主キー）
CREATE TABLE groups (
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    id VARCHAR(1) NOT NULL,
    name VARCHAR(50) NOT NULL,
    venue_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tournament_id, id)
);

-- 会場テーブル
CREATE TABLE venues (
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

-- グループテーブルにvenue_idの外部キー追加
ALTER TABLE groups ADD CONSTRAINT fk_groups_venue
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;

-- チームテーブル
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    team_type team_type NOT NULL DEFAULT 'invited',
    is_venue_host BOOLEAN NOT NULL DEFAULT FALSE,
    group_id VARCHAR(1),
    group_order INTEGER,
    prefecture VARCHAR(20),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE SET NULL
);

-- 会場テーブルにmanager_team_idの外部キー追加
ALTER TABLE venues ADD CONSTRAINT fk_venues_manager_team
    FOREIGN KEY (manager_team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ユーザープロファイルテーブル（Supabase Authと連携）
CREATE TABLE profiles (
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
CREATE TABLE matches (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE SET NULL
);

-- 選手テーブル
CREATE TABLE players (
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
CREATE TABLE goals (
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

-- 順位テーブル
CREATE TABLE standings (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(1) NOT NULL,
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
    rank_reason VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE CASCADE
);

-- 対戦除外ペアテーブル
CREATE TABLE exclusion_pairs (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id VARCHAR(1) NOT NULL,
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tournament_id, group_id) REFERENCES groups(tournament_id, id) ON DELETE CASCADE
);

-- スタッフテーブル
CREATE TABLE staff (
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
CREATE TABLE team_uniforms (
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

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
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

-- Public read access for all tables (公開閲覧用)
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

-- Profiles: users can read all, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admin full access (check role from profiles table)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin write policies
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

-- Venue staff can update matches at their venue
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
-- Triggers for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_team_uniforms_updated_at BEFORE UPDATE ON team_uniforms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Realtime subscriptions
-- =====================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
ALTER PUBLICATION supabase_realtime ADD TABLE standings;

-- =====================================================
-- Initial Data: Default Tournament & Groups
-- =====================================================

-- デフォルト大会を作成
INSERT INTO tournaments (name, short_name, edition, year, start_date, end_date)
VALUES ('第1回 浦和カップ', '浦和カップ', 1, 2025, '2025-08-01', '2025-08-03');

-- デフォルトグループを作成
INSERT INTO groups (tournament_id, id, name) VALUES
(1, 'A', 'グループA'),
(1, 'B', 'グループB'),
(1, 'C', 'グループC'),
(1, 'D', 'グループD');

-- =====================================================
-- Function: Handle new user signup
-- =====================================================

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

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
