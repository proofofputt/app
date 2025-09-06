-- Clean Database Script for Fresh Testing Session
-- Run this to reset player 1 data for comprehensive testing

-- Clear all session data for player 1  
DELETE FROM sessions WHERE player_id = 1;

-- Clear any cached leaderboard data related to player 1
DELETE FROM leaderboard_cache WHERE player_id = 1;

-- Reset player stats if they exist in a separate table (optional)
-- UPDATE player_stats SET 
--   total_sessions = 0,
--   total_makes = 0, 
--   total_misses = 0,
--   best_streak = 0,
--   make_percentage = 0
-- WHERE player_id = 1;

-- Verify clean state
SELECT 
  (SELECT COUNT(*) FROM sessions WHERE player_id = 1) as sessions_count,
  (SELECT COUNT(*) FROM leaderboard_cache WHERE player_id = 1) as cache_count;
  
-- Should return: sessions_count = 0, cache_count = 0

-- Verification queries for next testing session
-- Use these to monitor progress during testing:

/*
-- Real-time session count
SELECT COUNT(*) as current_sessions FROM sessions WHERE player_id = 1;

-- Latest session summary  
SELECT 
  session_id,
  created_at,
  CAST(data->>'total_makes' AS INTEGER) as makes,
  CAST(data->>'total_misses' AS INTEGER) as misses,
  CAST(data->>'session_duration_seconds' AS DECIMAL) as duration
FROM sessions 
WHERE player_id = 1 
ORDER BY created_at DESC 
LIMIT 5;

-- Aggregated stats (should match API responses)
SELECT 
  COUNT(session_id) as total_sessions,
  COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
  COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
  COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak,
  COALESCE(MAX(CAST(data->>'most_makes_in_60_seconds' AS INTEGER)), 0) as most_in_60s
FROM sessions 
WHERE player_id = 1 
AND data IS NOT NULL;
*/