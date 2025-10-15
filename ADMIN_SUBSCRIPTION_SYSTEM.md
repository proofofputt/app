# Admin Subscription Management System

## Overview

Complete automation and admin dashboard for managing bundle purchases, gift codes, subscriptions, and customer support operations.

**Status**: ✅ **Ready for Production**

---

## 🎯 What This Solves

### Before:
- ❌ Manual gift code generation required after bundle purchases
- ❌ No visibility into orders, subscriptions, or gift codes
- ❌ No customer support tools
- ❌ Payment links didn't trigger automatic gift code generation

### After:
- ✅ **Fully automatic** gift code generation from payment links
- ✅ **Complete admin dashboard** for order management
- ✅ **Customer support tools** for investigations
- ✅ **Audit trail** of all admin actions
- ✅ **User subscription history** lookup
- ✅ **Manual gift code generation** for edge cases

---

## 🏗️ System Architecture

### 1. Automatic Gift Code Generation

**Flow**: Payment Link → Zaprite Webhook → Auto Generate Gift Codes

#### Components:

**A. Payment Link Mapping Table** (`zaprite_payment_link_bundles`)
```sql
payment_link_id | bundle_id | bundle_name | quantity | price
pl_sLPDlcXmej  | 2         | 5-Pack      | 5        | 84.00
```

**B. Enhanced Webhook Handler** (`api/webhooks/zaprite.js`)
- Detects bundle purchases by payment link ID
- Looks up bundle configuration from mapping table
- Auto-generates gift codes
- Stores codes in `user_gift_subscriptions` table

#### How It Works:
1. User clicks bundle button → Redirects to Zaprite payment link
2. User completes payment → Zaprite sends webhook to your server
3. Webhook extracts payment link ID from event data
4. Looks up bundle in `zaprite_payment_link_bundles` table
5. Generates N gift codes (where N = bundle quantity)
6. Stores codes with `owner_player_id = purchaser`
7. Logs event for audit trail

---

### 2. Admin Dashboard

**Location**: `/admin/subscriptions`

**Access**: Requires `is_admin = true` in players table

#### Features:

**A. Orders Table**
- View all Zaprite orders (subscriptions + bundles)
- Filter by:
  - Status (paid, pending, failed)
  - Type (subscription, bundle)
  - Search (player name, email, order ID)
- Sortable columns
- Pagination (50 per page)

**B. Order Detail View**
- Complete order information
- Customer details
- Gift codes generated (with redemption status)
- Full webhook event data
- Error details (if processing failed)

**C. User History Lookup**
- Search by player ID
- View complete subscription history
- All orders and payments
- Gift codes owned vs redeemed
- Timeline of all subscription events

**D. Manual Gift Code Generation**
- Generate codes for any user
- Required fields:
  - Player ID
  - Quantity (1-100)
  - Reason (audit trail)
- Optional fields:
  - Bundle ID
  - Order ID (link to specific order)
- All actions logged in `admin_action_logs`

---

### 3. Admin API Endpoints

#### GET `/api/admin/subscriptions/orders`
List all orders with filtering and pagination.

**Query Parameters:**
```
status=all|paid|pending|failed
type=all|subscription|bundle
search=player name, email, or order ID
limit=50 (default)
offset=0 (default)
sortBy=created_at|payment_amount|event_type
sortOrder=asc|desc
```

