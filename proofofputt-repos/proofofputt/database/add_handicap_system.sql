-- Add Handicap System to Proof of Putt
-- Migration Date: October 2025
-- Purpose: Add player handicap calculation and tracking

-- Add handicap fields to users/players table
ALTER TABLE users ADD COLUMN IF NOT EXISTS handicap DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS handicap_last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS handicap_qualifying_sessions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT NULL;

-- Create index for handicap lookups
CREATE INDEX IF NOT EXISTS idx_users_handicap ON users(handicap) WHERE handicap IS NOT NULL;

-- Create handicap history table for tracking changes over time
CREATE TABLE IF NOT EXISTS handicap_history (
    history_id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handicap_value DECIMAL(5,2) NOT NULL,
    qualifying_sessions INTEGER NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_data JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_handicap_history_player_id ON handicap_history(player_id);
CREATE INDEX IF NOT EXISTS idx_handicap_history_calculated_at ON handicap_history(calculated_at);

-- Add comments for documentation
COMMENT ON COLUMN users.handicap IS 'Player handicap calculated from makes per minute (MPM) in timed/practice sessions. Based on 50-75th percentile performance. NULL until 21+ qualifying sessions.';
COMMENT ON COLUMN users.handicap_qualifying_sessions IS 'Number of timed/practice sessions (5+ minutes) used for handicap calculation';
COMMENT ON COLUMN users.profile_picture_url IS 'URL to player profile picture';
COMMENT ON COLUMN users.bio IS 'Player biography/description';
COMMENT ON COLUMN users.social_links IS 'JSON object containing social media links (twitter, instagram, youtube, etc.)';
COMMENT ON TABLE handicap_history IS 'Historical record of handicap calculations for trend analysis';

-- Verify migration
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('handicap', 'handicap_last_calculated', 'handicap_qualifying_sessions', 'profile_picture_url', 'bio', 'social_links')
ORDER BY column_name;

SELECT
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'handicap_history'
GROUP BY table_name;
