# Coach Access System - Remaining Tasks Tracker

**Last Updated**: October 18, 2025
**Status**: Implementation Complete, Testing & Polish Phase

---

## Quick Status Overview

| Priority | Count | Status |
|----------|-------|--------|
| P0 (Critical) | 4 | 🔴 Blocking Production |
| P1 (High) | 4 | 🟡 Should Complete Soon |
| P2 (Medium) | 4 | 🟢 Nice to Have |
| P3 (Low) | 3 | ⚪ Future Considerations |
| **TOTAL** | **15** | |

---

## P0 - Critical (Blocking Production Launch)

### TASK-001: End-to-End Testing ⏱️ 4-6 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: QA Team
**Deadline**: _____________
**Dependencies**: Test accounts created, test data prepared

**Description**:
Execute all P0 test cases from comprehensive testing plan. This includes database tests, API endpoint tests, UI tests, and complete user flow tests.

**Acceptance Criteria**:
- ☐ All P0 database tests pass
- ☐ All P0 API endpoint tests pass
- ☐ All P0 UI tests pass
- ☐ Complete referral & coach access flow tested end-to-end
- ☐ Security tests (authorization bypass attempts) pass
- ☐ Test evidence documented (screenshots, logs, database queries)

**Resources**:
- Test Suite: `/app/tests/coach-access-e2e.js`
- Manual Checklist: `/Takeover.Reports/COACH_ACCESS_TESTING_CHECKLIST.md`
- Handover Document: `/Takeover.Reports/COACH_ACCESS_COMPLETE_HANDOVER.md` (Section 3: Testing Plan)

**Commands**:
```bash
# Run automated tests
cd /app
node tests/coach-access-e2e.js dev

# For production (requires prod credentials)
node tests/coach-access-e2e.js prod
```

**Notes**:
- Create test accounts first (see manual checklist for requirements)
- Document all failures with screenshots and error logs
- If any P0 test fails, mark this task as BLOCKED and escalate

---

### TASK-002: Production Database Migration Verification ⏱️ 1 hour
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: DevOps / Database Admin
**Deadline**: _____________
**Dependencies**: Production database access

**Description**:
Verify all database migrations ran successfully in production environment without errors or data loss.

**Acceptance Criteria**:
- ☐ `coach_access_grants` table exists with correct schema
- ☐ `friendships` table exists with correct schema
- ☐ Referrer level columns (`referrer_level_1` through `referrer_level_5`) exist in `players` table
- ☐ All triggers active: `trigger_auto_friend_referrer`, `trigger_populate_referral_chain`
- ☐ All indexes created: `idx_coach_access_*`, `idx_friendships_*`
- ☐ No migration errors in database logs
- ☐ Existing player data intact (no data loss)

**Verification Script**:
```sql
-- Connect to production database
psql $DATABASE_URL

-- 1. Verify tables exist
\dt coach_access_grants
\dt friendships

-- 2. Verify column counts
SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'coach_access_grants';
-- Expected: 8 columns

SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'friendships';
-- Expected: 8 columns

-- 3. Verify triggers
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%auto_friend%';
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%populate_referral%';
-- Expected: Both triggers show tgenabled = 'O' (enabled)

-- 4. Verify indexes
\di idx_coach_access_*
\di idx_friendships_*

-- 5. Count data
SELECT COUNT(*) FROM friendships;
SELECT COUNT(*) FROM coach_access_grants;
SELECT COUNT(*) FROM players WHERE referrer_level_1 IS NOT NULL;

-- 6. Verify no errors in logs (check database logs separately)
```

**Rollback Plan** (if migration failed):
```sql
-- Rollback script (use only if migrations caused issues)
DROP TABLE IF EXISTS coach_access_grants CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TRIGGER IF EXISTS trigger_auto_friend_referrer ON players;
DROP TRIGGER IF EXISTS trigger_populate_referral_chain ON players;
ALTER TABLE players
  DROP COLUMN IF EXISTS referrer_level_1,
  DROP COLUMN IF EXISTS referrer_level_2,
  DROP COLUMN IF EXISTS referrer_level_3,
  DROP COLUMN IF EXISTS referrer_level_4,
  DROP COLUMN IF EXISTS referrer_level_5;
```

