# Coach Access System - Manual Testing Checklist

**Version**: 1.0
**Date**: October 18, 2025
**Tester**: _______________
**Environment**: ☐ Development  ☐ Staging  ☐ Production

---

## Pre-Testing Setup

### Test Account Requirements

Create the following test accounts:

| Role | Email | Password | Player ID | Referral Code |
|------|-------|----------|-----------|---------------|
| Coach (Referrer) | coach.test@proofofputt.com | ___________ | _______ | ___________ |
| Student 1 | student1.test@proofofputt.com | ___________ | _______ | (use coach's code) |
| Student 2 | student2.test@proofofputt.com | ___________ | _______ | (use coach's code) |
| Admin | admin.test@proofofputt.com | ___________ | _______ | N/A |
| Unauthorized | unauthorized.test@proofofputt.com | ___________ | _______ | N/A |

**Instructions:**
1. Create Coach account first, note the referral code
2. Sign up Students using Coach's referral code
3. Verify admin account has `is_admin = true` in database

---

## Test Section 1: User Signup & Auto-Friendship

### Test 1.1: New User Signup with Referral Code

**Objective**: Verify auto-friendship is created when user signs up with referral code

**Steps:**
1. ☐ Navigate to registration page (`/register`)
2. ☐ Fill in registration form:
   - Name: `Test Student 1`
   - Email: `student1.test@proofofputt.com`
   - Password: `[secure password]`
   - Referral Code: `[Coach's referral code]`
3. ☐ Click "Register" button
4. ☐ Verify registration success message appears
5. ☐ Login with new account credentials
6. ☐ Navigate to `/contacts` page

**Expected Results:**
- ☐ Coach appears in "Your Friends" list
- ☐ Coach has special badge: "🌟 Your Referrer"
- ☐ Coach appears FIRST in the friends list
- ☐ Session stats displayed for coach (if they have sessions)

**Database Verification:**
```sql
-- Run in database console
SELECT * FROM friendships
WHERE (player_id = [coach_id] AND friend_id = [student1_id])
   OR (player_id = [student1_id] AND friend_id = [coach_id]);
```

**Expected Database Result:**
- ☐ 2 rows returned (bidirectional friendship)
- ☐ Both rows have `status = 'accepted'`
- ☐ Both rows have `source = 'referral'`
- ☐ `source_context` contains `{"auto_created": true, "referral_code": "..."}`

**Screenshot:** Attach screenshot of Contacts page showing coach in friends list

---

### Test 1.2: Referral Chain Population

**Objective**: Verify 5-level referral chain is populated correctly

**Steps:**
1. ☐ Login as Student 1
2. ☐ Copy your referral code from Settings page
3. ☐ Create Student 2 account using Student 1's referral code
4. ☐ Login as Admin
5. ☐ Navigate to `/admin/users`
6. ☐ Search for Student 2
7. ☐ Click on Student 2 to view profile

**Expected Results:**
- ☐ Referral chain displayed on admin profile page:
  - Level 1: Student 1
  - Level 2: Coach
  - Level 3-5: (empty if no further chain)
- ☐ Each referrer card clickable
- ☐ Clicking referrer navigates to their profile page

**Database Verification:**
```sql
SELECT player_id, name, referrer_level_1, referrer_level_2
FROM players
WHERE player_id = [student2_id];
```

**Expected:**
- ☐ `referrer_level_1` = Student 1's player_id
- ☐ `referrer_level_2` = Coach's player_id

**Screenshot:** Attach screenshot of admin profile page showing referral chain

---

## Test Section 2: Granting Coach Access

### Test 2.1: Grant Coach Access via Contacts Page

**Objective**: Student grants coach access to view their sessions

**Steps:**
1. ☐ Login as Student 1
2. ☐ Navigate to `/contacts`
3. ☐ Locate Coach in friends list
4. ☐ Find checkbox: "☐ Grant Coach Access (they can view your sessions)"
5. ☐ Click checkbox to enable
6. ☐ Verify checkbox becomes checked: "☑ Grant Coach Access"
7. ☐ Verify success notification appears: "Coach access granted successfully"
8. ☐ Refresh page (F5 or Cmd+R)
9. ☐ Verify checkbox still checked

**Expected Results:**
- ☐ Checkbox toggles on
- ☐ Success notification displayed
- ☐ State persists after refresh
- ☐ No errors in browser console (F12)

**Database Verification:**
```sql
SELECT * FROM coach_access_grants
WHERE student_player_id = [student1_id] AND coach_player_id = [coach_id];
```

**Expected:**
- ☐ 1 row returned
- ☐ `status = 'active'`
- ☐ `access_level = 'full_sessions'`
- ☐ `granted_at` is set (not NULL)
- ☐ `revoked_at` is NULL

**Screenshot:** Attach screenshot of checked coach access checkbox

---

### Test 2.2: Bidirectional Coach Access Visibility

**Objective**: Verify both student and coach see the access relationship status

**Steps:**
1. ☐ While logged in as Student 1, view Coach in friends list
2. ☐ Verify text appears: "☑ Grant Coach Access" (you granted them access)
3. ☐ Logout
4. ☐ Login as Coach
5. ☐ Navigate to `/contacts`
6. ☐ Find Student 1 in friends list
7. ☐ Verify text appears: "✓ They granted you access"
8. ☐ Verify button appears: "View Their Sessions"

**Expected Results:**
- ☐ Student sees: "I granted coach access"
- ☐ Coach sees: "Student granted me access"
- ☐ Coach sees "View Sessions" button

**Screenshot:** Attach screenshots from both perspectives

---

## Test Section 3: Coach Dashboard

### Test 3.1: Coach Views Student List

**Objective**: Coach can view all students who granted access

**Steps:**
1. ☐ Login as Coach
2. ☐ Navigate to `/coach/dashboard`
3. ☐ Verify page title: "Coach Dashboard"
4. ☐ Verify subtitle: "View and track students who granted you access to their sessions"
5. ☐ Verify summary stats displayed:
   - Total Students: [count]
   - Active This Week: [count]
   - Inactive: [count]
6. ☐ Verify Student 1 appears in students list
7. ☐ Verify student card shows:
   - Student name
   - Active/Inactive status badge (🟢 Active or ⚫ Inactive)
   - Total sessions count
   - Last session date
   - Access level (full_sessions)
   - Access granted date
8. ☐ Verify "View Sessions" button present

**Expected Results:**
- ☐ Dashboard loads without errors
- ☐ Student appears in list
- ☐ All student data displayed correctly
- ☐ UI is responsive and styled correctly

**Screenshot:** Attach screenshot of coach dashboard

---

### Test 3.2: Filter Functionality

**Objective**: Coach can filter students by activity status

**Steps:**
1. ☐ On Coach Dashboard, click "Active" filter button
2. ☐ Verify only students with sessions in last 7 days shown
3. ☐ Verify filter button has "active" styling
4. ☐ Click "Inactive" filter button
5. ☐ Verify only students without recent sessions shown
6. ☐ Click "All" filter button
7. ☐ Verify all students shown again

**Expected Results:**
- ☐ Filtering works correctly
- ☐ Student count in filter button updates: "Active (2)"
- ☐ List updates instantly without page refresh
- ☐ No errors in console

**Note:** Test requires at least one active and one inactive student. If needed, create additional test account or wait 8 days for a student to become inactive.

---

### Test 3.3: Sort Functionality

**Objective**: Coach can sort students by different criteria

**Steps:**
1. ☐ On Coach Dashboard, open "Sort by" dropdown
2. ☐ Select "Last Session"
3. ☐ Verify students sorted with most recent session first
4. ☐ Select "Total Sessions"
5. ☐ Verify students sorted by highest session count first
6. ☐ Select "Name"
7. ☐ Verify students sorted alphabetically

**Expected Results:**
- ☐ Sorting works correctly for each option
- ☐ List updates instantly
- ☐ Sort order persists during filtering

---

### Test 3.4: Empty State (No Students)

**Objective**: Coach with no students sees helpful onboarding message

**Steps:**
1. ☐ Create new coach account with no students
2. ☐ Login as new coach
3. ☐ Navigate to `/coach/dashboard`

**Expected Results:**
- ☐ Empty state message displayed:
  - Icon: 🎓
  - Heading: "No Students Yet"
  - Message: "When players grant you coach access, they'll appear here."
  - Instruction: "Ask your students to visit their Contacts page and grant you access."
- ☐ Onboarding steps displayed:
  1. Share Your Profile
  2. Request Access
  3. Track Progress

**Screenshot:** Attach screenshot of empty state

---

## Test Section 4: Session Access Control

### Test 4.1: Coach Views Student Sessions (Authorized)

**Objective**: Coach with active grant can view student's sessions

**Steps:**
1. ☐ Login as Coach
2. ☐ Navigate to `/coach/dashboard`
3. ☐ Find Student 1 in list
4. ☐ Click "View Sessions" button
5. ☐ Verify navigation to `/player/[student1_id]/sessions`
6. ☐ Verify sessions load successfully
7. ☐ Verify session data displayed (if student has sessions)
8. ☐ Check browser console for errors (should be none)

**Expected Results:**
- ☐ Sessions page loads without errors
- ☐ Student's sessions are visible
- ☐ Page displays student name in header
- ☐ No 403 Forbidden or 401 Unauthorized errors

**Screenshot:** Attach screenshot of sessions page

---

### Test 4.2: Unauthorized User Denied Access

**Objective**: User without coach grant cannot view other user's sessions

**Steps:**
1. ☐ Logout (if logged in)
2. ☐ Login as "Unauthorized" test account
3. ☐ Manually navigate to `/player/[student1_id]/sessions`
4. ☐ Observe result

**Expected Results:**
- ☐ Access denied (403 Forbidden or 401 Unauthorized)
- ☐ Error message displayed: "Access denied" or "You do not have permission to view these sessions"
- ☐ User redirected to home page or shown error page
- ☐ No session data leaked

**Screenshot:** Attach screenshot of error message

---

### Test 4.3: User Views Own Sessions (Always Allowed)

**Objective**: Users can always view their own sessions

**Steps:**
1. ☐ Login as Student 1
2. ☐ Navigate to `/player/[student1_id]/sessions` (own ID)
3. ☐ Verify sessions load successfully
4. ☐ Verify "My Sessions" or similar heading displayed

**Expected Results:**
- ☐ Sessions load without errors
- ☐ Full access to own data
- ☐ No permission issues

---

### Test 4.4: Admin Views Any User's Sessions

**Objective**: Admin can view any user's sessions regardless of coach grants

**Steps:**
1. ☐ Login as Admin
2. ☐ Navigate to `/admin/users`
3. ☐ Search for Student 1
4. ☐ Click on Student 1 to view profile
5. ☐ Find and click "View Sessions" link (or navigate to `/player/[student1_id]/sessions`)
6. ☐ Verify sessions load successfully

**Expected Results:**
- ☐ Admin has access regardless of coach grants
- ☐ Sessions load without errors
- ☐ Access type is "admin" (if logged in response)

---

## Test Section 5: Revoking Coach Access

### Test 5.1: Student Revokes Coach Access

**Objective**: Student can revoke coach access at any time

**Steps:**
1. ☐ Login as Student 1
2. ☐ Navigate to `/contacts`
3. ☐ Find Coach in friends list
4. ☐ Verify checkbox currently checked: "☑ Grant Coach Access"
5. ☐ Click checkbox to uncheck
6. ☐ Verify checkbox becomes unchecked: "☐ Grant Coach Access"
7. ☐ Verify success notification: "Coach access revoked"
8. ☐ Refresh page
9. ☐ Verify checkbox still unchecked

**Expected Results:**
- ☐ Checkbox toggles off
- ☐ Success notification displayed
- ☐ State persists after refresh

**Database Verification:**
```sql
SELECT * FROM coach_access_grants
WHERE student_player_id = [student1_id] AND coach_player_id = [coach_id];
```

**Expected:**
- ☐ `status = 'revoked'`
- ☐ `revoked_at` is set (timestamp)
- ☐ `granted_at` still has original timestamp

**Screenshot:** Attach screenshot of unchecked checkbox

---

### Test 5.2: Coach Denied Access After Revoke

**Objective**: Coach can no longer view sessions after access is revoked

**Steps:**
1. ☐ Without logging out, navigate to `/coach/dashboard` (as Coach)
2. ☐ Verify Student 1 no longer appears in students list (or appears with "Access Revoked" status)
3. ☐ Manually navigate to `/player/[student1_id]/sessions`
4. ☐ Observe result

**Expected Results:**
- ☐ Access denied (403 Forbidden)
- ☐ Error message displayed
- ☐ Student removed from coach dashboard (or marked as revoked)
- ☐ Coach cannot bypass via direct URL

**Screenshot:** Attach screenshot of access denied error

---

### Test 5.3: Re-Grant Access After Revoke

**Objective**: Student can re-grant access after revoking

**Steps:**
1. ☐ Login as Student 1
2. ☐ Navigate to `/contacts`
3. ☐ Find Coach, checkbox should be unchecked
4. ☐ Click checkbox to re-enable coach access
5. ☐ Verify success notification
6. ☐ Login as Coach
7. ☐ Navigate to `/coach/dashboard`
8. ☐ Verify Student 1 reappears in students list
9. ☐ Click "View Sessions"
10. ☐ Verify sessions load successfully

**Expected Results:**
- ☐ Access can be re-granted
- ☐ Coach regains access
- ☐ New grant created in database (or existing grant reactivated)

**Database Verification:**
```sql
SELECT * FROM coach_access_grants
WHERE student_player_id = [student1_id] AND coach_player_id = [coach_id]
ORDER BY granted_at DESC
LIMIT 2;
```

**Expected:**
- ☐ Latest grant has `status = 'active'`
- ☐ Previous grant has `status = 'revoked'` (if new row created)
- ☐ OR: Single row with `status = 'active'`, `revoked_at = NULL` (if row updated)

---

## Test Section 6: Admin Features

### Test 6.1: Admin User Management Page

**Objective**: Admin can view and manage users with referral information

**Steps:**
1. ☐ Login as Admin
2. ☐ Navigate to `/admin/users`
3. ☐ Verify "Referred By" column appears in users table
4. ☐ Find Student 1 in list
5. ☐ Verify "Referred By" shows Coach's name
6. ☐ Click on Student 1 row
7. ☐ Verify navigation to `/admin/users/[student1_id]`

**Expected Results:**
- ☐ Admin users page loads
- ☐ "Referred By" column visible
- ☐ Referrer names displayed correctly
- ☐ Rows are clickable
- ☐ Search functionality works

**Screenshot:** Attach screenshot of admin users page

---

### Test 6.2: Admin Player Profile - Referral Chain

**Objective**: Admin can see full 5-level referral chain for any player

**Steps:**
1. ☐ On Admin Player Profile page for Student 2 (from Test 1.2)
2. ☐ Verify "Referral Chain" section displayed
3. ☐ Verify referrer cards show:
   - Level 1: Student 1 (with name, email, total referrals)
   - Level 2: Coach (with name, email, total referrals)
   - Levels 3-5: (empty or filled if chain exists)
4. ☐ Click on Level 1 referrer card (Student 1)
5. ☐ Verify navigation to Student 1's profile
6. ☐ Verify Student 1's referral chain now displayed
7. ☐ Click on Student 1's Level 1 referrer (Coach)
8. ☐ Verify navigation to Coach's profile

**Expected Results:**
- ☐ Full referral chain visible to admin
- ☐ Each level clickable for navigation
- ☐ Chain traversal works correctly
- ☐ Display names, emails, stats shown for each referrer

**Screenshot:** Attach screenshot of referral chain visualization

---

## Test Section 7: Edge Cases & Error Handling

### Test 7.1: Prevent Self-Granting Coach Access

**Objective**: User cannot grant coach access to themselves

**Steps:**
1. ☐ Login as Student 1
2. ☐ Open browser developer console (F12)
3. ☐ Execute API call to grant access to self:
   ```javascript
   fetch('/api/coach-access/grant', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       coach_player_id: [student1_id],  // Same as requester
       access_level: 'full_sessions'
     })
   }).then(r => r.json()).then(console.log)
   ```
4. ☐ Observe response

**Expected Results:**
- ☐ Request fails with 400 Bad Request
- ☐ Error message: "You cannot grant coach access to yourself"
- ☐ No grant created in database

---

### Test 7.2: Grant Access to Non-Friend

**Objective**: User can only grant coach access to existing friends

**Steps:**
1. ☐ Login as Student 1
2. ☐ Find player_id of a user who is NOT friends with Student 1 (e.g., "Unauthorized" test account)
3. ☐ Execute API call:
   ```javascript
   fetch('/api/contacts/toggle-coach-access', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       friend_id: [unauthorized_player_id],
       enable: true
     })
   }).then(r => r.json()).then(console.log)
   ```
4. ☐ Observe response

**Expected Results:**
- ☐ Request fails with 404 Not Found
- ☐ Error message: "Friendship not found. You must be friends to grant coach access."
- ☐ No grant created

---

### Test 7.3: Concurrent Toggle Operations

**Objective**: System handles rapid toggle operations gracefully

**Steps:**
1. ☐ Login as Student 1
2. ☐ Navigate to `/contacts`
3. ☐ Rapidly click coach access checkbox 10 times (on/off/on/off...)
4. ☐ Wait for all requests to complete
5. ☐ Refresh page
6. ☐ Observe final state

**Expected Results:**
- ☐ No errors displayed
- ☐ Final state is consistent (either on or off)
- ☐ No duplicate grants in database
- ☐ UI reflects actual database state

**Database Verification:**
```sql
SELECT COUNT(*) FROM coach_access_grants
WHERE student_player_id = [student1_id] AND coach_player_id = [coach_id];
```

**Expected:**
- ☐ Only 1 row (UNIQUE constraint prevents duplicates)

---

## Test Section 8: Performance & Responsiveness

### Test 8.1: Page Load Times

**Objective**: All pages load within acceptable time

**Steps:**
1. ☐ Clear browser cache
2. ☐ Open browser developer tools > Network tab
3. ☐ Navigate to `/contacts`
4. ☐ Record page load time: _______ ms
5. ☐ Navigate to `/coach/dashboard`
6. ☐ Record page load time: _______ ms
7. ☐ Navigate to `/admin/users/[player_id]`
8. ☐ Record page load time: _______ ms

**Acceptance Criteria:**
- ☐ All pages load in < 2 seconds
- ☐ No page takes > 3 seconds

---

### Test 8.2: Mobile Responsiveness

**Objective**: UI is fully functional on mobile devices

**Steps:**
1. ☐ Open browser developer tools
2. ☐ Toggle device emulation (mobile view)
3. ☐ Test Contacts page on mobile:
   - ☐ Friends list displays correctly
   - ☐ Coach access checkbox is tappable
   - ☐ "View Sessions" button tappable
4. ☐ Test Coach Dashboard on mobile:
   - ☐ Student cards display correctly
   - ☐ Filters are usable
   - ☐ Sort dropdown works
5. ☐ Test on actual mobile device (if available):
   - Device: _______________
   - OS: _______________
   - Browser: _______________

**Expected Results:**
- ☐ No horizontal scrolling required
- ☐ All buttons/links tappable
- ☐ Text readable without zooming
- ☐ Forms usable with on-screen keyboard

**Screenshot:** Attach screenshot of mobile view

---

## Test Section 9: Security Testing

### Test 9.1: JWT Token Validation

**Objective**: Endpoints require valid authentication

**Steps:**
1. ☐ Open browser developer console
2. ☐ Execute request without Authorization header:
   ```javascript
   fetch('/api/coach-access/students')
     .then(r => r.json())
     .then(console.log)
   ```
3. ☐ Observe response

**Expected Results:**
- ☐ Request fails with 401 Unauthorized
- ☐ Error message: "Authentication required"
- ☐ No data returned

---

### Test 9.2: SQL Injection Prevention

**Objective**: System prevents SQL injection attacks

**Steps:**
1. ☐ Login as Student 1
2. ☐ Execute malicious API call:
   ```javascript
   fetch('/api/coach-access/grant', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       coach_player_id: "1; DROP TABLE players;--",
       access_level: 'full_sessions'
     })
   }).then(r => r.json()).then(console.log)
   ```
3. ☐ Observe response

**Expected Results:**
- ☐ Request fails with 400 Bad Request
- ☐ Error: Invalid player_id format
- ☐ Database tables intact (not dropped!)

---

### Test 9.3: XSS Prevention

**Objective**: System prevents cross-site scripting attacks

**Steps:**
1. ☐ Login as Student 1
2. ☐ Grant coach access with XSS payload in notes:
   ```javascript
   fetch('/api/contacts/toggle-coach-access', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       friend_id: [coach_id],
       enable: true,
       notes: '<script>alert("XSS")</script>'
     })
   }).then(r => r.json()).then(console.log)
   ```
3. ☐ Login as Coach
4. ☐ Navigate to `/coach/dashboard`
5. ☐ View student card (if notes are displayed)

**Expected Results:**
- ☐ Script tag is NOT executed
- ☐ Notes displayed as plain text: `<script>alert("XSS")</script>`
- ☐ No alert popup appears

---

## Test Completion Summary

### Test Results

| Section | Total Tests | Passed | Failed | Notes |
|---------|-------------|--------|--------|-------|
| 1. Signup & Auto-Friendship | 2 | ___ | ___ | |
| 2. Granting Coach Access | 2 | ___ | ___ | |
| 3. Coach Dashboard | 4 | ___ | ___ | |
| 4. Session Access Control | 4 | ___ | ___ | |
| 5. Revoking Coach Access | 3 | ___ | ___ | |
| 6. Admin Features | 2 | ___ | ___ | |
| 7. Edge Cases | 3 | ___ | ___ | |
| 8. Performance | 2 | ___ | ___ | |
| 9. Security | 3 | ___ | ___ | |
| **TOTAL** | **25** | ___ | ___ | |

### Critical Issues Found

List any critical (P0) issues that must be resolved before production release:

1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

### High Priority Issues Found

List any high priority (P1) issues that should be resolved soon:

1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

### Sign-Off

**Tester Name**: _______________
**Date Completed**: _______________
**Testing Environment**: ☐ Dev  ☐ Staging  ☐ Production
**Overall Status**: ☐ Pass  ☐ Pass with Issues  ☐ Fail

**Recommendation**:
☐ Ready for production release
☐ Ready with minor fixes needed
☐ Not ready - critical issues must be resolved

**Additional Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

**End of Testing Checklist**
