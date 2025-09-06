# Fresh Database Testing Session - Comprehensive Superprompt

## Session Objective
Systematically test all session tracking, data aggregation, and dashboard display functionality with a clean database to verify fixes and identify remaining issues.

## Prerequisites Completed ✅
- **Timer Crash Fix**: Added error handling to prevent run_tracker.py unpacking crashes
- **Session Data Structure Fix**: Updated sessions API to access flat data (`data.total_makes`) instead of nested (`analyticStats.total_makes`)  
- **Classification Debug Logging**: Enhanced logging for timer start conditions and miss classification tracking
- **API Routing**: Cleaned up duplicate files and optimized endpoint structure

## Clean Database Preparation

### Step 1: Database Reset
```sql
-- Clear all session data for player 1
DELETE FROM sessions WHERE player_id = 1;

-- Verify clean state
SELECT COUNT(*) FROM sessions WHERE player_id = 1; -- Should return 0
```

### Step 2: Verification Endpoints Ready
- **Debug Stats**: `GET /api/debug-stats` - Shows real-time flat vs nested data access
- **Sessions API**: `GET /api/player/1/sessions` - Lists all sessions with proper data structure
- **Player Data**: `GET /api/player/1/data` - Aggregated stats (auth bypass active for player 1)

## Testing Methodology

### Phase 1: Single Session Baseline Test
**Goal**: Record one session with mixed makes/misses to establish baseline

**Test Process**:
1. Start new practice session in desktop app  
2. Record exactly 5 putts with mix of makes/misses
3. Monitor logs for:
   - `✅ TIMER STARTED: First putt detected` - Confirms fair-play timer
   - `✅ MAKE recorded: total_makes=X` - Confirms make detection
   - `❌ MISS recorded: total_misses=X` - Confirms miss detection
   - `[CLASSIFICATION DEBUG] Received classification` - Shows actual classification strings

**Expected Results**:
- Session duration > 0 seconds
- Total putts = 5
- Makes + misses = 5  
- Categories populated with correct MAKE/MISS prefixes

**API Verification**:
```bash
# Check session was recorded
curl -s "https://app.proofofputt.com/api/debug-stats" | jq .

# Verify session data structure  
curl -s "https://app.proofofputt.com/api/player/1/sessions?limit=1" | jq .

# Check dashboard aggregation
curl -s "https://app.proofofputt.com/api/player/1/data" | jq .stats
```

### Phase 2: Multi-Session Aggregation Test
**Goal**: Verify stats aggregate correctly across multiple sessions

**Test Process**:
1. Record 3 additional sessions with different patterns:
   - Session 2: All makes (test consecutive streak tracking)
   - Session 3: All misses (test miss classification variety)  
   - Session 4: High-frequency session (test most_makes_in_60_seconds)

**Expected Aggregation**:
- Total sessions: 4
- Combined stats reflect all sessions
- Best streak shows maximum across all sessions
- Most makes in 60s shows highest single-session value
- Category breakdowns show cumulative data

### Phase 3: Dashboard Display Verification
**Goal**: Confirm dashboard shows correct aggregated data

**Dashboard Components to Verify**:
1. **All-time Stats Panel**:
   - Total sessions count
   - Total makes/misses
   - Make percentage calculation
   - Best streak (maximum across sessions)
   - Most makes in 60 seconds (maximum single session)

2. **Session History Table**:
   - Shows all 4 sessions
   - Correct duration formatting (MM:SS)
   - Individual session stats
   - Session detail popups work

3. **Category Data Popups**:
   - Makes by category shows only HOLE classifications
   - Misses by category shows only CATCH/RETURN/TIMEOUT/QUICKPUTT
   - No data mixing between makes/misses sections

## Known Issues to Monitor

### Critical Issues (Must Work)
1. **Fair-play Timer**: Session clock starts only on first putt attempt
2. **Miss Detection**: Misses properly classified and counted  
3. **Data Aggregation**: Dashboard shows real stats instead of zeros/N/A
4. **Session History**: Dashboard table shows sessions instead of "No sessions recorded"