**Documentation**:
- Record migration status in production deployment log
- Screenshot verification query results
- Note any issues encountered

---

### TASK-003: Navigation Links to Coach Dashboard ⏱️ 1 hour
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Frontend Developer
**Deadline**: _____________
**Dependencies**: None

**Description**:
Add navigation link to `/coach/dashboard` in the application header. Link should only appear for users who have students (users with active coach access grants).

**Acceptance Criteria**:
- ☐ "Coach Dashboard" link appears in header navigation
- ☐ Link visible only for users with students (student count > 0)
- ☐ Link hidden for users without students
- ☐ Badge shows student count next to link (optional but recommended)
- ☐ Mobile responsive (link appears in mobile menu)
- ☐ Active state styling when on `/coach/dashboard` page

**Implementation Location**:
`/app/src/components/Header.jsx`

**Code Example**:
```javascript
// In Header.jsx
const [coachStudentCount, setCoachStudentCount] = useState(0);

useEffect(() => {
  const fetchCoachData = async () => {
    if (!playerData?.player_id) return;
    try {
      const data = await apiGetMyStudents('active');
      if (data.success) {
        setCoachStudentCount(data.students.length);
      }
    } catch (error) {
      console.error('Error fetching coach student count:', error);
    }
  };

  fetchCoachData();
}, [playerData?.player_id]);

// In navigation JSX
{coachStudentCount > 0 && (
  <Link
    to="/coach/dashboard"
    className={`nav-link ${location.pathname === '/coach/dashboard' ? 'active' : ''}`}
  >
    Coach Dashboard
    {coachStudentCount > 0 && (
      <span className="nav-badge">{coachStudentCount}</span>
    )}
  </Link>
)}
```

**Alternative Approach** (if performance is a concern):
Instead of fetching student count on every header render, add `coach_student_count` to the player data returned by `/api/auth/me` or `/api/player/[id]/data`.

**Testing**:
1. Login as coach with students → Link should appear
2. Login as coach without students → Link should NOT appear
3. Login as regular user → Link should NOT appear
4. Click link → Navigate to `/coach/dashboard`
5. Test on mobile device

---

### TASK-004: Error Monitoring Setup ⏱️ 2 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: DevOps
**Deadline**: _____________
**Dependencies**: Monitoring tool access (Sentry, DataDog, etc.)

**Description**:
Set up error monitoring and performance tracking for all coach access API endpoints and dashboard pages.

**Acceptance Criteria**:
- ☐ All 7 new coach access endpoints monitored
- ☐ Frontend pages monitored (`/contacts`, `/coach/dashboard`, admin pages)
- ☐ Custom metrics tracked:
  - API error rates
  - Response times (p50, p95, p99)
  - Failed authorization attempts
  - Database query performance
- ☐ Alerts configured for critical thresholds
- ☐ Dashboard created for coach access metrics
- ☐ Slack/email notifications set up for alerts

**Endpoints to Monitor**:
1. POST `/api/coach-access/grant`
2. POST `/api/coach-access/revoke`
3. GET `/api/coach-access/my-grants`
4. GET `/api/coach-access/students`
5. GET `/api/contacts/friends`
6. POST `/api/contacts/toggle-coach-access`
7. GET `/api/player/[id]/sessions` (updated with access control)

**Metrics to Track**:
- **Error Rate**: Percentage of 5xx responses
- **Response Time**: p50, p95, p99 latency
- **Throughput**: Requests per minute
- **Failed Auth**: 401/403 responses (may indicate attack or configuration issue)
- **Database Query Time**: Time spent in database queries

**Alert Thresholds**:
| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| Response Time (p95) | > 500ms | > 1000ms |
| Failed Auth Rate | > 5% | > 20% |
| Database Query Time | > 200ms | > 500ms |

**Monitoring Tool Configuration**:
- **Sentry**: Add custom tags for `endpoint`, `access_type` (self/admin/coach)
- **DataDog**: Create custom dashboard with coach access metrics
- **CloudWatch**: Set up alarms for Lambda function errors (if using serverless)

**Documentation**:
- Document alert contact list (who gets notified)
- Create runbook for common alert scenarios
- Link to monitoring dashboard in team docs

