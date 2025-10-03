-- Add Google OAuth ID column to players table
-- Run this migration on your production database if not already present

ALTER TABLE players
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_players_google_id ON players(google_id);

-- Update existing users who may have signed up with email matching their Google account
-- (Optional - only run if you want to link existing accounts)
-- UPDATE players SET google_id = '<their-google-id>' WHERE email = '<their-email>';
