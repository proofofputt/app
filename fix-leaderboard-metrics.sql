-- Fix Leaderboard Metrics and Clean Mock Data
-- Run this in NeonDB console to fix leaderboard calculations
-- Created: 2025-09-07

-- ========================================
-- STEP 1: View all sessions to identify issues
-- ========================================
SELECT 
  session_id,
  created_at,
  (data->>'total_makes')::int as makes,
  (data->>'total_putts')::int as putts,
  (data->>'session_duration_seconds')::float as duration,
  (data->>'fastest_21_makes_seconds')::float as fastest_21,
  LEFT(session_id, 8) as short_id
FROM sessions
WHERE player_id = 1
ORDER BY created_at DESC;

-- ========================================
-- UNDERSTANDING THE DATA ISSUE
-- ========================================
-- Based on NeonDB output, the real session (2025-09-06 16:09:43) has:
-- - 21 makes out of 26 putts
-- - Missing duration and fastest_21 data
-- - This suggests incomplete data capture from desktop app

-- The other sessions are from test scripts with complete data:
-- - Test session with 112 makes has fastest_21 = 95.3s
-- - Test session with 18 makes has complete analytics

-- RECOMMENDATION: Need a fresh session upload from desktop app
-- with proper data structure including:
-- - session_duration_seconds
-- - fastest_21_makes_seconds (for sessions with 21+ makes)
-- - complete analytics data

-- ========================================
-- STEP 2: For now, clean up test sessions if needed
-- ========================================
-- Keep the real session (21 makes) and remove only obvious test data
-- Comment out DELETE if you want to keep test sessions for debugging

-- DELETE FROM sessions
-- WHERE player_id = 1
--   AND (
--     -- Remove test sessions with unrealistic high makes
--     (data->>'total_makes')::int > 100
--     -- OR other criteria to identify test data
--   );

-- ========================================
-- STEP 3: Fix metric configurations
-- ========================================
UPDATE leaderboard_metrics 
SET 
  data_field = CASE metric_name
    WHEN 'makes' THEN 'total_makes'
    WHEN 'total_makes' THEN 'total_makes'
    WHEN 'best_streak' THEN 'best_streak'
    WHEN 'fastest_21_makes_seconds' THEN 'fastest_21_makes_seconds'
    WHEN 'most_in_60_seconds' THEN 'most_makes_in_60_seconds'
    WHEN 'accuracy' THEN 'make_percentage'
    ELSE data_field
  END,
  calculation_type = CASE metric_name
    WHEN 'makes' THEN 'max'              -- Best single session, NOT sum
    WHEN 'total_makes' THEN 'max'        -- Best single session, NOT sum  
    WHEN 'best_streak' THEN 'max'        -- Best streak from any session
    WHEN 'fastest_21_makes_seconds' THEN 'min'  -- Lowest time is best
    WHEN 'most_in_60_seconds' THEN 'max' -- Most in any 60-second window
    ELSE calculation_type
  END,
  sort_order = CASE
    WHEN metric_name = 'fastest_21_makes_seconds' THEN 'asc'  -- Lower is better
    ELSE 'desc'  -- Higher is better for most metrics
  END;

-- ========================================
-- STEP 4: Clear cache
-- ========================================
DELETE FROM leaderboard_cache;

-- ========================================
-- STEP 5: Verify current data
-- ========================================
SELECT 
  'Real Session Data Check' as info,
  session_id,
  (data->>'total_makes')::int as makes,
  data->>'session_duration_seconds' as duration,
  data->>'fastest_21_makes_seconds' as fastest_21
FROM sessions
WHERE player_id = 1 
  AND created_at::date = '2025-09-06';

-- ========================================
-- NEXT STEPS NEEDED:
-- ========================================
-- 1. Upload a new session from desktop app with:
--    - Complete session data (duration, analytics)
--    - At least 21 makes to get fastest_21 calculation
--    - Proper data structure from latest CV engine

-- 2. Verify the desktop app is using latest session upload format

-- 3. After new session upload, leaderboards should show:
--    - Most Makes: [actual number from best session]
--    - Fastest 21: [actual time if 21+ makes achieved]