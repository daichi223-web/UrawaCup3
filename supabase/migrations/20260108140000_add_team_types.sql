-- Add new values to team_type enum
-- Use IF NOT EXISTS to prevent errors if running multiple times (though ADD VALUE IF NOT EXISTS is Postgres 12+)
-- Since Supabase is likely recent Postgres, this should work. If not, we might need a DO block.
-- Assuming Postgres 12+:
ALTER TYPE team_type ADD VALUE IF NOT EXISTS 'local';
ALTER TYPE team_type ADD VALUE IF NOT EXISTS 'invited';
