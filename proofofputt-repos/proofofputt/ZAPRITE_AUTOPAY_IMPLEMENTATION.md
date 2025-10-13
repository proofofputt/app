# Zaprite Auto-pay Implementation for Monthly Subscriptions

**Date:** October 12, 2025
**Status:** ✅ IMPLEMENTED - Ready for deployment

---

## Overview

This document describes the complete implementation of Zaprite's Auto-pay system for **monthly recurring subscriptions ($2.10/month)** using Square payment processing with saved payment methods.

## Key Differences from Original Recurring Invoice Approach

Zaprite does **NOT** have a native recurring invoice API. Instead, they use an **auto-pay system**:

1. **First Payment**: Customer pays via custom checkout and saves their payment method
2. **Subsequent Payments**: System creates new orders and auto-charges the saved payment profile
3. **Cron Job Required**: Monthly cron job generates orders and triggers charges

---

## System Architecture

### Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ FIRST PAYMENT (Month 1)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. User clicks "Subscribe Monthly" → Create Order            │
│    ├─ POST /api/subscriptions/create-zaprite-order          │
│    ├─ customCheckoutId: cmgoepfh00001kv04t7a0mvdk           │
│    └─ Returns checkoutUrl                                    │
│                                                               │
│ 2. User redirected to Zaprite Checkout                       │
│    ├─ Enters Square payment details                          │
│    ├─ Opts in to save payment method                         │
│    └─ Completes payment                                      │
│                                                               │
│ 3. Zaprite Webhook: order.paid                               │
│    ├─ Contains paymentProfileId (saved card)                 │
│    ├─ Updates player: subscription active                    │
│    ├─ Stores zaprite_payment_profile_id                      │
│    └─ Sets subscription_current_period_end = +30 days        │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RECURRING PAYMENTS (Month 2+)                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Cron Job runs daily at 9:00 AM                            │
│    ├─ Finds subscribers expiring within 3 days               │
│    └─ For each subscriber:                                   │
│                                                               │
│ 2. Create new order via API                                  │
│    ├─ POST /v1/order                                         │
│    ├─ amount: $2.10                                          │
│    └─ customCheckoutId: cmgoepfh00001kv04t7a0mvdk           │
│                                                               │
│ 3. Auto-charge saved payment profile                         │
│    ├─ POST /v1/order/{orderId}/charge                        │
│    ├─ paymentProfileId: (from database)                      │
│    └─ Charge happens automatically                           │
│                                                               │
│ 4. Zaprite Webhook: order.paid or invoice.paid               │
│    ├─ Updates subscription_current_period_end = +30 days     │
│    └─ Subscription stays active                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Components

### 1. Custom Checkout Configuration

**Custom Checkout ID:** `cmgoepfh00001kv04t7a0mvdk`

This custom checkout is configured in Zaprite dashboard with:
- Square payment processor enabled
- Option to save payment method for future use
- Auto-pay consent checkbox

### 2. Zaprite Client Functions (`app/utils/zaprite-client.js`)

#### Updated Functions

**Create Order (with Custom Checkout):**
```javascript
createZapriteOrder(orderPayload, options)
// Now supports customCheckoutId parameter for auto-pay
```

**New Auto-charge Function:**
```javascript
createZapriteOrderCharge(chargePayload, options)
// POST /v1/order/{orderId}/charge
// Charges a saved payment profile
```

### 3. Subscription Order Endpoint

**File:** `app/api/subscriptions/create-zaprite-order.js`

**Key Changes:**
- Monthly subscriptions now use `createZapriteOrder` with `customCheckoutId`
- No longer uses recurring invoice endpoint
- Stores `usesCustomCheckout` flag in metadata

```javascript
if (interval === 'monthly') {
  const monthlyPayload = {
    ...basePayload,
    customCheckoutId: ZAPRITE_CUSTOM_CHECKOUT_ID
  };
  zapriteData = await createZapriteOrder(monthlyPayload);
}
```

### 4. Webhook Handler

**File:** `app/api/webhooks/zaprite.js`

**Enhanced to Capture Payment Profile:**

```javascript
// Extract payment profile ID from webhook
const paymentProfileId = eventData.paymentProfile?.id ||
                         eventData.payment_profile_id ||
                         eventData.paymentProfileId ||
                         null;

// Store in database
zaprite_payment_profile_id = paymentProfileId
```

**Events Handled:**
- `order.paid` - First payment and renewal payments
- `invoice.paid` - Alternative event name for charges
- `payment.failed` - Failed auto-charge attempts

### 5. Database Schema

**New Column in `players` table:**

```sql
zaprite_payment_profile_id VARCHAR(255) -- Saved Square payment method ID
```

**Migration File:** `database/add_zaprite_payment_profile_id.sql`

**To run migration:**
```bash
psql $DATABASE_URL -f database/add_zaprite_payment_profile_id.sql
```

### 6. Cron Job for Auto-charging

**File:** `app/api/cron/process-monthly-subscriptions.js`

**Schedule:** Daily at 9:00 AM UTC (`0 9 * * *`)

