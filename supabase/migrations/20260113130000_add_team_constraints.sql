-- Add region and league support for team constraints
-- This migration adds:
-- 1. A leagues table for league master data
-- 2. region column to teams table for regional grouping
-- 3. league_id column to teams table for league assignment

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

-- Create regions table (for master data)
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

-- Add region column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region VARCHAR(50);

-- Add league_id column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS league_id INTEGER REFERENCES leagues(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_region ON teams(region);
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_leagues_tournament_id ON leagues(tournament_id);
CREATE INDEX IF NOT EXISTS idx_regions_tournament_id ON regions(tournament_id);

-- Enable RLS for new tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Create policies for leagues table
CREATE POLICY "leagues_select_policy" ON leagues
    FOR SELECT USING (true);

CREATE POLICY "leagues_insert_policy" ON leagues
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'venue_staff')
        )
    );

CREATE POLICY "leagues_update_policy" ON leagues
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "leagues_delete_policy" ON leagues
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Create policies for regions table
CREATE POLICY "regions_select_policy" ON regions
    FOR SELECT USING (true);

CREATE POLICY "regions_insert_policy" ON regions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'venue_staff')
        )
    );

CREATE POLICY "regions_update_policy" ON regions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "regions_delete_policy" ON regions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Add comment for documentation
COMMENT ON COLUMN teams.region IS 'Team region for constraint checking (e.g., Saitama, Tokyo)';
COMMENT ON COLUMN teams.league_id IS 'Reference to leagues table for league-based constraint checking';
COMMENT ON TABLE leagues IS 'League master data for team assignment and constraint checking';
COMMENT ON TABLE regions IS 'Region master data for team assignment and constraint checking';
