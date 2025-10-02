# OAuth Flow Improvements

## Problem
The original OAuth flow automatically created accounts for all new users, which caused issues:
1. No differentiation between "Sign in with Google" vs "Sign up with Google"
2. Users clicking "Sign in" but having no account were stuck
3. Users clicking "Sign up" but already having an account experienced conflicts
4. No opportunity to complete profile setup for new OAuth users

## Solution Implemented

### 1. OAuth Mode Detection
- OAuth session now stores `mode` ('login' or 'signup')
- Frontend sends mode when initiating OAuth
- Backend uses mode to determine appropriate flow

### 2. Four New Flow Scenarios

#### A. Login Mode + Existing Account ✅
- User clicks "Continue with Google" on login page
- Account with matching Google ID or email exists
- Result: Login successful, account linked if needed

#### B. Login Mode + No Account ❌ → Setup
- User clicks "Continue with Google" on login page  
- No account exists with that email
- Result: Redirect to `/setup-account` to create account

#### C. Signup Mode + No Account ✅
- User clicks "Sign up with Google" on register page
- No account exists
- Result: Account created automatically, login successful

#### D. Signup Mode + Existing Account ❌ → Link
- User clicks "Sign up with Google" on register page
- Account already exists with that email
- Result: Redirect to `/link-account` to authenticate and link

### 3. New Pages Created

**SetupAccountPage** (`/setup-account`)
- For OAuth users who tried to login but have no account
- Allows completing profile (display name)
- Creates account with OAuth credentials

**LinkAccountPage** (`/link-account`)
- For OAuth users who tried to signup but account exists
- Requires password authentication
- Links OAuth provider to existing account

### 4. New API Endpoints

**POST `/api/auth/complete-oauth-signup`**
- Completes account creation for new OAuth users
- Validates setup token
- Creates player record
- Returns auth token

**POST `/api/auth/link-oauth`**
- Links OAuth provider to existing account
- Requires authentication
- Validates link token
- Updates player record

### 5. Database Changes

**Migration: `add-oauth-mode-column.js`**
```sql
ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'login';
```

### 6. Files Modified

**Backend:**
- `api/auth/google/init.js` - Accept and store mode parameter
- `api/auth/google/callback.js` - Implement flow logic based on mode
- `api/auth/link-oauth.js` - NEW: Link OAuth to existing account
- `api/auth/complete-oauth-signup.js` - NEW: Complete OAuth signup

**Frontend:**
- `src/pages/LoginPage.jsx` - Add OAuth button to register form
- `src/components/OAuthButton.jsx` - Pass mode to init API, update button text
- `src/utils/oauth.js` - Accept mode parameter in initiateGoogleOAuth
- `src/pages/LinkAccountPage.jsx` - NEW: Link account flow
- `src/pages/SetupAccountPage.jsx` - NEW: Complete account setup
- `src/App.jsx` - Add new routes

### 7. Migration Required

```bash
cd /Users/nw/proofofputt-repos/proofofputt/app
node migrations/add-oauth-mode-column.js
```

## User Experience Improvements

**Before:**
- Confusing when OAuth user tried to login but had no account
- Unexpected behavior when trying to signup with existing account
- No way to complete profile for new OAuth users

**After:**
- Clear "Sign up with Google" vs "Continue with Google" buttons
- Graceful handling of account mismatches
- Guided flows for both scenarios
- Users always end up authenticated with proper account state

## Testing Checklist

- [ ] New user clicks "Sign up with Google" → Account created
- [ ] New user clicks "Continue with Google" (login) → Redirected to setup
- [ ] Existing user clicks "Continue with Google" → Logged in successfully
- [ ] Existing user clicks "Sign up with Google" → Redirected to link account
- [ ] Link account flow completes with password auth
- [ ] Setup account flow completes with display name
- [ ] Error handling for expired tokens
- [ ] Error handling for invalid tokens