---

## P1 - High Priority (Should Complete Soon)

### TASK-005: User Onboarding Tooltips ⏱️ 3 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Frontend Developer + UX
**Deadline**: _____________
**Dependencies**: None

**Description**:
Add helpful tooltips explaining coach access features to improve user understanding and reduce support requests.

**Acceptance Criteria**:
- ☐ Tooltip on ContactsPage coach access toggle
- ☐ Tooltip on "They granted you access" status indicator
- ☐ Tooltips accessible (ARIA labels, keyboard navigation)
- ☐ Mobile: Tooltips appear on tap
- ☐ Tooltips have appropriate delay (500ms hover)
- ☐ Tooltips don't obstruct important UI elements

**Tooltip Locations & Content**:

**1. ContactsPage - Coach Access Toggle**
```
Location: Next to "Grant Coach Access" checkbox
Icon: ℹ️ or ?
Content: "Grant your coach access to view your session history and track your progress. You can revoke this at any time."
```

**2. ContactsPage - Access Received Indicator**
```
Location: Next to "✓ They granted you access"
Icon: ℹ️
Content: "This person has shared their session data with you. You can view their sessions to help coach them."
```

**3. CoachDashboard - Empty State** (Already has instructions ✅)

**Implementation Example**:
```javascript
import { Tooltip } from './Tooltip';  // Or use library like react-tooltip

<Tooltip content="Grant your coach access to view your session history and track your progress. You can revoke this at any time.">
  <label>
    <input type="checkbox" checked={hasAccess} onChange={handleToggle} />
    Grant Coach Access <span className="info-icon">ℹ️</span>
  </label>
</Tooltip>
```

**Accessibility**:
```html
<span
  className="info-icon"
  role="button"
  tabindex="0"
  aria-label="Coach access information"
  title="Grant your coach access to view your session history..."
>
  ℹ️
</span>
```

**Testing**:
- Desktop: Hover over icon → Tooltip appears
- Mobile: Tap icon → Tooltip appears
- Keyboard: Tab to icon, press Enter → Tooltip appears
- Screen reader: ARIA label is read

---

### TASK-006: Admin Referral Chain Export ⏱️ 2 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Backend + Frontend Developer
**Deadline**: _____________
**Dependencies**: None

**Description**:
Add CSV export functionality for admin to download complete referral chain data for all users.

**Acceptance Criteria**:
- ☐ "Export Referral Chains" button on `/admin/users` page
- ☐ CSV file includes all players with referrer data
- ☐ Download works in all browsers (Chrome, Firefox, Safari, Edge)
- ☐ Admin-only access (403 for non-admins)
- ☐ Progress indicator for large exports (> 1000 users)
- ☐ Error handling for failed exports

**CSV Format**:
```csv
player_id,name,email,display_name,level_1_id,level_1_name,level_2_id,level_2_name,level_3_id,level_3_name,level_4_id,level_4_name,level_5_id,level_5_name,total_referrals,created_at
101,"Alice Smith","alice@example.com","Alice",100,"Coach Mike",NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,"2025-10-15"
102,"Bob Jones","bob@example.com","Bob",101,"Alice Smith",100,"Coach Mike",NULL,NULL,NULL,NULL,NULL,NULL,0,"2025-10-16"
```

**API Endpoint**:
```javascript
// /api/admin/referrals/export
GET /api/admin/referrals/export
Headers: Authorization: Bearer <admin_token>
Response: CSV file download (Content-Type: text/csv)
```

**Backend Implementation**:
```javascript
// /api/admin/referrals/export.js
import { Pool } from 'pg';
import { stringify } from 'csv-stringify/sync';

async function handler(req, res) {
  // Verify admin
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        p.player_id,
        p.name,
        p.email,
        p.display_name,
        p.referrer_level_1 as level_1_id,
        r1.name as level_1_name,
        p.referrer_level_2 as level_2_id,
        r2.name as level_2_name,
        -- ... levels 3-5
        p.total_referrals,
        p.created_at
      FROM players p
      LEFT JOIN players r1 ON p.referrer_level_1 = r1.player_id
      LEFT JOIN players r2 ON p.referrer_level_2 = r2.player_id
      -- ... LEFT JOIN for levels 3-5
      ORDER BY p.created_at DESC
    `);

    const csv = stringify(result.rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=referral_chains.csv');
    res.send(csv);
  } finally {
    client.release();
    await pool.end();
  }
}
```

**Frontend Implementation**:
```javascript
// On AdminUsersPage
<button onClick={handleExportReferrals} className="btn btn-secondary">
  📊 Export Referral Chains
