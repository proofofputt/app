-- SQL Query to Delete All Duels from NeonDB
-- Run this in the NeonDB SQL Editor to clean up all duel data

BEGIN;

-- First, delete all duel-related data to avoid foreign key constraints
-- Note: This will permanently delete ALL duel data

-- Delete any duel-related sessions or references if they exist
-- (This is cautious - some duels may have session associations)

-- Delete all duels (main table)
DELETE FROM duels;

-- Reset any auto-increment sequences if they exist
-- (This ensures new duels start from ID 1)
-- Note: Only run if you want to reset the duel_id sequence
-- ALTER SEQUENCE duels_duel_id_seq RESTART WITH 1;

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT COUNT(*) as remaining_duels FROM duels;

-- Optional: Show any remaining duel-related data
-- Uncomment these lines if you want to verify cleanup:
-- SELECT 'Duels remaining:' as table_name, COUNT(*) as count FROM duels
-- UNION ALL
-- SELECT 'Sessions with duel references:', COUNT(*) FROM sessions WHERE session_id IN (
--     SELECT duel_creator_session_id FROM duels WHERE duel_creator_session_id IS NOT NULL
--     UNION
--     SELECT duel_invited_player_session_id FROM duels WHERE duel_invited_player_session_id IS NOT NULL
-- );