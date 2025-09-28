-- Migration: Add competition_mode support for Shoot Out game type
-- Date: 2025-09-27

-- Add competition_mode to duels table
ALTER TABLE duels
ADD COLUMN IF NOT EXISTS competition_mode VARCHAR(20) DEFAULT 'time_limit' CHECK (competition_mode IN ('time_limit', 'shoot_out'));

-- Add max_attempts for shoot-out mode to duel settings
-- Settings is already JSONB, so we'll store max_attempts there

-- Add competition_mode to leagues table (stored in settings JSONB)
-- We'll store both competition_mode and max_attempts in the existing settings column

-- Update existing duels to have explicit competition_mode
UPDATE duels
SET competition_mode = 'time_limit'
WHERE competition_mode IS NULL;

-- Create index for faster filtering by competition mode
CREATE INDEX IF NOT EXISTS idx_duels_competition_mode ON duels(competition_mode);

-- Add comments for documentation
COMMENT ON COLUMN duels.competition_mode IS 'Competition format: time_limit (traditional timed session) or shoot_out (fixed number of attempts)';