</button>

const handleExportReferrals = async () => {
  try {
    const response = await fetch('/api/admin/referrals/export', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral_chains_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification('Referral chains exported successfully');
  } catch (error) {
    console.error('Export failed:', error);
    showNotification('Export failed', true);
  }
};
```

---

### TASK-007: Coach Access Analytics Dashboard ⏱️ 4 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Frontend Developer
**Deadline**: _____________
**Dependencies**: Chart library (Chart.js, Recharts, etc.)

**Description**:
Create analytics dashboard for admins to track coach access adoption and usage metrics.

**Route**: `/admin/analytics/coach-access`

**Metrics to Display**:
1. **Summary Cards** (top of page)
   - Total Coach Grants (all time)
   - Active Grants vs. Revoked
   - Coaches with Students (count of coaches)
   - Students with Coaches (count of students)
   - Average Students per Coach
   - Adoption Rate (% of users participating)

2. **Line Chart**: Grants Over Time (last 30 days)
   - X-axis: Date
   - Y-axis: Number of grants
   - Lines: New grants, Revoked grants, Net active grants

3. **Bar Chart**: Top Coaches by Student Count
   - X-axis: Coach name (top 10)
   - Y-axis: Student count

4. **Pie Chart**: Grant Status Distribution
   - Active vs. Revoked

5. **Table**: Recent Activity (last 50 events)
   - Date, Student, Coach, Action (granted/revoked)

**API Endpoint**:
```javascript
GET /api/admin/analytics/coach-access
Response: {
  summary: {
    total_grants: 50,
    active_grants: 45,
    revoked_grants: 5,
    coaches_with_students: 10,
    students_with_coaches: 40,
    avg_students_per_coach: 4.5,
    adoption_rate: 12.5  // percentage
  },
  grants_over_time: [
    { date: '2025-10-01', new_grants: 3, revoked: 0, net_active: 3 },
    { date: '2025-10-02', new_grants: 5, revoked: 1, net_active: 7 },
    ...
  ],
  top_coaches: [
    { coach_id: 100, coach_name: 'Coach Mike', student_count: 15 },
    { coach_id: 101, coach_name: 'Pro Sarah', student_count: 12 },
    ...
  ],
  recent_activity: [
    { date: '2025-10-18T10:30:00Z', student_name: 'Alice', coach_name: 'Mike', action: 'granted' },
    ...
  ]
}
```

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Coach Access Analytics                                          │
├─────────────────────────────────────────────────────────────────┤
│ [Total: 50] [Active: 45] [Revoked: 5] [Adoption: 12.5%]        │
├─────────────────────────────────────────────────────────────────┤
│ Grants Over Time (Last 30 Days)                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [Line chart showing grant trends]                           ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ Top Coaches                   │ Recent Activity                 │
│ ┌───────────────────────────┐ │ ┌────────────────────────────┐│
│ │ [Bar chart]               │ │ │ [Activity table]           ││
│ └───────────────────────────┘ │ └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

### TASK-008: Performance Optimization - Database Indexes ⏱️ 1 hour
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Database Admin
**Deadline**: _____________
**Dependencies**: Production database access, slow query logs

**Description**:
Analyze slow queries and add missing indexes to optimize coach access system performance.

**Acceptance Criteria**:
- ☐ Slow query analysis completed
- ☐ Missing indexes identified
- ☐ Indexes added to production
- ☐ Query performance improvement verified (before/after comparison)
- ☐ No negative impact on write performance

**Analysis Steps**:
```sql
-- 1. Enable pg_stat_statements (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. Find slow queries related to coach access
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%coach_access_grants%'
   OR query LIKE '%friendships%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 3. Check existing indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('coach_access_grants', 'friendships')
ORDER BY tablename, indexname;

-- 4. Analyze query plans
EXPLAIN ANALYZE
SELECT /* paste slow query here */;
```

**Potential Indexes to Add** (based on common query patterns):
```sql
-- If grants are frequently queried by date
CREATE INDEX idx_coach_grants_granted_date
ON coach_access_grants(granted_at DESC)
WHERE status = 'active';

-- If friendships are frequently queried by creation date
CREATE INDEX idx_friendships_created_date
ON friendships(created_at DESC)
WHERE status = 'accepted';

-- If referrer lookups are slow
CREATE INDEX idx_players_referrer_level_1
ON players(referrer_level_1)
WHERE referrer_level_1 IS NOT NULL;

-- Composite index for common coach access queries
CREATE INDEX idx_coach_grants_composite
ON coach_access_grants(coach_player_id, status, granted_at DESC);
```

**Before/After Testing**:
```sql
-- Run before adding indexes
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM coach_access_grants
WHERE coach_player_id = 100 AND status = 'active'
ORDER BY granted_at DESC;
-- Note: Execution time, index scans vs. sequential scans

-- Add indexes (see above)

-- Run after adding indexes
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM coach_access_grants
WHERE coach_player_id = 100 AND status = 'active'
ORDER BY granted_at DESC;
-- Verify: Faster execution, uses indexes
```

**Monitoring**:
- Monitor query performance for 1 week after adding indexes
- Watch for any degradation in write performance (INSERT/UPDATE/DELETE)
- If write performance degrades significantly, consider removing less-used indexes

---

## P2 - Medium Priority (Nice to Have)

### TASK-009: Coach Notes on Student Sessions ⏱️ 6 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Full Stack Developer
**Deadline**: _____________
**Dependencies**: None

**Description**:
Allow coaches to add private notes on individual student sessions for tracking progress and areas to focus on.

**Acceptance Criteria**:
- ☐ "Add Note" button on session detail page (coach view only)
- ☐ Notes visible only to coach (not to student)
- ☐ Coach can edit/delete their own notes
- ☐ Notes include timestamp and coach name
- ☐ Character limit: 500 characters per note

**Database Schema**:
```sql
CREATE TABLE coach_session_notes (
  note_id SERIAL PRIMARY KEY,
  coach_player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
  student_player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(session_id) ON DELETE CASCADE,
  note_text TEXT CHECK (char_length(note_text) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coach_player_id, session_id)  -- One note per coach per session
);

CREATE INDEX idx_coach_notes_session ON coach_session_notes(session_id);
CREATE INDEX idx_coach_notes_coach ON coach_session_notes(coach_player_id);
```

**API Endpoints**:
```javascript
// Create/Update note
POST /api/coach-access/session-notes
Body: {
  session_id: 123,
  student_player_id: 456,
  note_text: "Great progress on streak! Focus on putting distance next session."
}

// Get notes for a session
GET /api/coach-access/session-notes/:sessionId

// Delete note
DELETE /api/coach-access/session-notes/:noteId
```

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Session #123 - Oct 17, 2025                                     │
│ [Session stats display]                                         │
├─────────────────────────────────────────────────────────────────┤
│ Coach Notes (Private - Only you can see this)                   │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Great progress on streak! Focus on putting distance next... ││
│ │ - Coach Mike, Oct 18, 2025 10:30 AM          [Edit] [Delete]││
│ └─────────────────────────────────────────────────────────────┘│
│ [+ Add Note]                                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Future Enhancements**:
- Rich text notes (bold, italic, bullet points)
- Attach images/videos to notes
- Share notes with student (opt-in)

---

### TASK-010: Access Level - Stats Only ⏱️ 4 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Backend Developer
**Deadline**: _____________
**Dependencies**: None

**Description**:
Implement `stats_only` access level where coaches can see aggregate stats but not individual session details.

**Acceptance Criteria**:
- ☐ Student can select access level when granting: "Full Sessions" or "Stats Only"
- ☐ `stats_only` access returns aggregate stats only (no session list)
- ☐ UI shows access level badge on coach dashboard
- ☐ Student can upgrade/downgrade access level anytime

**Database**:
Already supports `access_level` column in `coach_access_grants` table. No schema changes needed.

**API Changes**:
```javascript
// /api/player/[id]/sessions
// Check access_level before returning data

if (accessCheck.accessType === 'coach') {
  const { accessLevel } = accessCheck;

  if (accessLevel === 'stats_only') {
    // Return only aggregate stats
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(total_makes) as total_makes,
        AVG(make_percentage) as avg_make_percentage,
        MAX(best_streak) as best_streak,
        MIN(start_time) as first_session,
        MAX(start_time) as latest_session
      FROM sessions
      WHERE player_id = $1
    `, [playerId]);

    return res.json({
      access_level: 'stats_only',
      stats: stats.rows[0],
      sessions: []  // Empty for stats_only
    });
  }
}

// For 'full_sessions', return sessions as usual
```

**Frontend**:
```javascript
// On ContactsPage
<select value={accessLevel} onChange={handleAccessLevelChange}>
  <option value="full_sessions">Full Sessions</option>
  <option value="stats_only">Stats Only</option>
</select>
```

**Use Case**:
- Student wants to share progress with a friend/mentor but not reveal individual session details
- Coach just wants to see overall improvement trends

---

### TASK-011: Time-Limited Coach Access ⏱️ 3 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Backend Developer
**Deadline**: _____________
**Dependencies**: None

**Description**:
Add expiration dates to coach grants so access automatically expires after a set period (e.g., 30 days, 90 days, 1 year).

**Acceptance Criteria**:
- ☐ Student can set expiration date when granting access
- ☐ Cron job automatically revokes expired grants daily
- ☐ Coach receives notification before access expires (7 days warning)
- ☐ Student receives notification when access expires
- ☐ Coach dashboard shows "Expires in X days" warning

**Database Schema**:
```sql
ALTER TABLE coach_access_grants
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_coach_grants_expires
ON coach_access_grants(expires_at)
WHERE status = 'active' AND expires_at IS NOT NULL;
```

**Cron Job**:
```javascript
// /api/cron/expire-coach-grants.js
import cron from 'node-cron';

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(`
      UPDATE coach_access_grants
      SET status = 'expired', revoked_at = NOW()
      WHERE expires_at < NOW() AND status = 'active'
      RETURNING grant_id, student_player_id, coach_player_id
    `);

    console.log(`Expired ${result.rows.length} coach grants`);

    // Send notifications (optional)
    for (const grant of result.rows) {
      await sendExpirationNotification(grant);
    }
  } finally {
    client.release();
    await pool.end();
  }
});
```

**Frontend**:
```javascript
// On ContactsPage
<label>
  <input type="checkbox" checked={hasAccess} onChange={handleToggle} />
  Grant Coach Access
</label>

{hasAccess && (
  <div className="access-duration">
    <label>Access Duration:</label>
    <select value={duration} onChange={handleDurationChange}>
      <option value="permanent">Permanent</option>
      <option value="30">30 Days</option>
      <option value="90">90 Days</option>
      <option value="365">1 Year</option>
    </select>
  </div>
)}
```

---

### TASK-012: Friendship Deletion Trigger ⏱️ 1 hour
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Database Admin
**Deadline**: _____________
**Dependencies**: None

**Description**:
Add database trigger to automatically revoke coach access when a friendship is deleted.

**Rationale**:
If a student unfriends their coach (future feature: manual friendship deletion), the coach should no longer have access to their sessions.

**Database Implementation**:
```sql
CREATE OR REPLACE FUNCTION auto_revoke_coach_on_friendship_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Revoke any coach grants between these players
  UPDATE coach_access_grants
  SET status = 'revoked', revoked_at = NOW()
  WHERE (
      (student_player_id = OLD.player_id AND coach_player_id = OLD.friend_id)
      OR
      (student_player_id = OLD.friend_id AND coach_player_id = OLD.player_id)
    )
    AND status = 'active';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_revoke_coach_on_friendship_delete
AFTER DELETE ON friendships
FOR EACH ROW
EXECUTE FUNCTION auto_revoke_coach_on_friendship_delete();
```

**Testing**:
```sql
-- Create test friendship and grant
INSERT INTO friendships (player_id, friend_id, status)
VALUES (100, 101, 'accepted'), (101, 100, 'accepted');

INSERT INTO coach_access_grants (student_player_id, coach_player_id, status)
VALUES (100, 101, 'active');

-- Delete friendship
DELETE FROM friendships WHERE player_id = 100 AND friend_id = 101;

-- Verify grant was revoked
SELECT * FROM coach_access_grants WHERE student_player_id = 100 AND coach_player_id = 101;
-- Expected: status = 'revoked', revoked_at IS NOT NULL
```

---

## P3 - Low Priority (Future Considerations)

### TASK-013: Coach Session Comparison Tool ⏱️ 8 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Full Stack Developer
**Deadline**: _____________

**Description**:
Create a UI tool for coaches to compare multiple student sessions side-by-side to identify patterns and differences.

**Route**: `/coach/compare?students=101,102,103`

**Features**:
- Select up to 3 students to compare
- View their latest session stats side-by-side
- Highlight best performer in each metric (green)
- Highlight areas needing improvement (red)
- Export comparison as PDF

---

### TASK-014: Automated Progress Reports ⏱️ 12 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Backend Developer + Email Designer
**Deadline**: _____________

**Description**:
Automatically generate and email monthly progress reports to coaches summarizing their students' performance.

**Features**:
- Monthly email to coaches with students
- Summary stats: Total sessions, average improvement, top performers
- Charts showing progress over time
- PDF attachment with detailed report
- Opt-out setting in coach preferences

---

### TASK-015: Export Student Data as CSV ⏱️ 3 hours
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: Backend + Frontend Developer
**Deadline**: _____________

**Description**:
Allow coaches to download student session data as CSV for external analysis (Excel, Google Sheets).

**Features**:
- "Export to CSV" button on `/coach/dashboard` for each student
- CSV includes all session data
- Option to export multiple students at once
- Date range filter for export

---

## Task Management & Tracking

### How to Update This Document

1. **Update Status**: Change ☐ to ☑ when task is complete
2. **Add Notes**: Add any blockers, issues, or additional context under each task
3. **Update Deadlines**: Set realistic deadlines based on team capacity
4. **Assign Owners**: Assign specific team members to each task

### Status Definitions

- ☐ **Not Started**: Task has not been begun
- 🔄 **In Progress**: Task is actively being worked on
- ⏸️ **Blocked**: Task cannot proceed due to dependency or blocker
- ☑ **Complete**: Task is finished and verified
- ❌ **Cancelled**: Task is no longer needed

### Task Template (for adding new tasks)

```markdown
### TASK-XXX: [Task Name] ⏱️ [Estimated Hours]
**Status**: ☐ Not Started  ☐ In Progress  ☐ Complete
**Owner**: [Team Member Name]
**Deadline**: _____________
**Dependencies**: [List any dependencies]

**Description**:
[Detailed description of what needs to be done]

**Acceptance Criteria**:
- ☐ [Criterion 1]
- ☐ [Criterion 2]
- ☐ [Criterion 3]

**Resources**:
- [Links to relevant docs, code, etc.]

**Notes**:
[Any additional context, blockers, or updates]
```

---

## Quick Reference

**File Locations**:
- Handover Doc: `/Takeover.Reports/COACH_ACCESS_COMPLETE_HANDOVER.md`
- Testing Checklist: `/Takeover.Reports/COACH_ACCESS_TESTING_CHECKLIST.md`
- Test Suite: `/app/tests/coach-access-e2e.js`
- Database Migrations: `/app/database/add_*_coach_*.sql`
- API Endpoints: `/app/api/coach-access/`, `/app/api/contacts/`
- Frontend Components: `/app/src/pages/CoachDashboard.jsx`, `/app/src/pages/ContactsPage.jsx`

**Key Commands**:
```bash
# Run automated tests
node tests/coach-access-e2e.js dev

# Check database migrations
psql $DATABASE_URL -c "\dt coach_access_grants"

# View API logs
tail -f /var/log/api.log | grep coach-access
```

**Contact**:
- Technical Questions: dev@proofofputt.com
- Project Management: pm@proofofputt.com
- GitHub Issues: https://github.com/proofofputt/app/issues

---

**Last Updated**: October 18, 2025
**Next Review Date**: [Set based on team schedule]
