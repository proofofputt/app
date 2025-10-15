# HubSpot CRM Integration Setup Guide

Complete guide for setting up HubSpot CRM for remote call center operations with automatic database synchronization.

## Overview

This integration allows your remote call center team to:
- Access all 10,916+ golf clubs in HubSpot CRM
- Log calls, emails, and meetings
- Update club contact information
- Track outreach status and priorities
- Automatically sync approved changes back to your database

## Features

✅ **Automatic Updates**: Some fields (notes, last contact date) update instantly
✅ **Admin Approval Queue**: Critical fields require admin approval before updating database
✅ **Audit Logging**: All CRM sync events are logged
✅ **Bidirectional Sync**: Changes flow from HubSpot → Database (updates flow automatically via webhooks)
✅ **Activity Tracking**: Call logs and meetings are stored in your database

---

## Part 1: HubSpot Setup

### Step 1: Create HubSpot Private App

1. Log in to HubSpot
2. Go to **Settings** (⚙️) → **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Name it: `Proof of Putt CRM Integration`
5. Under **Scopes**, select:
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.schemas.companies.read`
   - `crm.schemas.companies.write`
6. Click **Create app**
7. **Copy the Access Token** - you'll need this for export

### Step 2: Create Custom Properties

Go to **Settings** → **Properties** → **Company Properties** and create these custom properties:

| Property Name | Internal Name | Field Type | Description |
|--------------|---------------|------------|-------------|
| Club ID | `club_id` | Single-line text | Database club_id |
| Latitude | `latitude` | Single-line text | GPS latitude |
| Longitude | `longitude` | Single-line text | GPS longitude |
| Outreach Status | `outreach_status` | Dropdown | not_contacted, contacted, interested, not_interested, representative_claimed |
| Outreach Priority | `outreach_priority` | Number | Priority 1-10 (higher = more important) |
| Primary Contact Name | `contact_name` | Single-line text | Main contact at club |
| Primary Contact Email | `contact_email` | Email | Main contact email |
| Primary Contact Phone | `contact_phone` | Phone | Main contact phone |
| Last Contact Notes | `notes` | Multi-line text | Notes from last contact |

### Step 3: Set Up Webhook

1. Go to **Settings** → **Integrations** → **Private Apps**
2. Click on your `Proof of Putt CRM Integration` app
3. Go to the **Webhooks** tab
4. Set **Target URL**: `https://app.proofofputt.com/api/webhooks/hubspot/contact-update`
5. Subscribe to these events:
   - `company.propertyChange`
6. Save the webhook

### Step 4: Configure Webhook Secret

1. In your app's webhook settings, copy the **Client Secret**
2. Add to your environment variables:
   ```bash
   HUBSPOT_CLIENT_SECRET=your_client_secret_here
   ```

---

## Part 2: Initial Data Export

Export all clubs from your database to HubSpot:

```bash
cd /Users/nw/proofofputt-repos/proofofputt/app

# Dry run first (test without sending data)
HUBSPOT_API_KEY=your_access_token node scripts/export-clubs-to-hubspot.js --dry-run

# Export first 100 clubs (test run)
HUBSPOT_API_KEY=your_access_token node scripts/export-clubs-to-hubspot.js --limit=100

# Full export (all 10,916+ clubs - takes ~2 hours due to rate limiting)
HUBSPOT_API_KEY=your_access_token node scripts/export-clubs-to-hubspot.js
```

**Rate Limiting**: HubSpot free tier allows 100 requests per 10 seconds. The script automatically handles this.

---

## Part 3: Admin Approval Queue

### Accessing the Approval Queue

1. Log in as admin
2. Navigate to: `/admin/club-updates`
3. Or add a link to your admin navigation

### Reviewing Updates

**Auto-Approved Fields** (no review needed):
- Last Contact Date
- Last Contact Notes
- Outreach Status
- Outreach Priority

**Requires Approval**:
- Club Name
- Phone
- Website
- Address fields
- Primary Contact information

