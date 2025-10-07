# Gift Code Administration Guide

## Overview

This guide explains how to generate custom bundle subscription gift codes for partnerships, beta testing programs, and promotional campaigns. These codes allow you to distribute free subscriptions to specific individuals or organizations with custom identifiers.

## Prerequisites

1. Admin access to the database
2. `DATABASE_URL` environment variable set
3. Node.js installed

## Bundle Types

| Bundle ID | Name    | Quantity | Discount |
|-----------|---------|----------|----------|
| 1         | 3-Pack  | 3 codes  | 10%      |
| 2         | 5-Pack  | 5 codes  | 21%      |
| 3         | 10-Pack | 10 codes | 42%      |
| 4         | 21-Pack | 21 codes | 50%      |

## Method 1: Command Line Script (Recommended)

### Setup

1. First, run the database migration:
```bash
cd /Users/nw/proofofputt-repos/proofofputt/database
psql $DATABASE_URL -f add_custom_gift_code_labels.sql
```

2. Make the script executable:
```bash
chmod +x scripts/generate-gift-bundle.js
```

### Generate Gift Codes

```bash
# Basic usage
node scripts/generate-gift-bundle.js \
  --user-id=123 \
  --bundle-id=2 \
  --label="BETA-CLUBXYZ" \
  --reason="Partnership with Golf Club XYZ"

# Example: Beta testing program
node scripts/generate-gift-bundle.js \
  --user-id=456 \
  --bundle-id=3 \
  --label="BETA-TESTER-2025" \
  --reason="Beta testing program Q1 2025"

# Example: Golf club partnership
node scripts/generate-gift-bundle.js \
  --user-id=789 \
  --bundle-id=4 \
  --label="PARTNERSHIP-PEBBLEBEACH" \
  --reason="Partnership agreement with Pebble Beach Golf Club"
```

### Script Output

```
🎁 Generating Gift Bundle Codes
================================

👤 User: john_doe (ID: 123)
📧 Email: john@example.com
📦 Bundle: 5-Pack (5 subscriptions, 21% discount)
🏷️  Label: BETA-CLUBXYZ
📝 Reason: Partnership with Golf Club XYZ

⏳ Generating codes...

  ✓ BETA-CLUBXYZ-A3F2B1E4-001
  ✓ BETA-CLUBXYZ-B8D9C5F1-002
  ✓ BETA-CLUBXYZ-C4E7A2D8-003
  ✓ BETA-CLUBXYZ-D1F3B9E6-004
  ✓ BETA-CLUBXYZ-E5A8C2F7-005

✅ Success!

Generated 5 gift codes for john_doe

📋 Summary:
   Owner: john_doe (ID: 123)
   Bundle: 5-Pack
   Codes: 5
   Label: BETA-CLUBXYZ

💡 The user can now view these codes in their Settings page under "Free Year Invites"
   and send them to partners/beta testers.
```

## Method 2: API Endpoint

### Setup Admin Token

Set an admin token in your environment:
```bash
export ADMIN_TOKEN="your-secure-admin-token-here"
```

### API Request

```bash
curl -X POST https://app.proofofputt.com/api/admin/subscriptions/bundles/generate-gift-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "userId": 123,
    "bundleId": 2,
    "customLabel": "BETA-CLUBXYZ",
    "grantReason": "Partnership agreement with Golf Club XYZ",
    "adminId": 1
  }'
```

### API Response

```json
{
  "success": true,
  "message": "Successfully generated 5 gift codes",
  "data": {
    "userId": 123,
    "username": "john_doe",
    "bundleName": "5-Pack",
    "quantity": 5,
    "customLabel": "BETA-CLUBXYZ",
    "grantReason": "Partnership agreement with Golf Club XYZ",
    "generatedCodes": [
      "BETA-CLUBXYZ-A3F2B1E4-001",
      "BETA-CLUBXYZ-B8D9C5F1-002",
      "BETA-CLUBXYZ-C4E7A2D8-003",
      "BETA-CLUBXYZ-D1F3B9E6-004",
      "BETA-CLUBXYZ-E5A8C2F7-005"
    ]
  }
}
```

## How Recipients Use Gift Codes

1. **User receives the gift codes** from the owner (via email, SMS, etc.)
2. **Recipient goes to Settings page** at https://app.proofofputt.com/settings
3. **Finds "Have a Gift Code?" section** and enters the code
4. **Clicks "Redeem"** to activate their free 1-year subscription
5. **Account is upgraded** to Full Subscriber tier immediately

## Custom Label Best Practices

### Format
- Use UPPERCASE letters, numbers, and hyphens only
- Keep it descriptive and unique
- Maximum 255 characters

### Naming Conventions

```
BETA-[PROGRAM]-[YEAR]         e.g., BETA-CLUBXYZ-2025
PARTNERSHIP-[ORG]             e.g., PARTNERSHIP-PEBBLEBEACH
PROMO-[CAMPAIGN]              e.g., PROMO-LAUNCH-WEEK
SPONSOR-[NAME]                e.g., SPONSOR-TITLEIST
EVENT-[NAME]-[DATE]           e.g., EVENT-USOPEN-2025
INFLUENCER-[NAME]             e.g., INFLUENCER-TIGERWOODS
TEST-[PURPOSE]                e.g., TEST-CV-ALGORITHM
```

