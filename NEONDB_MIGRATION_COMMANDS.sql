-- ============================================
-- DATABASE MIGRATION FOR SHOOT-OUT MODE SUPPORT
-- Run these commands in your NeonDB SQL Editor
-- Date: September 2025
-- ============================================

-- Step 1: Add competition_mode column to duels table
ALTER TABLE duels
ADD COLUMN IF NOT EXISTS competition_mode VARCHAR(20) DEFAULT 'time_limit'
CHECK (competition_mode IN ('time_limit', 'shoot_out'));

-- Step 2: Update all existing duels to have explicit competition_mode
UPDATE duels
SET competition_mode = 'time_limit'
WHERE competition_mode IS NULL;

-- Step 3: Create index for faster filtering by competition mode
CREATE INDEX IF NOT EXISTS idx_duels_competition_mode ON duels(competition_mode);

-- Step 4: Add documentation comment
COMMENT ON COLUMN duels.competition_mode IS 'Competition format: time_limit (traditional timed session) or shoot_out (fixed number of attempts)';

-- Step 5: Verify the migration was successful
-- Run this query to check if the column was added:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'duels'
AND column_name = 'competition_mode';

-- Step 6: Test with a sample query
-- This should return the count of duels by competition mode:
SELECT competition_mode, COUNT(*) as count
FROM duels
GROUP BY competition_mode;

-- ============================================
-- EXPECTED RESULTS:
-- - All existing duels should have competition_mode = 'time_limit'
-- - New duels can be created with either 'time_limit' or 'shoot_out'
-- - The column should show in the table structure
-- ============================================

-- NOTES:
-- 1. Leagues don't need a separate column - they store competition_mode in the rules JSONB
-- 2. After running this migration, duels and leagues should work properly
-- 3. If you get any errors, please share them so we can troubleshoot