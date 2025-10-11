# League Invitations Troubleshooting Guide

**Created:** October 11, 2025
**Status:** System fully functional after extensive debugging
**Last Verified:** October 11, 2025

---

## Executive Summary

League invitations system has been fully debugged and is now operational. This document provides comprehensive troubleshooting guidance for any future issues that may arise after deployment.

**Critical Context:** During initial debugging, we discovered multiple database schema mismatches that required fixes. All known issues have been resolved, but this guide documents the entire system architecture for future reference.

---

## System Architecture

### Database Tables Involved

1. **`league_invitations`** - Stores all invitation records
2. **`league_memberships`** - Stores league members (uses composite primary key)
3. **`leagues`** - League information and settings
4. **`players`** - Player information

### API Endpoints

1. **POST** `/api/leagues/[leagueId]/invite` - Send invitation
2. **POST** `/api/leagues/invites/[inviteId]/respond` - Accept/decline invitation

### Frontend Components

1. **LeagueDetailPage.jsx** - Main league page with invite functionality
2. **InlineInviteForm.jsx** - Form component for inviting players
3. **api.js** - Contains `apiInviteToLeague()` function

---

## Database Schema Reference

### league_invitations Table

**Correct Column Names:**
```sql
- invitation_id (primary key)
- league_id (foreign key → leagues.league_id)
- inviting_player_id (foreign key → players.player_id)
- invited_player_id (foreign key → players.player_id)
- status (enum: 'pending', 'accepted', 'declined', 'expired')
- message (optional invitation message)
- invitation_method (enum: 'username', 'email', 'phone')
- expires_at (timestamp)
- created_at (timestamp)
- responded_at (timestamp, nullable)
```

**❌ WRONG Column Names (DO NOT USE):**
- `inviting_user_id` (old name)
- `invited_user_id` (old name)
- `invitation_status` (use `status` instead)
- `invitation_message` (use `message` instead)

### league_memberships Table

**Important:** This table uses a **composite primary key** `(league_id, player_id)`.

**Correct Column Names:**
```sql
- league_id (part of composite primary key)
- player_id (part of composite primary key)
- league_member_id (references players.player_id)
- league_inviter_id (references players.player_id)
- member_role (enum: 'creator', 'admin', 'member')
- invite_permissions (boolean)
- is_active (boolean)
- joined_at (timestamp)
```

**❌ WRONG:** There is NO `membership_id` column. Use `(league_id, player_id)` composite key.

---

## Current Implementation

### File: api/leagues/[leagueId]/invite.js

**Request Body:**
```javascript
{
  inviter_id: number,          // Optional, defaults to authenticated user
  invitee_id: number,          // Required
  invitation_message: string   // Optional
}
```

**Response (Success 201):**
```javascript
{
  success: true,
  message: "League invitation sent to {player_name}",
  invitation: {
    invitation_id: number,
    league_id: number,
    league_name: string,
    inviter_id: number,
    inviter_name: string,
    invited_player_id: number,
    invited_player_name: string,
    invitation_status: string,
    invited_at: timestamp,
    expires_at: timestamp
  }
}
```

**Key Logic Flow:**
1. Verify authentication (JWT token)
2. Verify league exists and get permissions
3. Check if user has permission to invite
4. Check if league status allows invitations (`setup`, `registering`, `active`)
5. Verify invited player exists
6. Check if player is already a member
7. Check for existing pending invitations
8. Create invitation record
9. Return success response

**Permission Checks:**
```javascript
const canInvite = (
  league.created_by === parseInt(inviterId) ||
  league.member_role === 'admin' ||
  (league.member_role === 'member' && league.settings?.allow_player_invites)
);
```

---

## Common Issues and Solutions

### Issue 1: 500 Error - Column "inviting_user_id" does not exist

**Symptoms:**
- 500 Internal Server Error
- Database error in logs: `column "inviting_user_id" does not exist`

**Root Cause:**
- Code is using old column names `inviting_user_id` or `invited_user_id`
- Production database uses `inviting_player_id` and `invited_player_id`

**Solution:**
1. Search codebase for wrong column names:
```bash
grep -r "inviting_user_id\|invited_user_id" api/ --include="*.js"
```

2. Replace all instances:
   - `inviting_user_id` → `inviting_player_id`
   - `invited_user_id` → `invited_player_id`

**Files to Check:**
- `api/leagues/[leagueId]/invite.js` (line 148-168)
- `api/leagues/invites/[inviteId]/respond.js` (line 65-82)

---

### Issue 2: 500 Error - Column "membership_id" does not exist

**Symptoms:**
- 500 Internal Server Error when checking existing membership
- Database error: `column "membership_id" does not exist`

**Root Cause:**
- Code is trying to SELECT or reference `membership_id`
- Table uses composite primary key `(league_id, player_id)` with NO `membership_id`

**Solution:**
1. Search for incorrect references:
```bash
grep -r "membership_id" api/leagues/ --include="*.js"
```

