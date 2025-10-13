-- NeonDB Cleanup Script: Delete All Sessions and Duels
-- WARNING: This will permanently delete all session and duel data
-- Use with caution - this action cannot be undone

-- Start transaction for safety
BEGIN;

-- Display current counts before deletion
SELECT
    'BEFORE CLEANUP' as status,
    (SELECT COUNT(*) FROM sessions) as session_count,
    (SELECT COUNT(*) FROM duels) as duel_count,
    (SELECT COUNT(*) FROM league_round_sessions) as league_session_count;

-- Delete league round sessions first (foreign key dependencies)
DELETE FROM league_round_sessions;

-- Delete duels (this will clear all duel records)
DELETE FROM duels;

-- Delete all sessions (this will clear all practice and competitive sessions)
DELETE FROM sessions;

-- Optional: Reset player stats to zero (uncomment if needed)
-- UPDATE player_stats SET
--     total_sessions = 0,
--     total_putts = 0,
--     total_makes = 0,
--     total_misses = 0,
--     best_streak = 0,
--     make_percentage = 0.0,
--     total_practice_time = 0,
--     average_session_duration = 0.0;

-- Optional: Clear session-related player data (uncomment if needed)
-- UPDATE players SET
--     last_session_date = NULL,
--     sessions_this_month = 0;

-- Display counts after deletion
SELECT
    'AFTER CLEANUP' as status,
    (SELECT COUNT(*) FROM sessions) as session_count,
    (SELECT COUNT(*) FROM duels) as duel_count,
    (SELECT COUNT(*) FROM league_round_sessions) as league_session_count;

-- Commit the transaction
COMMIT;

-- Optional: Vacuum to reclaim disk space (run separately if needed)
-- VACUUM ANALYZE sessions;
-- VACUUM ANALYZE duels;
-- VACUUM ANALYZE league_round_sessions;