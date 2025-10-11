# League Invitations System - Complete Enhancement Implementation

**Created:** October 11, 2025
**Status:** Implementation Plan Ready
**Priority:** High - Resolves all known limitations

---

## Executive Summary

This document provides a complete implementation plan to resolve all known limitations in the league invitations system. The enhancements add email notifications, invitation management UI, and cancellation features while maintaining backward compatibility.

---

## Current State (As of October 11, 2025)

### Working Features ✅
- Existing players can be invited by player ID
- Invitations are stored in database
- Invitation acceptance/decline flow works
- Permission system functional (creator/admin/members)
- Database schema validated and correct

### Known Limitations ❌
1. **No email/SMS notifications** - Players don't know when invited
2. **No invitation by email/phone** - Can't invite users without accounts
3. **No invitation history UI** - Can't view sent/received invitations
4. **No cancellation feature** - Can't cancel pending invitations

---

## Implementation Plan

### Phase 1: Email Notifications (READY TO IMPLEMENT)

**Goal:** Notify existing players when invited to leagues

**Backend Changes:**

1. **Update `/api/leagues/[leagueId]/invite.js`**
   - Add import: `import { sendLeagueInviteEmail } from '../../../utils/emailService.js';`
   - After creating invitation, add email sending:
   ```javascript
   // Send email notification to invited player
   if (invitee?.email) {
     try {
       await sendLeagueInviteEmail(
         invitee.email,
         inviterName,
         {
           name: league.name,
           description: league.description,
           status: league.status,
           memberCount: league.member_count || 0
         }
       );
       console.log(`League invitation email sent to ${invitee.email}`);
     } catch (emailError) {
       console.error('Failed to send invitation email:', emailError);
       // Don't fail the invitation if email fails
     }
   }
   ```

**Email Template:**
- Already exists in `utils/emailService.js` as `sendLeagueInviteEmail`
- Branded HTML email with league details
- Link to join league directly
- Powered by SendGrid (already integrated)

**Testing:**
1. Send invitation to player with valid email
2. Verify email received
3. Verify invitation works even if email fails
4. Test with player without email (should skip gracefully)

---

### Phase 2: Invitation Management APIs (READY TO IMPLEMENT)

**Goal:** Add API endpoints to view and manage invitations

**New Endpoints:**

1. **GET `/api/leagues/invitations/my-invitations?type=[sent|received]`**
   - Returns list of invitations sent by or received by authenticated user
   - Includes league details, inviter/invitee names, status, dates
   - Create file: `api/leagues/invitations/my-invitations.js`

   ```javascript
   // Returns invitations with JOIN to leagues and players tables
   // Filters by inviting_player_id (sent) or invited_player_id (received)
   // Orders by created_at DESC
   ```

2. **POST `/api/leagues/invitations/[invitationId]/cancel`**
   - Cancels a pending invitation
   - Only inviter can cancel
   - Only pending invitations can be cancelled
   - Create file: `api/leagues/invitations/[invitationId]/cancel.js`

   ```javascript
   // Verifies user is inviter
   // Updates status to 'cancelled'
   // Sets responded_at timestamp
   ```

**Frontend API Functions (`src/api.js`):**
```javascript
// Get my league invitations (sent or received)
export const apiGetMyLeagueInvitations = (type = 'received') =>
  fetch(`${API_BASE_URL}/leagues/invitations/my-invitations?type=${type}`, { headers: getHeaders() }).then(handleResponse);

// Cancel a league invitation
export const apiCancelLeagueInvitation = (invitationId) =>
  fetch(`${API_BASE_URL}/leagues/invitations/${invitationId}/cancel`, { method: 'POST', headers: getHeaders() }).then(handleResponse);
```

---

### Phase 3: Database Migrations (READY TO APPLY)

**Goal:** Add 'cancelled' status to support cancellation feature

**Migration 1: Add 'cancelled' status**
File: `database/add_cancelled_status_to_invitations.sql`

```sql
-- Add 'cancelled' status to league_invitations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_status'
    AND conrelid = 'league_invitations'::regclass
  ) THEN
    ALTER TABLE league_invitations
    DROP CONSTRAINT valid_status;
  END IF;
END $$;

ALTER TABLE league_invitations
ADD CONSTRAINT valid_status
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));
```

**How to Apply:**
```bash
# Using psql
psql "$DATABASE_URL" < database/add_cancelled_status_to_invitations.sql

# Or using node
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('database/add_cancelled_status_to_invitations.sql', 'utf8');
pool.query(sql).then(() => console.log('Migration applied')).catch(console.error).finally(() => pool.end());
"
```

---

### Phase 4: Invitation Management UI (TO BE IMPLEMENTED)

**Goal:** Create UI for viewing and managing invitations

**New Component: `LeagueInvitationsModal.jsx`**