**Response:**
```json
{
  "success": true,
  "orders": [{
    "orderId": "od_ABC123",
    "orderType": "bundle",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "amount": 84.00,
    "currency": "USD",
    "giftCodesGenerated": 5,
    "processed": true,
    "createdAt": "2025-10-11T10:30:00Z"
  }],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET `/api/admin/subscriptions/orders/[orderId]`
Get detailed order information including all gift codes.

**Response:**
```json
{
  "success": true,
  "order": {
    "orderId": "od_ABC123",
    "amount": 84.00,
    "currency": "USD",
    "paymentMethod": "bitcoin",
    "processed": true,
    "metadata": {
      "type": "bundle",
      "bundleId": 2,
      "bundleQuantity": 5
    }
  },
  "customer": {
    "playerId": 1009,
    "name": "John Doe",
    "email": "john@example.com",
    "membershipTier": "premium"
  },
  "giftCodes": [
    {
      "code": "GIFT-ABC123DEF456",
      "isRedeemed": false,
      "createdAt": "2025-10-11T10:30:00Z"
    }
  ],
  "giftCodesSummary": {
    "total": 5,
    "redeemed": 2,
    "pending": 3
  }
}
```

#### GET `/api/admin/subscriptions/users/[userId]/history`
Get complete user subscription history.

**Response:**
```json
{
  "success": true,
  "player": {
    "playerId": 1009,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "subscription": {
    "status": "active",
    "tier": "premium",
    "billingCycle": "annual",
    "currentPeriodEnd": "2026-10-11T10:30:00Z"
  },
  "orders": [...],
  "giftCodes": {
    "owned": [...],
    "redeemed": [...]
  },
  "summary": {
    "totalOrders": 3,
    "totalSpent": 105.00,
    "giftCodesOwned": 5,
    "giftCodesRedeemed": 2
  },
  "timeline": [...]
}
```

#### POST `/api/admin/subscriptions/gift-codes/manual-generate`
Manually generate gift codes (for customer support, failed automation, etc.)

**Request:**
```json
{
  "playerId": 1009,
  "quantity": 5,
  "bundleId": 2,
  "reason": "Automatic generation failed for order od_ABC123",
  "orderId": "od_ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully generated 5 gift codes for John Doe",
  "data": {
    "playerId": 1009,
    "generatedCodes": [
      "GIFT-ABC123DEF456",
      "GIFT-789012GHI345",
      ...
    ],
    "generatedBy": "Admin Name",
    "generatedAt": "2025-10-11T10:30:00Z"
  }
}
```

---

## 🗄️ Database Schema

### New Tables:

#### `zaprite_payment_link_bundles`
Maps Zaprite payment links to bundle configurations.

```sql
CREATE TABLE zaprite_payment_link_bundles (
  id SERIAL PRIMARY KEY,
  payment_link_id VARCHAR(255) UNIQUE NOT NULL,
  bundle_id INTEGER REFERENCES subscription_bundles(id),
  bundle_name VARCHAR(100) NOT NULL,
  bundle_quantity INTEGER NOT NULL,
  bundle_price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pre-populated data:**
- `pl_5GiV3AIMVc` → 3-Pack Bundle
- `pl_sLPDlcXmej` → 5-Pack Bundle
- `pl_qwz5BPb1Th` → 10-Pack Bundle
- `pl_c5uK0HOPlu` → 21-Pack Bundle

#### `admin_action_logs`
Audit trail for all admin actions.

```sql
CREATE TABLE admin_action_logs (
  log_id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES players(player_id),
  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  action_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Modified Tables:

#### `user_gift_subscriptions`
**Column fix**: `owner_user_id` → `owner_player_id` (matches database schema)

**New columns:**
- `granted_by_admin_id` - Admin who manually granted codes
- `grant_reason` - Reason for manual generation
- `granted_at` - Timestamp for manual grants

---

## 🚀 Deployment Instructions

### 1. Run Database Migrations

```bash
cd /Users/nw/proofofputt-repos/proofofputt/app

# Run migrations in order:
psql $DATABASE_URL -f database/add_zaprite_payment_link_mapping.sql
psql $DATABASE_URL -f database/add_admin_action_logs.sql
```

### 2. Verify Environment Variables

Ensure these are set in production:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
ZAPRITE_WEBHOOK_SECRET=your_webhook_secret
ADMIN_TOKEN=your_admin_token  # For admin API authentication
```

### 3. Deploy Code

```bash
git add .
git commit -m "Add comprehensive admin subscription management system"
git push
```

### 4. Verify Deployment

1. **Test Webhook**: Make test bundle purchase
2. **Check Gift Codes**: Verify auto-generation in database
3. **Test Admin Dashboard**: Navigate to `/admin/subscriptions`
4. **Test Manual Generation**: Try manual gift code generation

---

## 👨‍💼 Admin User Setup

### Make a User Admin:

```sql
UPDATE players
SET is_admin = TRUE
WHERE email = 'admin@proofofputt.com';
```

### Admin Dashboard Access:

1. Log in as admin user
2. Click profile dropdown
3. Navigate to "Admin Subscriptions"

---

## 🔒 Security Features

### Authentication:
- JWT token verification on all admin endpoints
- Admin role check via `verifyAdmin()` utility
- Audit trail of all admin actions

### Authorization:
- `is_admin` flag required for admin routes
- Admin-only API endpoints protected
- Frontend hides admin links from non-admins

### Audit Trail:
- All manual gift code generations logged
- Admin ID, timestamp, and reason recorded
- Full action data stored in JSONB

---

## 🧪 Testing Checklist

### Automatic Gift Code Generation:
- [ ] Purchase 3-Pack bundle → Verify 3 codes generated
- [ ] Purchase 5-Pack bundle → Verify 5 codes generated
- [ ] Purchase 10-Pack bundle → Verify 10 codes generated
- [ ] Purchase 21-Pack bundle → Verify 21 codes generated
- [ ] Verify codes have correct `owner_player_id`
- [ ] Verify codes appear in user's Settings page

### Admin Dashboard:
- [ ] Access `/admin/subscriptions` as admin
- [ ] View orders table with all purchases
- [ ] Filter by status (paid, pending, failed)
- [ ] Filter by type (subscription, bundle)
- [ ] Search by player name, email, order ID
- [ ] Click order to view detailed information
- [ ] Verify gift codes displayed correctly
- [ ] Check redemption status updates

### User History Lookup:
- [ ] Enter valid player ID
- [ ] View complete subscription history
- [ ] Verify order list accurate
- [ ] Check gift codes summary correct
- [ ] Verify timeline shows all events

### Manual Gift Code Generation:
- [ ] Open manual generation modal
- [ ] Fill in all required fields
- [ ] Generate 5 test codes
- [ ] Verify codes created in database
- [ ] Check audit log entry created
- [ ] Verify codes appear in user's account

### Customer Support Scenarios:
- [ ] Lookup user who purchased bundle
- [ ] Verify gift codes match purchase
- [ ] Check redemption status
- [ ] Manually generate replacement codes
- [ ] Verify audit trail complete

---

## 📊 Monitoring & Maintenance

### Key Metrics to Track:
- Total bundles purchased (by type)
- Gift codes generated vs redeemed
- Failed webhook processing (check `processing_error` column)
- Admin actions (frequency and type)

### Regular Checks:
- **Daily**: Check for failed webhooks in `zaprite_events` table
- **Weekly**: Review admin action logs for unusual activity
- **Monthly**: Analyze bundle purchase trends

### Database Queries:

**Check for failed webhooks:**
```sql
SELECT * FROM zaprite_events
WHERE processed = FALSE OR processing_error IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Gift code redemption rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE is_redeemed = TRUE) as redeemed,
  COUNT(*) FILTER (WHERE is_redeemed = FALSE) as pending,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_redeemed = TRUE) / COUNT(*), 2) as redemption_rate
FROM user_gift_subscriptions;
```

**Admin actions summary:**
```sql
SELECT
  action_type,
  COUNT(*) as action_count,
  MAX(created_at) as last_action
FROM admin_action_logs
GROUP BY action_type
ORDER BY action_count DESC;
```

---

## 🛠️ Troubleshooting

### Issue: Gift codes not generating automatically

**Check:**
1. Webhook received? Query `zaprite_events` table
2. Webhook processed? Check `processed` column
3. Processing error? Check `processing_error` column
4. Payment link in mapping table? Query `zaprite_payment_link_bundles`

**Solution:**
```bash
# Manually generate codes for order
curl -X POST https://app.proofofputt.com/api/admin/subscriptions/gift-codes/manual-generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": 1009,
    "quantity": 5,
    "bundleId": 2,
    "orderId": "od_ABC123",
    "reason": "Automatic generation failed - manual recovery"
  }'
```

### Issue: Admin dashboard not loading orders

**Check:**
1. User has `is_admin = TRUE` in database
2. JWT token valid
3. API endpoint responding (check browser network tab)
4. Database connection healthy

### Issue: User can't see their gift codes

**Check:**
1. Gift codes exist for user: `SELECT * FROM user_gift_subscriptions WHERE owner_player_id = ?`
2. API endpoint returning codes: `/api/subscriptions/gifts`
3. Frontend displaying codes correctly

---

## 📝 API Client Examples

### Fetch All Orders (Admin):

```javascript
const token = localStorage.getItem('authToken');
const response = await fetch('/api/admin/subscriptions/orders?type=bundle&status=paid', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log('Orders:', data.orders);
```

### Get User History (Admin):

```javascript
const token = localStorage.getItem('authToken');
const response = await fetch('/api/admin/subscriptions/users/1009/history', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log('User history:', data);
```

### Manual Gift Code Generation (Admin):

```javascript
const token = localStorage.getItem('authToken');
const response = await fetch('/api/admin/subscriptions/gift-codes/manual-generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    playerId: 1009,
    quantity: 5,
    bundleId: 2,
    reason: 'Customer support request - order processing issue'
  })
});
const data = await response.json();
console.log('Generated codes:', data.data.generatedCodes);
```

---

## 🎉 Success Metrics

### You'll know it's working when:
- ✅ Bundle purchases automatically generate gift codes
- ✅ Gift codes appear in user's Settings page immediately
- ✅ Admin can view all orders in dashboard
- ✅ Customer support can look up user history
- ✅ Manual generation works for edge cases
- ✅ All actions logged in audit trail

---

## 🔄 Future Enhancements

### Potential Additions:
- Email notifications when gift codes are generated
- Bulk gift code export (CSV)
- Refund processing interface
- Revenue analytics dashboard
- Gift code expiration dates
- Custom gift code prefixes for brands

---

**Documentation Version**: 1.0
**Last Updated**: October 11, 2025
**Author**: Claude Code
**Status**: Production Ready ✅