## Tracking and Analytics

### Check Existing Gift Codes

```sql
-- View all gift codes for a specific label
SELECT
  gift_code,
  is_redeemed,
  redeemed_by_user_id,
  redeemed_at,
  created_at
FROM user_gift_subscriptions
WHERE custom_label = 'BETA-CLUBXYZ'
ORDER BY created_at DESC;

-- Summary statistics for a label
SELECT
  custom_label,
  COUNT(*) as total_codes,
  SUM(CASE WHEN is_redeemed THEN 1 ELSE 0 END) as redeemed_count,
  SUM(CASE WHEN is_redeemed THEN 0 ELSE 1 END) as available_count
FROM user_gift_subscriptions
WHERE custom_label = 'BETA-CLUBXYZ'
GROUP BY custom_label;
```

### View All Partnerships

```sql
SELECT
  custom_label,
  grant_reason,
  COUNT(*) as total_codes,
  SUM(CASE WHEN is_redeemed THEN 1 ELSE 0 END) as redeemed,
  granted_at
FROM user_gift_subscriptions
WHERE custom_label IS NOT NULL
GROUP BY custom_label, grant_reason, granted_at
ORDER BY granted_at DESC;
```

## Common Use Cases

### 1. Beta Testing Program

**Scenario**: You want to give 10 beta testers free 1-year subscriptions.

**Solution**:
1. Find your user ID (or create a "Beta Program" user account)
2. Generate a 10-Pack bundle with label "BETA-Q1-2025"
3. Distribute individual codes to each tester
4. Track redemption rates in the Referrals Dashboard

```bash
node scripts/generate-gift-bundle.js \
  --user-id=YOUR_ID \
  --bundle-id=3 \
  --label="BETA-Q1-2025" \
  --reason="Beta testing program - Q1 2025 cohort"
```

### 2. Golf Club Partnership

**Scenario**: Partnership with Pebble Beach Golf Club for 21 member subscriptions.

**Solution**:
1. Create a dedicated "Pebble Beach Partnership" user account
2. Generate a 21-Pack bundle with custom label
3. Club administrator distributes codes to members

```bash
node scripts/generate-gift-bundle.js \
  --user-id=PEBBLEBEACH_USER_ID \
  --bundle-id=4 \
  --label="PARTNERSHIP-PEBBLEBEACH" \
  --reason="Annual partnership agreement 2025"
```

### 3. Influencer Campaign

**Scenario**: Give a golf influencer 5 codes to share with their audience.

**Solution**:
```bash
node scripts/generate-gift-bundle.js \
  --user-id=INFLUENCER_USER_ID \
  --bundle-id=2 \
  --label="INFLUENCER-RICKSHIELS" \
  --reason="Influencer partnership Q1 2025"
```

## Database Schema

The gift code system uses these tables:

```sql
-- Bundle definitions
subscription_bundles (
  id, name, quantity, discount_percentage, created_at
)

-- Individual gift codes
user_gift_subscriptions (
  id,
  owner_user_id,           -- Who owns/distributes these codes
  bundle_id,               -- Which bundle (3-pack, 5-pack, etc.)
  gift_code,               -- The actual code (e.g., BETA-CLUBXYZ-A3F2B1E4-001)
  custom_label,            -- Custom identifier (e.g., BETA-CLUBXYZ)
  granted_by_admin_id,     -- Admin who created it
  grant_reason,            -- Why it was created
  granted_at,              -- When admin created it
  is_redeemed,             -- Has it been used?
  redeemed_by_user_id,     -- Who redeemed it?
  redeemed_at,             -- When was it redeemed?
  created_at
)
```

## Security Notes

1. **Admin Token**: Keep `ADMIN_TOKEN` secure and never commit to git
2. **Database Access**: Only grant database write access to trusted admins
3. **Code Format**: Random component prevents guessing valid codes
4. **One-Time Use**: Each code can only be redeemed once
5. **Audit Trail**: All generations are logged with admin_id and reason

## Troubleshooting

### "User not found"
- Verify the user ID exists: `SELECT player_id, username FROM players WHERE player_id = 123;`
- Create the user account first if needed

### "Custom label already exists"
- Each label must be unique across all gift codes
- Add a suffix like `-V2` or `-2025` to make it unique
- Check existing labels: `SELECT DISTINCT custom_label FROM user_gift_subscriptions;`

### "Bundle not found"
- Verify bundle IDs: `SELECT id, name, quantity FROM subscription_bundles;`
- Run the bundle migration if needed: `database/add_subscription_gifting_tables.sql`

### Codes not showing in Settings page
- Verify the `owner_user_id` matches the logged-in user
- Check the API response in browser DevTools
- Ensure gift codes table exists and has data

## Support

For questions or issues:
1. Check the database directly using SQL queries above
2. Review API logs at `/api/subscriptions/gifts/`
3. Test with a small bundle (3-Pack) first
4. Verify environment variables are set correctly

## Future Enhancements

Potential improvements to consider:
- Web-based admin dashboard for gift code generation
- Bulk import from CSV for large partnerships
- Expiration dates for promotional codes
- Usage analytics and conversion tracking
- Email templates for code distribution
- QR codes for easy redemption at events