**Process:**
1. Query active monthly subscribers expiring within 3 days
2. For each subscriber:
   - Create new Zaprite order
   - Auto-charge saved payment profile
   - Log success/failure
3. If payment fails, mark subscription as `past_due`

**Configured in:** `app/vercel.json`

```json
{
  "path": "/api/cron/process-monthly-subscriptions",
  "schedule": "0 9 * * *"
}
```

---

## User Flow

### First Month (Initial Subscription)

```
1. User clicks "Subscribe Monthly" ($2.10/month)
   └─> Frontend calls POST /api/subscriptions/create-zaprite-order
       └─> Body: { interval: 'monthly' }

2. Backend creates Zaprite order with custom checkout
   └─> API: POST /v1/order
       └─> customCheckoutId: cmgoepfh00001kv04t7a0mvdk
           └─> Returns checkoutUrl

3. User redirected to Zaprite checkout
   └─> Enters Square payment details (credit/debit card)
       └─> Checks box to save payment method
           └─> Completes payment ($2.10)

4. Zaprite sends webhook: order.paid
   └─> Includes paymentProfileId
       └─> Webhook handler updates database:
           - is_subscribed = TRUE
           - subscription_current_period_end = NOW() + 30 days
           - subscription_status = 'active'
           - zaprite_payment_method = 'square'
           - zaprite_payment_profile_id = (saved card ID)

5. User gains immediate access to subscription features
```

### Subsequent Months (Auto-renewal)

```
Day 27 (3 days before expiry):
- Cron job identifies subscriber for renewal
- Creates new order: $2.10
- Auto-charges saved payment profile
- Webhook extends subscription by 30 days

Month 2, 3, 4... (Automatic):
- Cron continues processing renewals
- No user action required
- Subscription stays active as long as payments succeed
```

---

## Configuration

### Environment Variables Required

```bash
# Zaprite API Credentials
ZAPRITE_API_KEY=342ea623-1169-4633-9bd4-ba582be44d23
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
ZAPRITE_BASE_URL=https://api.zaprite.com
ZAPRITE_WEBHOOK_SECRET=4e74dbcb19f266ff31de24f6ec185ff3aa388c7a73e8a1f6f8bc38cd817cdf3c

# Frontend URL
FRONTEND_URL=https://app.proofofputt.com

# Cron Secret (for securing cron endpoint)
CRON_SECRET=<generate-random-secret>
```

### Zaprite Dashboard Configuration

1. **Custom Checkout Setup**
   - ID: `cmgoepfh00001kv04t7a0mvdk`
   - Payment Processor: Square
   - Enable: "Save payment method for future use"
   - Enable: "Auto-pay consent"

2. **Webhook Configuration**
   - URL: `https://app.proofofputt.com/api/webhooks/zaprite`
   - Events to enable:
     - ✅ `order.paid`
     - ✅ `invoice.paid`
     - ✅ `payment.failed`
     - ✅ `subscription.canceled`
   - Webhook Secret: Copy to `.env` as `ZAPRITE_WEBHOOK_SECRET`

3. **Square Integration**
   - Connect Square account in Zaprite dashboard
   - Enable recurring payments feature
   - Verify payment method storage is enabled

---

## Testing Checklist

### 1. Initial Subscription Test

```bash
# Test monthly subscription creation
curl -X POST https://app.proofofputt.com/api/subscriptions/create-zaprite-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"interval": "monthly"}'
```

**Expected Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://zaprite.com/checkout/...",
  "orderId": "order_abc123",
  "interval": "monthly",
  "amount": 2.10,
  "isRecurring": true,
  "playerId": 123
}
```

### 2. Payment Flow Test

- [ ] Click "Subscribe Monthly" in settings
- [ ] Redirected to Zaprite checkout
- [ ] Enter test Square card: `4242 4242 4242 4242`
- [ ] Check "Save payment method" checkbox
- [ ] Complete payment
- [ ] Verify webhook received
- [ ] Check database: `zaprite_payment_profile_id` is populated

### 3. Database Verification

```sql
-- Check subscription activated and payment profile saved
SELECT
  player_id,
  is_subscribed,
  subscription_status,
  subscription_current_period_end,
  zaprite_payment_method,
  zaprite_payment_profile_id
FROM players
WHERE player_id = YOUR_PLAYER_ID;
```

**Expected:**
- `is_subscribed` = TRUE
- `subscription_status` = 'active'
- `zaprite_payment_method` = 'square'
- `zaprite_payment_profile_id` = (not null)
- `subscription_current_period_end` = ~30 days from now

### 4. Cron Job Test

```bash
# Manually trigger cron job (requires CRON_SECRET)
curl -X POST https://app.proofofputt.com/api/cron/process-monthly-subscriptions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Monthly subscription processing completed",
  "total": 5,
  "successful": 5,
  "failed": 0
}
```

### 5. Auto-charge Test

*Note: Cannot fully test without waiting 27-30 days*

**Alternative: Manual test**
1. Update a test subscriber's `subscription_current_period_end` to 2 days from now
2. Run cron job manually
3. Verify order created and charged
4. Check webhook processed and subscription extended

---

## Monitoring

### Active Subscriptions Query

```sql
SELECT
  player_id,
  email,
  subscription_status,
  subscription_current_period_end,
  zaprite_payment_profile_id,
  CASE
    WHEN subscription_current_period_end <= NOW() + INTERVAL '3 days' THEN 'DUE FOR RENEWAL'
    ELSE 'ACTIVE'
  END as renewal_status