2. Replace queries:
```javascript
// ❌ WRONG
SELECT membership_id FROM league_memberships
WHERE league_id = $1 AND player_id = $2

// ✅ CORRECT
SELECT league_id, player_id FROM league_memberships
WHERE league_id = $1 AND player_id = $2
```

**Files to Check:**
- `api/leagues/[leagueId]/invite.js` (line 122-125)
- `api/leagues/[leagueId]/join.js`

---

### Issue 3: 500 Error - Check constraint "valid_invitation_method"

**Symptoms:**
- 500 error when creating invitation
- Database error: `new row violates check constraint "valid_invitation_method"`

**Root Cause:**
- Using invalid value for `invitation_method`
- Database constraint only allows: `'username'`, `'email'`, `'phone'`

**Solution:**
1. Check what value is being inserted:
```bash
grep -r "invitation_method" api/leagues/[leagueId]/invite.js
```

2. Ensure only valid values are used:
```javascript
// ❌ WRONG
invitation_method = 'direct'

// ✅ CORRECT
invitation_method = 'username'  // or 'email' or 'phone'
```

**Current Implementation:**
- Line 159 in `api/leagues/[leagueId]/invite.js` uses `'username'` ✅

---

### Issue 4: 500 Error - Foreign key violation on users.id

**Symptoms:**
- Foreign key constraint violation
- Error references `users.id` table

**Root Cause:**
- Foreign keys pointing to wrong table
- Should reference `players.player_id`, not `users.id`

**Solution:**
1. Check foreign key constraints:
```sql
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'league_invitations'::regclass
ORDER BY contype, conname;
```

2. If foreign keys reference `users.id`, create migration to fix:
```sql
-- Drop old constraints
ALTER TABLE league_invitations
DROP CONSTRAINT IF EXISTS league_invitations_inviting_user_id_fkey;

ALTER TABLE league_invitations
DROP CONSTRAINT IF EXISTS league_invitations_invited_user_id_fkey;

-- Add correct constraints
ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_inviting_player_id_fkey
FOREIGN KEY (inviting_player_id) REFERENCES players(player_id);

ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_invited_player_id_fkey
FOREIGN KEY (invited_player_id) REFERENCES players(player_id);
```

**Note:** This was fixed during initial debugging on production database.

---

### Issue 5: Wrong Database Environment

**Symptoms:**
- Changes work in development but fail in production
- Can't find expected data (leagues, players) in database

**Root Cause:**
- Testing against wrong database URL
- Environment variables pointing to dev instead of production

**Solution:**
1. Verify you're using correct DATABASE_URL:
```bash
# Get production URL from Vercel
vercel env pull .env.vercel.production

# Check which database you're connected to
echo $DATABASE_URL | grep -o "adx[a-z0-9]*"
```

2. Production database identifier: `adxckj5g`
3. Development database identifier: `admkp66m`

**Important:** Always test fixes against production database URL after pulling from Vercel.

---

### Issue 6: 400 Error - Player already has pending invitation

**Symptoms:**
- 400 Bad Request
- Message: "Player already has a pending invitation to this league"

**Root Cause:**
- Duplicate invitation attempt
- Previous invitation is still `pending`

**Solution:**
This is **expected behavior**, not a bug. Options:

1. **User should cancel/decline existing invitation first**
2. **Admin can manually update invitation status:**
```sql
UPDATE league_invitations
SET status = 'expired', responded_at = NOW()
WHERE league_id = $1 AND invited_player_id = $2 AND status = 'pending';
```

---

### Issue 7: 403 Error - No permission to invite

**Symptoms:**
- 403 Forbidden
- Message: "You do not have permission to invite players to this league"

**Root Cause:**
- User doesn't meet permission requirements

**Permission Requirements (ANY of these):**
1. User is the league creator (`created_by` matches `inviterId`)
2. User is a league admin (`member_role = 'admin'`)
3. User is a member AND league allows member invites (`member_role = 'member'` AND `settings.allow_player_invites = true`)

**Solution:**
1. Check league membership:
```sql
SELECT member_role FROM league_memberships
WHERE league_id = $1 AND player_id = $2;
```

2. Check league settings:
```sql
SELECT settings->>'allow_player_invites' as allow_invites
FROM leagues
WHERE league_id = $1;
```

3. Update settings if needed:
```sql
UPDATE leagues
SET settings = jsonb_set(settings, '{allow_player_invites}', 'true'::jsonb)
WHERE league_id = $1;
```

---

### Issue 8: 400 Error - Cannot invite players to league with status: completed

**Symptoms:**
- 400 Bad Request
- Message shows league status is `completed`, `cancelled`, etc.

**Root Cause:**
- League is not in a state that accepts new members

**Valid States for Invitations:**
- `setup`
- `registering`
- `active`

**Solution:**
This is **expected behavior**. Cannot invite to completed/cancelled leagues.

If league status is incorrect:
```sql
UPDATE leagues
SET status = 'active'
WHERE league_id = $1 AND status != 'completed';
```

---

## Debugging Tools

### 1. Validate Database References Script

