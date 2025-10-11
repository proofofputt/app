# DUEL SCORING 0-0 ISSUE: ROOT CAUSE ANALYSIS
**September 27, 2025**

## Executive Summary
Duels are showing 0-0 scores because the desktop app is NOT properly linking uploaded sessions to duels. Sessions are being uploaded with actual data (e.g., "18 putts, 12 makes") but they're not being associated with the duel_id in the database.

## Root Cause
The desktop app is uploading sessions but NOT including the `duel_id` parameter in the upload request to `/api/upload-session`. Without this parameter, the session cannot be linked to the duel, resulting in 0-0 scores.

## Evidence from Investigation

### 1. Sessions ARE Being Captured Successfully
From the logs:
```
📊 Loaded comprehensive session data: 18 putts, 12 makes, 7 best streak
📊 Loaded comprehensive session data: 9 putts, 5 makes, 2 best streak
📊 Loaded comprehensive session data: 5 putts, 1 makes, 1 best streak
```

### 2. Sessions ARE Being Uploaded
```
Competitive session unknown auto-uploaded successfully as d34bf31b-1175-41e6-95dd-e32a1546aa91
📊 Including duel metadata in comprehensive upload: duel_id=35
```

### 3. But They're NOT Being Linked to Duels
The API endpoint `/api/upload-session` exists and has complete logic to:
- Accept `duel_id` as a parameter (lines 86, 174)
- Link sessions to duels in the database (lines 197-200)
- Automatically score duels when both players submit (lines 209-256)

However, the desktop app appears to be calling a different endpoint or missing the duel_id parameter.

## The Complete Data Flow (How It Should Work)

### Step 1: Duel Creation
- Player creates duel on web app
- Duel parameters generated (e.g., "duel=35,time_limit=120,scoring=total_makes")

### Step 2: Desktop Session
- Player pastes parameters into desktop app
- Session starts with proper context including duel_id
- YOLO detection tracks putts (camera detection working)
- Session completes with actual data

### Step 3: Session Upload (WHERE IT BREAKS)
**Expected**:
```javascript
POST /api/upload-session
{
  "player_id": 1,
  "session_data": {...},
  "duel_id": 35  // CRITICAL: This links session to duel
}
```

**Actual**: The desktop app is either:
1. Not including the duel_id parameter
2. Calling a different endpoint
3. Using incorrect field names

### Step 4: Duel Scoring
When `/api/upload-session` receives duel_id:
1. Updates `duels` table with session_id (lines 197-200)
2. Checks if both players submitted (line 209)
3. Automatically scores and completes duel (lines 230-251)

## Why Camera Index Doesn't Matter
The user correctly noted that camera index switching during sessions is fine. The real issue is the missing duel_id parameter during upload, NOT the camera detection.

## Solution Required

### Desktop App Fix Needed
The desktop app (Rust/Tauri) needs to:
1. Extract duel_id from session context
2. Include it in the upload payload to `/api/upload-session`
3. Verify the correct endpoint is being called

### Temporary Workaround
Until the desktop app is fixed, duels will continue showing 0-0 because sessions aren't being linked.

## Verification Steps
1. Check desktop app's upload code for missing duel_id parameter
2. Verify correct API endpoint is being called
3. Test with manual API call including duel_id to confirm backend works

## Impact
- All competitive duels show 0-0 scores
- Sessions are captured but not linked
- Competition integrity compromised
- User experience significantly degraded

## Priority: CRITICAL
This is a mission-critical bug affecting the core competitive feature of the platform.