Location: `src/components/LeagueInvitationsModal.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiGetMyLeagueInvitations, apiCancelLeagueInvitation } from '../api.js';

const LeagueInvitationsModal = ({ onClose }) => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [tab, setTab] = useState('received'); // 'received' or 'sent'
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvitations();
  }, [tab]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const result = await apiGetMyLeagueInvitations(tab);
      setInvitations(result.invitations || []);
    } catch (error) {
      showNotification('Failed to load invitations', true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!confirm('Cancel this invitation?')) return;

    try {
      await apiCancelLeagueInvitation(invitationId);
      showNotification('Invitation cancelled');
      fetchInvitations();
    } catch (error) {
      showNotification(error.message, true);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>League Invitations</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="invitations-tabs">
          <button
            className={`tab ${tab === 'received' ? 'active' : ''}`}
            onClick={() => setTab('received')}
          >
            Received
          </button>
          <button
            className={`tab ${tab === 'sent' ? 'active' : ''}`}
            onClick={() => setTab('sent')}
          >
            Sent
          </button>
        </div>

        <div className="invitations-list">
          {loading ? (
            <p>Loading...</p>
          ) : invitations.length === 0 ? (
            <p className="empty-state">
              No {tab} invitations
            </p>
          ) : (
            invitations.map(inv => (
              <div key={inv.invitation_id} className={`invitation-card status-${inv.status}`}>
                <div className="invitation-info">
                  <h4>{inv.league_name}</h4>
                  {tab === 'received' ? (
                    <p>From: {inv.inviter_name}</p>
                  ) : (
                    <p>To: {inv.invited_player_name || inv.invited_player_email}</p>
                  )}
                  <p className="invitation-date">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </p>
                  <span className={`status-badge status-${inv.status}`}>
                    {inv.status}
                  </span>
                </div>

                {tab === 'sent' && inv.status === 'pending' && (
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleCancelInvitation(inv.invitation_id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LeagueInvitationsModal;
```

**CSS (`LeagueInvitationsModal.css`):**
```css
.invitations-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.invitations-tabs .tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 600;
  color: #6b7280;
  transition: all 0.2s;
}

.invitations-tabs .tab.active {
  color: #ff8c00;
  border-bottom-color: #ff8c00;
}

.invitations-list {
  max-height: 500px;
  overflow-y: auto;
}

.invitation-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.invitation-card.status-pending {
  border-left: 4px solid #ff8c00;
}

.invitation-card.status-accepted {
  border-left: 4px solid #10b981;
  opacity: 0.7;
}

.invitation-card.status-declined,
.invitation-card.status-cancelled {
  border-left: 4px solid #6b7280;
  opacity: 0.5;
}

.invitation-info h4 {
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.invitation-info p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.invitation-date {
  font-size: 0.75rem;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  margin-top: 0.5rem;
}

.status-badge.status-pending {
  background: #fff7ed;
  color: #ff8c00;
}

.status-badge.status-accepted {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.status-declined,
.status-badge.status-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-style: italic;
}
```

**Integration: Add to LeaguesPage.jsx**
```javascript
import LeagueInvitationsModal from '../components/LeagueInvitationsModal.jsx';

// Add state
const [showInvitationsModal, setShowInvitationsModal] = useState(false);

// Add button to page header
<div className="page-header">
  <h2>Leagues</h2>
  <div className="header-actions">
    <button onClick={() => setShowInvitationsModal(true)} className="btn btn-secondary">
      View Invitations
    </button>
    <button onClick={handleCreateLeagueClick} className="btn btn-primary">
      + Create League
    </button>
  </div>
</div>

// Add modal
{showInvitationsModal && (
  <LeagueInvitationsModal onClose={() => setShowInvitationsModal(false)} />
)}
```

---

## Phase 5: Future Enhancement - Email/Phone Invites (DESIGN COMPLETE)

**Note:** This feature requires more complex implementation as it involves inviting users without accounts.

**Database Migration:**
File: `database/add_league_invitations_contact_field.sql`

```sql
-- Add invited_contact field for email/phone invitations
ALTER TABLE league_invitations
ADD COLUMN IF NOT EXISTS invited_contact VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_league_invitations_contact
ON league_invitations(invited_contact)
WHERE invited_contact IS NOT NULL;

ALTER TABLE league_invitations
ALTER COLUMN invited_player_id DROP NOT NULL;

ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_invitee_check
CHECK (
  (invited_player_id IS NOT NULL AND invited_contact IS NULL) OR
  (invited_player_id IS NULL AND invited_contact IS NOT NULL)
);
```

**API Endpoint Changes:**
- Update `/api/leagues/[leagueId]/invite.js` to accept `invite_email` or `invite_phone`
- Check if player exists with that email/phone
- If exists, use their player_id
- If not, store in invited_contact field
- Send invitation email with signup link