**File:** `validate-database-references.js`

**Usage:**
```bash
DATABASE_URL="<production-url>" node validate-database-references.js
```

**What it does:**
- Queries database schema for all critical tables
- Checks codebase for wrong column references
- Reports any mismatches

### 2. Manual Database Inspection

**Get table schema:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'league_invitations'
ORDER BY ordinal_position;
```

**Get constraints:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'league_invitations'::regclass
ORDER BY contype, conname;
```

**Check recent invitations:**
```sql
SELECT
  li.invitation_id,
  li.league_id,
  l.name as league_name,
  inviter.name as inviter_name,
  invited.name as invited_name,
  li.status,
  li.invitation_method,
  li.created_at,
  li.expires_at
FROM league_invitations li
JOIN leagues l ON li.league_id = l.league_id
JOIN players inviter ON li.inviting_player_id = inviter.player_id
JOIN players invited ON li.invited_player_id = invited.player_id
ORDER BY li.created_at DESC
LIMIT 10;
```

### 3. API Endpoint Testing

**Test invite endpoint:**
```bash
# Get auth token first
TOKEN="<jwt_token>"

# Send invitation
curl -X POST https://app.proofofputt.com/api/leagues/26/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invitee_id": 123,
    "invitation_message": "Join my league!"
  }'
```

---

## Frontend Integration

### Component: LeagueDetailPage.jsx

**Location:** Line 206-223

**How it works:**
```javascript
const handleInvitePlayer = useCallback(async (inviteeId, newPlayerData = null) => {
  try {
    if (newPlayerData) {
      // New player invite - not implemented yet
      showNotification(`📧 New player invite functionality coming soon...`);
    } else {
      // Existing player invite
      const response = await apiInviteToLeague(leagueId, inviteeId, playerData.player_id);
      showNotification(response.message);
    }
  } catch (err) {
    showNotification(err.message, true);
  } finally {
    fetchLeagueDetails();
  }
}, [leagueId, playerData, fetchLeagueDetails, showNotification]);
```

### API Function: api.js

```javascript
export const apiInviteToLeague = (leagueId, inviteeId, inviterId = null) =>
  fetch(`${API_BASE_URL}/leagues/${leagueId}/invite`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      invitee_id: inviteeId,
      inviter_id: inviterId
    })
  }).then(handleResponse);
```

**Request Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

---

## Testing Checklist

When testing league invitations after deployment:

- [ ] **Test as league creator** - Should be able to invite anyone
- [ ] **Test as admin member** - Should be able to invite anyone
- [ ] **Test as regular member (allow_player_invites = true)** - Should be able to invite
- [ ] **Test as regular member (allow_player_invites = false)** - Should get 403 error
- [ ] **Test as non-member** - Should get 403 error
- [ ] **Test duplicate invitation** - Should get 400 error about pending invitation
- [ ] **Test inviting to completed league** - Should get 400 error about league status
- [ ] **Test inviting existing member** - Should get 400 error about already a member
- [ ] **Test inviting non-existent player** - Should get 404 error
- [ ] **Verify invitation appears in database** - Check league_invitations table
- [ ] **Verify invitation can be accepted** - Test respond endpoint
- [ ] **Verify expired invitations** - Check invitations older than 7 days

---

## Known Limitations

1. **New player invites by email/phone** - Not yet implemented
   - Currently shows "coming soon" message
   - Would require integration with email/SMS service
   - Would need player account creation flow

2. **Invitation notifications** - Not implemented
   - Players don't receive email/SMS when invited
   - They must check their leagues page manually

3. **Invitation history** - Limited UI
   - No way to view sent invitations
   - No way to cancel sent invitations
   - No admin panel for managing invitations

---

## Related Documentation

- **DATABASE_SCHEMA_REFERENCE.md** - Production schema column names
- **validate-database-references.js** - Schema validation script
- **archive/README.md** - Documentation for archived scripts

---

## Change History

### October 11, 2025
- Fixed all column name mismatches (inviting_user_id → inviting_player_id)
- Fixed membership_id query (now uses composite key)
- Fixed invitation_method constraint ('direct' → 'username')
- Fixed foreign keys (users.id → players.player_id)
- Verified all fixes against production database (adxckj5g)
- System fully operational

---

## Contact & Escalation

If issues persist after following this guide:

1. Check Vercel deployment logs for runtime errors
2. Check Neon database logs for query errors
3. Verify DATABASE_URL environment variable is correct
4. Run validation script to check for schema mismatches
5. Check frontend console for API request/response details

**Critical Files:**
- Backend: `api/leagues/[leagueId]/invite.js`
- Frontend: `src/components/LeagueDetailPage.jsx`
- API Layer: `src/api.js`
- Database: `league_invitations`, `league_memberships` tables

---

## Conclusion

The league invitations system is now fully functional and has been tested against production database. This guide documents the complete architecture, common issues, and debugging procedures for future reference.

**System Status:** ✅ Operational
**Last Tested:** October 11, 2025
**Production Database:** adxckj5g (Neon)
