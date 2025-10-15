-- Add rate limiting columns for invitation system
-- This fixes the error: column "daily_invites_sent" does not exist

-- Add daily invitation tracking columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS daily_invites_sent INTEGER DEFAULT 0;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_invite_date DATE;

-- Set default values for existing players
UPDATE players 
SET daily_invites_sent = 0 
WHERE daily_invites_sent IS NULL;

-- Add index for performance on rate limit queries
CREATE INDEX IF NOT EXISTS idx_players_invite_tracking 
ON players (last_invite_date, daily_invites_sent);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('daily_invites_sent', 'last_invite_date')
ORDER BY column_name;