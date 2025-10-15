# Player ID Reference Flow Analysis

## Executive Summary

**Root Issue**: Player ID 1009 exists in JWT tokens but not in the `players` table, causing foreign key constraint violations when creating leagues.

## Current Architecture

### JWT Token Structure
```javascript
// Generated in api/login.js line 85
{
  playerId: player.player_id,  // camelCase
  email: player.email
}
```

### Database Schema
- **Primary Table**: `players`
  - Primary key: `player_id` (snake_case integer)
- **Related Tables**: All use `player_id` as foreign key
  - `sessions.player_id` → `players.player_id`
  - `duels.duel_creator_id` → `players.player_id`
  - `duels.duel_invited_player_id` → `players.player_id`
  - `leagues.created_by` → `players.player_id`
  - `league_memberships.player_id` → `players.player_id`

## Data Flow by Feature

### 1. Practice Sessions ✅ WORKING

**Upload Path**: Desktop App → `POST /api/sessions/submit`

```javascript
// sessions/submit.js line 43
const { player_id } = metadata;  // From request body

// Line 112 - Uses player_id directly from request
INSERT INTO sessions (session_id, player_id, data, ...)
VALUES ($1, $2, ...)  // $2 = player_id from request
```

**Status**: Working because desktop app sends correct player_id in request body

### 2. Duels ⚠️ PARTIALLY WORKING

**Upload Path**: Desktop App → `PUT /api/duels-v2` (action=submit)

```javascript
// duels-v2.js line 134
const playerId = user ? parseInt(user.playerId) : null;  // From JWT

// Line 336 - Verifies session belongs to player
SELECT session_id FROM sessions
WHERE session_id = $1 AND player_id = $2  // $2 = playerId from JWT
```

**Issue Reported**: "Your Score" field not updating on duels page
**Root Cause**: Session exists in DB but duel record may not be linking correctly

### 3. Leagues ❌ NOT WORKING

**Create Path**: Web App → `POST /api/leagues`

```javascript
// leagues.js line 252 (AuthContext)
const user = await verifyToken(req);
const creatorId = user.playerId;  // From JWT

// Line 258-273 - Player existence check
const playerCheck = await client.query(`
  SELECT player_id FROM players WHERE player_id = $1
`, [user.playerId]);  // FAILS - player 1009 doesn't exist!

// Line 311 - Foreign key constraint violation
INSERT INTO leagues (created_by, ...)
VALUES ($1, ...)  // $1 = user.playerId (1009) - FK fails
```

**Status**: Failing with foreign key constraint violation

## The Root Cause

**Player 1009 does not exist in the `players` table**

This can happen when:
1. OAuth authentication creates a JWT with a player_id
2. BUT the player record was never inserted into the database
3. OR there's a mismatch between auth provider IDs and database player_ids

## Consistency Issues

### Naming Conventions
- **JWT**: Uses `playerId` (camelCase)
- **Database**: Uses `player_id` (snake_case)
- **API Endpoints**: Mix of both

### Auth Token Storage
- **Key variations found**:
  - `authToken` (correct - used in api.js, AuthContext.jsx)
  - `auth_token` (incorrect - was in LeaguesPage.jsx, now fixed)
  - `token` (used in some settings pages)

## Required Fixes

### 1. Verify Player 1009 Exists
```sql
SELECT player_id, name, email, google_id, created_at
FROM players
WHERE player_id = 1009;
```

### 2. If Missing, Check Auth Records
```sql
-- Check if there's an orphaned OAuth record
SELECT * FROM oauth_tokens WHERE player_id = 1009;

-- Check all players to find ID gaps
SELECT player_id, email, provider FROM players ORDER BY player_id DESC LIMIT 20;
```

### 3. Ensure Unified Player Creation

**All auth endpoints must**:
1. Create player record in `players` table FIRST
2. THEN generate JWT with that player_id
3. Verify player exists before returning token

**Files to check**:
- `api/login.js` - Email/password login
- `api/register.js` - Email registration
- `api/auth/google/callback.js` - Google OAuth
- `api/auth/linkedin/callback.js` - LinkedIn OAuth
- `api/auth/nostr/authenticate.js` - Nostr auth

### 4. Add Player Existence Middleware

Create a middleware that verifies player exists for ALL authenticated endpoints:

```javascript
async function ensurePlayerExists(req, res, next) {
  const user = await verifyToken(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const playerCheck = await pool.query(
    'SELECT player_id FROM players WHERE player_id = $1',
    [user.playerId]
  );

  if (playerCheck.rows.length === 0) {
    return res.status(403).json({
      message: 'Player record not found. Please log out and log in again.'
    });
  }

  req.user = user;
  req.playerId = user.playerId;
  next();
}
```

## Testing Checklist

After fixes are applied:

- [ ] Verify player 1009 exists or fix auth flow
- [ ] Test login → check player record created
- [ ] Test practice session upload → verify player_id in DB
- [ ] Test duel creation → verify both player records exist
- [ ] Test duel submission → verify score updates
- [ ] Test league creation → verify FK constraint passes
- [ ] Test league membership → verify player can join

## Debug Endpoint

The debug endpoint at `/api/debug/check-player` provides:
```json
{
  "player_exists": true/false,
  "player_data": { player_id, name, email },
  "jwt_payload": { playerId, email },
  "diagnosis": "Can create league" / "Player not found"
}
```

**Current Status**: Deployed and ready for testing once localStorage key fix is live.