### Approval Workflow

1. **Pending Updates** show in the queue
2. Click **Review** to see old vs new values
3. Add optional review notes
4. Click **Approve & Apply** to update database
5. Or click **Reject** to discard the change

---

## Part 4: Field Mapping

### HubSpot → Database Column Mapping

| HubSpot Property | Database Column | Auto-Approve? |
|-----------------|-----------------|---------------|
| Company | `name` | ❌ Requires approval |
| Phone | `phone` | ❌ Requires approval |
| Website | `website` | ❌ Requires approval |
| Contact Name | `primary_contact_name` | ❌ Requires approval |
| Contact Email | `primary_contact_email` | ❌ Requires approval |
| Contact Phone | `primary_contact_phone` | ❌ Requires approval |
| Address | `address_line1` | ❌ Requires approval |
| Address 2 | `address_line2` | ❌ Requires approval |
| City | `address_city` | ❌ Requires approval |
| State | `address_state` | ❌ Requires approval |
| Zip | `address_postcode` | ❌ Requires approval |
| Country | `address_country` | ❌ Requires approval |
| Last Contact | `last_contact_date` | ✅ Auto-updates |
| Notes | `last_contact_notes` | ✅ Auto-updates |
| Outreach Status | `outreach_status` | ✅ Auto-updates |
| Outreach Priority | `outreach_priority` | ✅ Auto-updates |

---

## Part 5: Using HubSpot for Call Center Operations

### For Call Center Agents

#### Finding Clubs to Contact

1. Go to **Companies** in HubSpot
2. Create a view: "Clubs to Contact"
   - Filter: `Outreach Status = not_contacted`
   - Sort by: `Outreach Priority` (highest first)

#### Logging a Call

1. Open the club company record
2. Click **Log activity** → **Call**
3. Fill in:
   - Call outcome (connected, voicemail, no answer)
   - Duration
   - Notes about the conversation
4. Update fields:
   - **Outreach Status** → `contacted` or `interested`
   - **Last Contact** → Today's date
   - **Notes** → Key takeaways
   - **Contact Name/Email/Phone** → If you got new contact info

#### After Each Contact

Update these fields as needed:
- **Outreach Status**:
  - `not_contacted` → Never reached
  - `contacted` → Successfully spoke with someone
  - `interested` → Interested in becoming a representative
  - `not_interested` → Not interested
  - `representative_claimed` → They submitted a claim request

### For Managers

#### Pipeline Views

Create custom views in HubSpot:

1. **High Priority Prospects**
   - Filter: Outreach Priority ≥ 7 AND Outreach Status = not_contacted

2. **Recently Contacted**
   - Filter: Last Contact Date in last 7 days

3. **Interested Clubs**
   - Filter: Outreach Status = interested

4. **Need Follow-up**
   - Filter: Last Contact Date between 30-60 days ago

---

## Part 6: Database Schema

### New Tables

#### `pending_club_updates`
Stores changes awaiting admin approval
```sql
- update_id (PK)
- club_id (FK to clubs)
- field_name
- old_value
- new_value
- source (hubspot, manual, api)
- status (pending, approved, rejected)
- created_at, reviewed_at
```

#### `crm_sync_log`
Audit log of all CRM sync events
```sql
- log_id (PK)
- sync_type
- club_id (FK to clubs)
- direction (inbound, outbound)
- source
- payload (JSONB)
- success, error_message
- created_at
```

#### `club_outreach_activities`
Detailed log of calls, emails, meetings
```sql
- activity_id (PK)
- club_id (FK to clubs)
- hubspot_engagement_id
- activity_type (call, email, meeting, note)
- subject, body, outcome
- duration_seconds
- activity_date
```

### New Columns on `clubs` Table