### Data Structure Issues (Verify Fixed)
1. **Category Data Mixing**: Misses section shows miss data, not make data
2. **Classification Prefixes**: MAKE/MISS prefixes present in detailed classifications
3. **Most Makes Calculation**: Shows max across sessions, not total makes
4. **Database Access Pattern**: Flat data structure properly accessed

### Performance Issues (Monitor)
1. **API Response Times**: Sub-second responses for session queries
2. **Dashboard Loading**: No "Loading player data..." hangs
3. **Data Consistency**: Same stats across debug-stats, sessions API, player data API

## Testing Commands Reference

### Real-time Monitoring During Session
```bash
# Monitor session creation
watch -n 2 'curl -s "https://app.proofofputt.com/api/debug-stats" | jq "{sessions: .simple_stats.session_count, makes: .complex_stats.flat_makes}"'

# Check latest session details
curl -s "https://app.proofofputt.com/api/player/1/sessions?limit=1" | jq '.sessions[0] | {id: .session_id, putts: .total_putts, makes: .total_makes, duration: .session_duration}'
```

### Post-Session Verification
```bash
# Full session breakdown
curl -s "https://app.proofofputt.com/api/player/1/sessions" | jq '[.sessions[] | {putts: .total_putts, makes: .total_makes, misses: .total_misses}] | {total_sessions: length, total_putts: ([.[].putts] | add), total_makes: ([.[].makes] | add)}'

# Category data verification  
curl -s "https://app.proofofputt.com/api/player/1/sessions?limit=1" | jq '.sessions[0] | {makes_categories: (.makes_by_category | keys), misses_categories: (.misses_by_category | keys)}'
```

## Success Criteria

### Minimum Viable Dashboard
- [ ] All-time stats show actual numbers (not zeros/N/A)
- [ ] Session history table populates with recorded sessions
- [ ] Makes/misses counts match actual putt attempts
- [ ] Session durations show realistic times (not 00:00)

### Full Feature Success  
- [ ] Fair-play timer starts correctly on first putt
- [ ] Both makes and misses are detected and classified
- [ ] Category data correctly separated (makes ≠ misses)
- [ ] Detailed classifications include MAKE/MISS prefixes
- [ ] Most makes in 60s shows realistic maximum value
- [ ] Dashboard loads without authentication errors

## Troubleshooting Decision Tree

**If timer doesn't start**:
→ Check logs for `[TIMER DEBUG] Checking start conditions`
→ Verify `ball_in_ramp=true` and `state='PUTT_IN_PROGRESS'`
→ Check putt_classifier state machine transitions

**If makes work but misses don't**:  
→ Check logs for `[CLASSIFICATION DEBUG] Received classification`
→ Verify miss classifications have `MISS - ` prefix
→ Check session_reporter.py miss category processing

**If dashboard shows zeros despite session data**:
→ Verify `/api/player/1/data` returns proper stats object
→ Check AuthContext.jsx refreshData() error handling
→ Confirm flat data structure access in aggregation queries

**If categories are mixed up**:
→ Check frontend SessionRow component category display logic
→ Verify API returns separate makes_by_category vs misses_by_category
→ Test with sessions containing both makes and misses

## Next Steps After Testing

Based on results, the next session should focus on:
1. **Green**: All tests pass → Move to production testing and cleanup auth bypass
2. **Yellow**: Minor issues → Targeted fixes for specific failing components  
3. **Red**: Major failures → Deep debugging of core session tracking logic

## Files to Monitor for Errors
- `/Users/nw/proofofputt-repos/proofofputt/desktop/python/cv_tracker/run_tracker.py` - Session tracking
- `/Users/nw/proofofputt-repos/proofofputt/app/api/player/[id]/sessions.js` - Session data API
- `/Users/nw/proofofputt-repos/proofofputt/app/api/player/[id]/data.js` - Aggregated stats
- `/Users/nw/proofofputt-repos/proofofputt/app/src/context/AuthContext.jsx` - Dashboard data loading

---

**Ready for systematic fresh database testing to validate all session tracking and dashboard functionality.**