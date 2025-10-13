-- Comprehensive OAuth Schema Fix
-- This migration adds all necessary columns and tables for web OAuth

-- 1. Add missing columns to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS oauth_providers JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS oauth_profile JSONB DEFAULT '{}'::jsonb;

-- 2. Set display_name from name for existing users
UPDATE players
SET display_name = name
WHERE display_name IS NULL AND name IS NOT NULL;

-- 3. Create oauth_tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scope TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, provider)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_player_id ON oauth_tokens(player_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_players_display_name ON players(display_name);
CREATE INDEX IF NOT EXISTS idx_players_avatar_url ON players(avatar_url);

-- 5. Add comments for documentation
COMMENT ON COLUMN players.display_name IS 'Public display name for the player';
COMMENT ON COLUMN players.avatar_url IS 'URL to player avatar image (from OAuth or custom upload)';
COMMENT ON COLUMN players.oauth_providers IS 'JSON object tracking which OAuth providers are linked: {"google": true, "linkedin": true}';
COMMENT ON COLUMN players.oauth_profile IS 'JSON object storing OAuth profile data: {"google": {"name": "...", "picture": "...", "verified": true}}';
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth access/refresh tokens for third-party integrations';

-- 6. Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'players'
  AND column_name IN ('display_name', 'avatar_url', 'oauth_providers', 'oauth_profile', 'google_id')
ORDER BY column_name;

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'oauth_tokens'
ORDER BY ordinal_position;
