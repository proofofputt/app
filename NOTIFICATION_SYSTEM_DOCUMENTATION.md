# Proof of Putt: Notification System Documentation & Troubleshooting Guide

**Last Updated:** October 4, 2025
**Status:** Partially Implemented - Critical Bug Fixed

---

## Executive Summary

The notification system is designed to keep players informed about duels, leagues, achievements, and social interactions. A **critical bug was fixed on Oct 4, 2025** where the notifications table referenced the wrong foreign key (`players(id)` instead of `players(player_id)`), causing 500 errors.

**Current Status:**
- ✅ Database schema fixed (Oct 4, 2025)
- ✅ Core notification service implemented
- ⚠️ **INCOMPLETE:** Service not consistently used across all endpoints
- ⚠️ **INCOMPLETE:** Several notification types defined but not triggered

---

## Table of Contents

1. [Notification Triggers - Implementation Status](#notification-triggers)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Troubleshooting Checklist](#troubleshooting-checklist)
5. [Known Issues & Incomplete Features](#known-issues)
6. [Testing & Validation](#testing--validation)

---

## Notification Triggers - Implementation Status

### ✅ IMPLEMENTED & WORKING

#### 1. Duel Challenge Notifications
**Trigger Location:** `api/send-duel-invitation.js:92-96`
```javascript
await notificationService.createDuelChallengeNotification({
  playerId: userId,
  challengerName: challengerName,
  duelId: invitation.duel_id
});
```
**When:** User receives a duel invitation from another player
**Type:** `duel_challenge`
**Link:** `/duels/{duelId}`
**Status:** ✅ Working

---

### ⚠️ PARTIALLY IMPLEMENTED

#### 2. League Invitation Notifications
**Issue:** `api/league-invitations.js` imports `notificationService` but doesn't use it
- Line 3: Imports service
- Lines 316-332: Creates notifications directly in database using `league_notifications` table
- **Problem:** Bypasses the unified notification service

**Recommendation:** Update to use `notificationService.createLeagueInvitationNotification()`

#### 3. Duel Acceptance Notifications
**Issue:** `api/accept-duel-invitation.js` imports `notificationService` but doesn't use it
- Line 3: Imports service
- Lines 266-277: Creates notifications directly in database using `user_notifications` table
- **Problem:** Bypasses the unified notification service

**Recommendation:** Update to use `notificationService.createSystemNotification()`

---

### ❌ NOT IMPLEMENTED (Service Defined, No Triggers)

#### 4. Friend Request Notifications
**Service Method:** `createFriendRequestNotification()`
**Defined:** `api/services/notification.js:91-100`
**Status:** ❌ No endpoint triggers this notification
**Expected Trigger:** Friend request API (not found in codebase)

#### 5. Session Reminder Notifications
**Service Method:** `createSessionReminderNotification()`
**Defined:** `api/services/notification.js:103-112`
**Status:** ❌ No cron job or endpoint triggers this
**Expected Trigger:** Scheduled job for upcoming duel/league deadlines

#### 6. Achievement Notifications
**Service Method:** `createAchievementNotification()`
**Defined:** `api/services/notification.js:115-124`
**Status:** ❌ No achievement detection system implemented
**Expected Trigger:** Achievement detection logic (e.g., "10 putts in a row", "First duel win")

#### 7. Match Result Notifications
**Service Method:** `createMatchResultNotification()`
**Defined:** `api/services/notification.js:127-139`
**Status:** ❌ Not triggered when duels/leagues complete
**Expected Trigger:** Duel completion handler, League round completion

---

## Database Schema

### Notifications Table (Fixed Oct 4, 2025)

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,  -- FIXED
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link_path VARCHAR(500),
  data JSONB DEFAULT '{}',
  read_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_player_created
ON notifications(player_id, created_at DESC);
```

### Historical Bug (FIXED)
**Problem:** Foreign key referenced `players(id)` but column is `players(player_id)`
**Impact:** All notification endpoints returned 500 errors
**Fixed In:**
- `api/player/[id]/notifications.js:57`
- `api/player/[id]/notifications/unread-count.js:34`

### Inconsistent Notification Storage
**Problem:** Three different notification tables exist:
1. `notifications` - Used by NotificationService (correct)
2. `user_notifications` - Used by duel invitation acceptance
3. `league_notifications` - Used by league invitation acceptance

**Recommendation:** Consolidate to single `notifications` table with proper typing

---

## API Endpoints

### Read Notifications

#### GET `/api/player/[id]/notifications`
**Purpose:** Retrieve player's notifications
**Parameters:**
- `limit` (default: 20) - Number of notifications to return
- `offset` (default: 0) - Pagination offset

**Response:**
```json
{
  "notifications": [
    {
      "id": 123,
      "type": "duel_challenge",
      "title": "New Duel Challenge",
      "message": "John Doe has challenged you to a duel!",
      "link_path": "/duels/456",
      "data": { "duelId": 456, "challengerName": "John Doe" },
      "read_status": false,
      "created_at": "2025-10-04T12:00:00Z"
    }
  ],
  "unread_count": 3,
  "total_count": 20,
  "has_more": false
}
```

**Fixed Issues:**
- ✅ Foreign key corrected (Oct 4, 2025)
- ✅ Player existence check updated to use `player_id`

#### GET `/api/player/[id]/notifications/unread-count`
**Purpose:** Get count of unread notifications
**Response:**
```json
{
  "unread_count": 3
}
```

### Manage Notifications

#### POST `/api/player/[id]/notifications/[notificationId]/read`
**Purpose:** Mark single notification as read
**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "notification": { "id": 123, "read_status": true }
}
```

#### POST `/api/player/[id]/notifications/read-all`
**Purpose:** Mark all notifications as read
**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "updated_count": 5
}
```

#### DELETE `/api/player/[id]/notifications/[notificationId]`
**Purpose:** Delete notification
**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "deleted_id": 123
}
```

### Test Endpoint

#### POST `/api/test-notifications`
**Purpose:** Create test notifications for development
**Body:**
```json
{
  "playerId": 1009,
  "type": "duel_challenge" | "league_invitation" | "friend_request" | "achievement" | "system"
}
```

---

## Troubleshooting Checklist

### Notifications Not Loading (Fixed Oct 4, 2025)

#### Issue: "Failed to load notifications" + 500 errors
**Status:** ✅ RESOLVED
**Root Cause:** Foreign key referenced wrong column
**Solution Applied:**
1. Changed `players(id)` → `players(player_id)` in table creation
2. Updated player existence checks to use `player_id`
3. Deployed fix and verified in production

#### Verification Steps:
```bash
# 1. Check notifications load
curl https://app.proofofputt.com/api/player/1009/notifications \
  -H "Authorization: Bearer <token>"

# 2. Check unread count
curl https://app.proofofputt.com/api/player/1009/notifications/unread-count \
  -H "Authorization: Bearer <token>"

# 3. Create test notification
curl -X POST https://app.proofofputt.com/api/test-notifications \
  -H "Content-Type: application/json" \
  -d '{"playerId": 1009, "type": "duel_challenge"}'
```

---

### Notifications Not Being Created

#### Issue: Duel/League invitations don't create notifications
**Diagnosis Steps:**

1. **Check if notification service is imported:**
```bash
grep -r "import.*notificationService" api/
```

2. **Verify service is actually called:**
```bash
grep -r "notificationService.create" api/
```

3. **Common Issues:**
- ❌ Service imported but not used (see league-invitations.js, accept-duel-invitation.js)
- ❌ Direct database inserts bypass service
- ❌ Error handling swallows notification failures

**Fix Pattern:**
```javascript
// WRONG: Direct database insert
await client.query(`
  INSERT INTO user_notifications (user_id, title, message, ...)
  VALUES ($1, $2, $3, ...)
`, [userId, title, message]);

// RIGHT: Use notification service
await notificationService.createDuelChallengeNotification({
  playerId: userId,
  challengerName: challengerName,
  duelId: duelId
});
```

---

### Missing Notification Types

#### Issue: Achievements/Match Results don't create notifications
**Root Cause:** No trigger logic implemented

**Implementation Checklist:**
- [ ] Add achievement detection system
- [ ] Trigger achievement notifications when milestones reached
- [ ] Add match result notifications to duel completion
- [ ] Add league result notifications to round completion
- [ ] Add friend request notifications to friend system

---

## Known Issues & Incomplete Features

### Critical Issues
1. ✅ **FIXED:** Foreign key bug causing 500 errors (Oct 4, 2025)

### Medium Priority Issues
1. **Inconsistent Notification Storage**
   - Multiple notification tables (`notifications`, `user_notifications`, `league_notifications`)
   - **Impact:** Notifications scattered across different tables
   - **Fix:** Consolidate to single `notifications` table

2. **Service Not Used Consistently**
   - `league-invitations.js` - imports but doesn't use service
   - `accept-duel-invitation.js` - imports but doesn't use service
   - **Impact:** Bypasses unified notification logic
   - **Fix:** Update endpoints to use NotificationService

### Low Priority - Missing Features
1. **Achievement Notifications** - Service defined, no triggers
2. **Match Result Notifications** - Service defined, no triggers
3. **Session Reminders** - Service defined, no cron job
4. **Friend Requests** - Service defined, no friend system

---

## Testing & Validation

### Manual Testing Script

```bash
#!/bin/bash
# Test notification system end-to-end

PLAYER_ID=1009
API_URL="https://app.proofofputt.com/api"
TOKEN="your-auth-token-here"

echo "1. Creating test notification..."
curl -X POST "$API_URL/test-notifications" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\": $PLAYER_ID, \"type\": \"duel_challenge\"}"

echo "\n2. Checking unread count..."
curl "$API_URL/player/$PLAYER_ID/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN"

echo "\n3. Fetching notifications..."
curl "$API_URL/player/$PLAYER_ID/notifications?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq

echo "\n4. Marking all as read..."
curl -X POST "$API_URL/player/$PLAYER_ID/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN"

echo "\n5. Verifying unread count is 0..."
curl "$API_URL/player/$PLAYER_ID/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Production Flow

1. **Duel Invitation:**
   - User A creates duel → `send-duel-invitation.js`
   - ✅ NotificationService creates notification for User B
   - User B sees notification in `/notifications` page
   - User B clicks notification → redirects to `/duels/{id}`

2. **League Invitation:**
   - User A invites User B → `leagues/[leagueId]/join.js`
   - ⚠️ Currently: Direct DB insert to `league_notifications`
   - **Should:** Use `NotificationService.createLeagueInvitationNotification()`

3. **Achievement Unlocked:**
   - ❌ Not implemented
   - **Should:** Session upload triggers achievement check
   - **Should:** Create notification via `NotificationService.createAchievementNotification()`

---

## Handover Report References

### From MISSION_CRITICAL_DUELS_LEAGUES_TESTING.md (Sept 27, 2025)
Line 57: "✅ Notification sent to invited player"
Line 184: "✅ Notifications sent to both players"
Line 402: "- [ ] Notifications sent properly"

**Status:** Partially met - only duel challenge notifications working

### From COMPREHENSIVE_HANDOVER_SEPTEMBER_2025.md (Sept 26, 2025)
Line 224: "notifications -- System alerts, social messages"

**Status:** Table exists, schema fixed, service partially implemented

### From COMPREHENSIVE_PROJECT_ANALYSIS.md (Aug 31, 2025)
No specific notification references - predates notification system

---

## Action Items for Developers

### Immediate (This Week)
- [x] Fix foreign key bug (COMPLETED Oct 4, 2025)
- [ ] Update `league-invitations.js` to use NotificationService
- [ ] Update `accept-duel-invitation.js` to use NotificationService
- [ ] Add error logging to all notification creation calls

### Short Term (This Month)
- [ ] Add match result notifications to duel completion
- [ ] Add league result notifications to round completion
- [ ] Consolidate notification tables
- [ ] Add notification preferences (email, push, in-app)

### Long Term (Next Quarter)
- [ ] Implement achievement system with notifications
- [ ] Add session reminder cron job
- [ ] Add friend request system with notifications
- [ ] Add real-time notification delivery (WebSocket/SSE)

---

## Conclusion

The notification system has a solid foundation with the NotificationService, but integration is incomplete. The critical foreign key bug has been fixed (Oct 4, 2025), enabling the notifications page to load. However, several endpoints bypass the service and create notifications directly in the database, and several notification types are defined but never triggered.

**Priority Actions:**
1. ✅ Fix database schema bugs (DONE)
2. Ensure all notification creation uses NotificationService
3. Add missing notification triggers (match results, achievements)
4. Consolidate notification storage

**Success Metrics:**
- All notification types reliably created via unified service
- Real-time notification delivery working
- User notification preferences implemented
- Zero 500 errors on notification endpoints

---

*Last Updated: October 4, 2025*
*Next Review: After implementing missing notification triggers*