```sql
- hubspot_contact_id: HubSpot company ID
- primary_contact_name: Main contact person
- primary_contact_email: Contact email
- primary_contact_phone: Contact phone
- last_contact_date: Date of last outreach
- last_contact_notes: Notes from last contact
- outreach_status: Current outreach status
- assigned_to_user_id: Call center agent assigned
- outreach_priority: Priority level (1-10)
- last_synced_to_crm: Last push to HubSpot
- last_synced_from_crm: Last update from HubSpot
```

---

## Part 7: API Endpoints

### Webhook Endpoint
- **POST** `/api/webhooks/hubspot/contact-update`
- Receives property changes from HubSpot
- Auto-applies or creates pending updates

### Admin Endpoints
- **GET** `/api/admin/club-updates/pending` - List pending updates
- **POST** `/api/admin/club-updates/:id/approve` - Approve update
- **POST** `/api/admin/club-updates/:id/reject` - Reject update

---

## Part 8: Troubleshooting

### Webhook Not Firing

1. Check webhook URL is correct: `https://app.proofofputt.com/api/webhooks/hubspot/contact-update`
2. Verify webhook is subscribed to `company.propertyChange`
3. Check webhook secret matches `HUBSPOT_CLIENT_SECRET` env var
4. Look at HubSpot webhook delivery logs (Settings → Private Apps → your app → Webhooks → View logs)

### Changes Not Appearing in Database

1. Check `/admin/club-updates` for pending approvals
2. Check if field is in the `AUTO_APPROVE_FIELDS` list
3. Check `crm_sync_log` table for errors:
   ```sql
   SELECT * FROM crm_sync_log WHERE success = FALSE ORDER BY created_at DESC LIMIT 10;
   ```

### Export Script Errors

**Rate Limit Exceeded**: Script automatically pauses. If you see 429 errors, increase sleep duration in script.

**Authentication Error**: Verify `HUBSPOT_API_KEY` is correct and app has required scopes.

**Property Not Found**: Ensure all custom properties are created in HubSpot first (Step 2).

---

## Part 9: Best Practices

### For Call Center Agents
- ✅ Always update **Outreach Status** after each contact attempt
- ✅ Log all calls, even unsuccessful ones
- ✅ Capture contact details when possible
- ✅ Use **Notes** field for context (don't put sensitive info)

### For Administrators
- ✅ Review pending updates daily
- ✅ Reject obviously incorrect data
- ✅ Check `crm_sync_log` weekly for errors
- ✅ Monitor for duplicate entries in HubSpot

### Security
- ⚠️ Never commit `HUBSPOT_API_KEY` to git
- ⚠️ Rotate API keys quarterly
- ⚠️ Limit webhook secret access
- ⚠️ Review CRM permissions regularly

---

## Support

For issues with:
- **HubSpot integration**: Check HubSpot API status, webhook logs
- **Approval queue**: Check `/admin/club-updates` page and browser console
- **Database sync**: Check `crm_sync_log` table for errors
- **Export script**: Run with `--dry-run` first, check HubSpot API limits

---

## Quick Reference

### Environment Variables Needed
```bash
DATABASE_URL="postgresql://..."
HUBSPOT_API_KEY="pat-na1-..."  # For export script
HUBSPOT_CLIENT_SECRET="..."     # For webhook verification
```

### Important URLs
- Admin Approval Queue: `https://app.proofofputt.com/admin/club-updates`
- Webhook Endpoint: `https://app.proofofputt.com/api/webhooks/hubspot/contact-update`
- HubSpot Settings: `https://app.hubspot.com/settings`

### Common Commands
```bash
# Test export (dry run)
HUBSPOT_API_KEY=xxx node scripts/export-clubs-to-hubspot.js --dry-run

# Export 100 clubs
HUBSPOT_API_KEY=xxx node scripts/export-clubs-to-hubspot.js --limit=100

# Full export
HUBSPOT_API_KEY=xxx node scripts/export-clubs-to-hubspot.js

# Check sync log
psql $DATABASE_URL -c "SELECT * FROM crm_sync_log ORDER BY created_at DESC LIMIT 10;"
```
