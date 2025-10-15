-- Migration: Add average_make_percentage column for league tiebreaker
-- This implements the correct points-per-rank system with average make percentage tiebreaker

-- Add average_make_percentage column to league_memberships table
ALTER TABLE league_memberships 
ADD COLUMN IF NOT EXISTS average_make_percentage DECIMAL(5,2) DEFAULT 0;

-- Add index for performance on tiebreaker queries
CREATE INDEX IF NOT EXISTS idx_league_memberships_scoring 
ON league_memberships(league_id, total_score DESC, average_make_percentage DESC);

-- Update existing records with calculated average make percentages
UPDATE league_memberships lm
SET average_make_percentage = (
    SELECT COALESCE(AVG((lrs.session_data->>'make_percentage')::decimal), 0)
    FROM league_round_sessions lrs
    JOIN league_rounds lr ON lrs.round_id = lr.round_id
    WHERE lrs.player_id = lm.player_id 
    AND lrs.league_id = lm.league_id
    AND lr.status = 'completed'
)
WHERE lm.average_make_percentage = 0;

-- Comment explaining the new scoring system
COMMENT ON COLUMN league_memberships.average_make_percentage IS 'Tiebreaker for league rankings: average make percentage across all completed rounds';