FROM players
WHERE subscription_billing_cycle = 'monthly'
  AND is_subscribed = TRUE
  AND zaprite_payment_profile_id IS NOT NULL
ORDER BY subscription_current_period_end ASC;
```

### Recent Auto-charges

```sql
SELECT
  ze.event_id,
  ze.player_id,
  p.email,
  ze.event_type,
  ze.payment_amount,
  ze.received_at,
  ze.processed
FROM zaprite_events ze
JOIN players p ON ze.player_id = p.player_id
WHERE ze.event_type IN ('renewal.auto_charged', 'order.paid', 'invoice.paid')
ORDER BY ze.received_at DESC
LIMIT 20;
```

### Failed Payments

```sql
SELECT
  player_id,
  email,
  subscription_status,
  subscription_current_period_end
FROM players
WHERE subscription_status = 'past_due'
  AND subscription_billing_cycle = 'monthly'
ORDER BY subscription_current_period_end ASC;
```

### Monthly Recurring Revenue (MRR)

```sql
SELECT
  COUNT(*) as active_subscribers,
  COUNT(*) * 2.10 as mrr_usd
FROM players
WHERE subscription_billing_cycle = 'monthly'
  AND is_subscribed = TRUE
  AND subscription_status = 'active'
  AND zaprite_payment_profile_id IS NOT NULL;
```

---

## Troubleshooting

### Issue: Payment profile not captured in webhook

**Check:**
1. Custom checkout has "save payment method" enabled
2. User checked the box during checkout
3. Webhook extraction logic checks all possible field names
4. Event data logged in `zaprite_events` table

### Issue: Cron job not running

**Check:**
1. Vercel cron configuration deployed: `vercel.json`
2. Cron endpoint accessible: `/api/cron/process-monthly-subscriptions`
3. CRON_SECRET environment variable set
4. Check Vercel logs: `vercel logs --filter="cron"`

### Issue: Auto-charge failing

**Check:**
1. Payment profile ID is valid and not expired
2. Customer's card has not expired
3. Sufficient funds available
4. Square connection active in Zaprite
5. Check Zaprite dashboard for declined payments

### Issue: Subscribers not being charged

**Check:**
1. Query finds subscribers correctly (check SQL)
2. `subscription_current_period_end` dates are correct
3. `zaprite_payment_profile_id` is populated
4. Cron job execution logs show processing

---

## Security Considerations

### Webhook Signature Verification

Always verify webhook signatures in production:

```javascript
if (process.env.NODE_ENV === 'production') {
  const isValid = verifyZapriteSignature(req.body, signature, webhookSecret);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
}
```

### Cron Job Authentication

Protect cron endpoint with secret:

```javascript
const authHeader = req.headers.authorization;
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### PCI Compliance

- Never store raw card numbers
- Only store Zaprite's `paymentProfileId` (tokenized reference)
- All card processing happens on Zaprite/Square side
- Application never touches sensitive payment data

---

## Deployment Checklist

- [ ] Database migration applied (`add_zaprite_payment_profile_id.sql`)
- [ ] Environment variables configured in Vercel
- [ ] `CRON_SECRET` generated and set
- [ ] Webhook URL configured in Zaprite dashboard
- [ ] Custom checkout `cmgoepfh00001kv04t7a0mvdk` verified
- [ ] Cron job deployed via `vercel.json`
- [ ] Test subscription end-to-end in production
- [ ] Monitor first auto-charge cycle
- [ ] Set up alerts for failed payments

---

## Summary of Files Changed

### New Files
- `app/api/cron/process-monthly-subscriptions.js` - Cron job for auto-charging
- `database/add_zaprite_payment_profile_id.sql` - Database migration
- `ZAPRITE_AUTOPAY_IMPLEMENTATION.md` - This documentation

### Modified Files
- `app/utils/zaprite-client.js`
  - Added `createZapriteOrderCharge()` function
  - Updated `createZapriteOrder()` documentation

- `app/api/subscriptions/create-zaprite-order.js`
  - Added `ZAPRITE_CUSTOM_CHECKOUT_ID` constant
  - Updated monthly subscription to use custom checkout
  - Removed recurring invoice approach

- `app/api/webhooks/zaprite.js`
  - Added payment profile extraction in `handleOrderPaid()`
  - Added payment profile extraction in `handleInvoicePaid()`
  - Updated database queries to store `zaprite_payment_profile_id`

- `app/vercel.json`
  - Added cron job configuration for monthly subscription processing

---

**Document Status:** ✅ Implementation Complete
**Production Ready:** Yes (pending testing)
**Next Action:** Deploy to production and monitor first renewal cycle

---

**Last Updated:** October 12, 2025
**Author:** Development Team
**Maintained By:** Proof of Putt Development Team