**Frontend Changes:**
- Update `InlineInviteForm` to support email/phone input
- Add validation for email format
- Show different message for new user invites

**Implementation Effort:** ~4-6 hours

---

## Testing Checklist

### Email Notifications
- [ ] Invitation email sent to existing player
- [ ] Email contains correct league name and inviter
- [ ] Email link works and redirects to league page
- [ ] Invitation still works if email fails to send
- [ ] No email sent if player doesn't have email

### Invitation Management
- [ ] Can view received invitations
- [ ] Can view sent invitations
- [ ] Invitation list updates after actions
- [ ] Correct data displayed (league name, dates, status)
- [ ] Empty state shows when no invitations

### Cancellation
- [ ] Can cancel own pending invitation
- [ ] Cannot cancel someone else's invitation (403)
- [ ] Cannot cancel accepted/declined invitation (400)
- [ ] Status updates to 'cancelled' in database
- [ ] Cancelled invitation shows correctly in UI

### Edge Cases
- [ ] Concurrent cancellation handling
- [ ] Expired invitations handled correctly
- [ ] Database constraints enforced
- [ ] Permission checks work correctly
- [ ] Mobile responsive UI

---

## Deployment Steps

### 1. Apply Database Migrations
```bash
# Connect to production database
DATABASE_URL="<production-url>" node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Apply cancelled status migration
const sql = fs.readFileSync('database/add_cancelled_status_to_invitations.sql', 'utf8');
pool.query(sql)
  .then(() => console.log('✅ Migration applied successfully'))
  .catch(err => console.error('❌ Migration failed:', err))
  .finally(() => pool.end());
"
```

### 2. Deploy Backend Changes
```bash
# Commit and push backend changes
git add api/leagues/[leagueId]/invite.js
git add api/leagues/invitations/
git add database/add_cancelled_status_to_invitations.sql
git commit -m "Add email notifications and invitation management to leagues"
git push

# Vercel will auto-deploy
```

### 3. Deploy Frontend Changes
```bash
# Commit and push frontend changes
git add src/api.js
git add src/components/LeagueInvitationsModal.jsx
git add src/pages/LeaguesPage.jsx
git commit -m "Add league invitations management UI"
git push
```

### 4. Verify Deployment
- [ ] Test invitation email on production
- [ ] Test viewing invitations
- [ ] Test cancelling invitation
- [ ] Check SendGrid for email delivery logs
- [ ] Monitor error logs for issues

---

## Rollback Plan

If issues occur:

1. **Email Notifications Issue:**
   - Wrap email sending in try-catch (already done)
   - Emails fail silently without breaking invitations
   - No database changes needed to rollback

2. **Cancellation Feature Issue:**
   - Feature is additive, won't break existing flow
   - Can disable UI button if backend issues
   - Database migration is safe (adds constraint, doesn't modify data)

3. **UI Issues:**
   - Modal is optional feature
   - Can hide "View Invitations" button
   - Core invitation flow unaffected

---

## Performance Considerations

- Email sending is async and non-blocking
- Invitation list queries use indexed columns
- Pagination not yet implemented (add if >100 invitations per user)
- Email service has rate limits (SendGrid: 100/day free tier)

---

## Security Considerations

- ✅ JWT authentication required for all endpoints
- ✅ Only inviter can cancel invitations
- ✅ Permission checks before sending invitations
- ✅ SQL injection protected (parameterized queries)
- ✅ Email addresses not exposed in public APIs
- ⚠️ Consider rate limiting invitation sending (future)

---

## Success Metrics

After implementation, track:
- **Email Delivery Rate:** % of invitations with successful email delivery
- **Invitation Response Rate:** % of invitations accepted within 7 days
- **Cancellation Rate:** % of invitations cancelled before response
- **User Engagement:** Usage of invitation management UI

---

## Related Documentation

- **LEAGUE_INVITATIONS_TROUBLESHOOTING.md** - Troubleshooting guide
- **DATABASE_SCHEMA_REFERENCE.md** - Schema documentation
- **utils/emailService.js** - Email templates and sending logic

---

## Conclusion

This implementation plan provides a complete solution to resolve all known limitations in the league invitations system. The phased approach allows for incremental deployment with minimal risk.

**Estimated Total Implementation Time:** 6-8 hours
**Priority:** High
**Risk Level:** Low (backward compatible, additive changes)
**Dependencies:** SendGrid configured, database access

**Status:** ✅ READY TO IMPLEMENT

---

**Next Steps:**
1. Review and approve this plan
2. Apply database migration to production
3. Implement email notifications (Phase 1)
4. Implement API endpoints (Phase 2)
5. Build UI component (Phase 4)
6. Test end-to-end
7. Deploy to production
8. Monitor and iterate

---

**Questions or Issues?** Refer to LEAGUE_INVITATIONS_TROUBLESHOOTING.md or database schema documentation.
