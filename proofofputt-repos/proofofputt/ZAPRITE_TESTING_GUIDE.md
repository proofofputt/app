# Zaprite Subscription Testing & Setup Guide

## 🎯 Quick Start

### 1. Environment Setup

Your Zaprite Organization ID is already configured in `.env.example`:
```
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
```

You need to add these to your actual `.env` file:

```bash
# Zaprite Payment Processing
ZAPRITE_API_KEY=your_zaprite_api_key_here           # Get from Zaprite Dashboard
ZAPRITE_WEBHOOK_SECRET=your_webhook_secret_here     # Set in Zaprite webhook config
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06           # Your Org ID (already set)
ZAPRITE_BASE_URL=https://api.zaprite.com

# Plan IDs (create these in Zaprite first)
ZAPRITE_PLAN_BASIC=zaprite_plan_id_basic
ZAPRITE_PLAN_PREMIUM=zaprite_plan_id_premium
ZAPRITE_PLAN_FULL_SUBSCRIBER=zaprite_plan_id_full
```

### 2. Get Your Zaprite API Key

1. Log in to [Zaprite Dashboard](https://app.zaprite.com)
2. Navigate to **Settings** → **API Keys**
3. Click **Create New API Key**
4. Copy the key and add to your `.env` file as `ZAPRITE_API_KEY`

### 3. Create Subscription Plans in Zaprite

You need to create 3 subscription plans in Zaprite dashboard:

#### **Basic Tier** ($5/month)
- Name: "Proof of Putt - Basic"
- Price: $5/month (or BTC equivalent)
- Features:
  - Session recording
  - Basic statistics
  - OTS certification
- Copy the Plan ID → `ZAPRITE_PLAN_BASIC`

#### **Premium Tier** ($10/month)
- Name: "Proof of Putt - Premium"
- Price: $10/month
- Features:
  - Everything in Basic
  - Competitive leagues
  - Advanced analytics
- Copy the Plan ID → `ZAPRITE_PLAN_PREMIUM`

#### **Full Subscriber** ($15/month)
- Name: "Proof of Putt - Full Subscriber"
- Price: $15/month
- Features:
  - Everything in Premium
  - 1v1 duels
  - Priority support
- Copy the Plan ID → `ZAPRITE_PLAN_FULL_SUBSCRIBER`

### 4. Database Migration

Run the migration to add Zaprite tables:

```bash
psql $DATABASE_URL -f database/add_zaprite_subscriptions.sql
```

This creates:
- `zaprite_subscriptions` table
- `zaprite_payment_events` table
- Adds Zaprite fields to `players` table
- Creates indexes for performance

### 5. Deploy Webhook Endpoint

The webhook handler is at `api/webhooks/zaprite.js`. Deploy it to your server at:

```
https://app.proofofputt.com/api/webhooks/zaprite
```

### 6. Configure Webhook in Zaprite

1. Go to Zaprite Dashboard → **Settings** → **Webhooks**
2. Add new webhook URL: `https://app.proofofputt.com/api/webhooks/zaprite`
3. Generate a webhook secret
4. Add secret to `.env` as `ZAPRITE_WEBHOOK_SECRET`
5. Enable these events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.renewed`
   - `payment.succeeded`
   - `payment.failed`
   - `payment.refunded`

---

## 🧪 Testing Flow

### Test Case 1: Create Subscription Checkout

**Endpoint:** `POST /api/subscriptions/create-checkout`

**Request:**
```json
{
  "tier": "Basic",
  "interval": "monthly",
  "userId": "your-user-id-here"
}
```

**Expected Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://zaprite.com/checkout/xxx",
  "checkoutId": "checkout_xxx",
  "tier": "Basic",
  "interval": "monthly",
  "expiresAt": "2025-10-06T12:00:00Z"
}
```

**Test with curl:**
```bash
curl -X POST https://app.proofofputt.com/api/subscriptions/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "tier": "Basic",
    "interval": "monthly",
    "userId": "your-user-id"
  }'
```

### Test Case 2: Payment Success Webhook

When user completes payment in Zaprite, your webhook should receive:

**Event:** `payment.succeeded`

**Payload:**
```json
{
  "event": "payment.succeeded",
  "data": {
    "id": "pay_xxx",
    "customer_id": "cus_xxx",
    "subscription_id": "sub_xxx",
    "amount": 5.00,
    "currency": "USD",
    "payment_method": "lightning",
    "status": "completed"
  }
}
```

**Expected Database Updates:**
1. `players` table:
   - `subscription_tier` → "Basic"
   - `zaprite_customer_id` → "cus_xxx"
   - `zaprite_subscription_id` → "sub_xxx"
   - `subscription_started_at` → current timestamp
   - `subscription_status` → "active"

2. `zaprite_payment_events` table:
   - New row with payment details
   - `event_type` → "payment.succeeded"
   - `status` → "processed"

### Test Case 3: Subscription Renewal

**Event:** `subscription.renewed`

**Expected Behavior:**
- Subscription period extended by 30 days
- Player maintains current tier access
- New payment event recorded

### Test Case 4: Payment Failure

**Event:** `payment.failed`

**Expected Behavior:**
- Email sent to customer
- Grace period starts (7 days)
- Access maintained during grace period
- `subscription_status` → "past_due"

### Test Case 5: Subscription Cancellation

**Event:** `subscription.canceled`

**Expected Behavior:**
- Access maintained until period end
- No auto-renewal
- `subscription_status` → "canceled"
- Tier reverts to "Free" after period ends

---

## 🔍 Manual Testing Steps

### Step 1: Create Test User
```sql
INSERT INTO players (id, username, email, subscription_tier)
VALUES ('test-user-123', 'testuser', 'test@example.com', 'Free');
```

### Step 2: Generate Checkout Link
```bash
curl -X POST http://localhost:3000/api/subscriptions/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "Basic",
    "interval": "monthly",
    "userId": "test-user-123"
  }'
```

### Step 3: Complete Payment
1. Open the `checkoutUrl` from response
2. Choose payment method (Lightning/BTC/Card)
3. Complete the test payment

### Step 4: Verify Webhook Received
```sql
-- Check webhook was processed
SELECT * FROM zaprite_payment_events
WHERE player_id = 'test-user-123'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 5: Verify User Upgraded
```sql
-- Check user subscription status
SELECT
  username,
  subscription_tier,
  subscription_status,
  zaprite_subscription_id,
  subscription_started_at
FROM players
WHERE id = 'test-user-123';
```

---

## 🎨 Frontend Integration

Add subscription button to your app:

```javascript
// Example: Subscribe button click handler
async function handleSubscribe(tier) {
  const response = await fetch('/api/subscriptions/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      tier: tier,          // "Basic", "Premium", or "Full Subscriber"
      interval: "monthly", // or "annual"
      userId: currentUserId
    })
  });

  const { checkoutUrl } = await response.json();

  // Redirect to Zaprite checkout
  window.location.href = checkoutUrl;
}
```

After successful payment, Zaprite redirects back to:
```
https://app.proofofputt.com/subscription/success?session_id=xxx
```

You can create a success page at that route to confirm the subscription.

---

## 📊 Monitoring & Logs

### Check Webhook Processing
```sql
-- Recent webhook events
SELECT
  event_type,
  status,
  processed_at,
  player_id,
  error_message
FROM zaprite_payment_events
ORDER BY created_at DESC
LIMIT 20;
```

### Check Failed Webhooks
```sql
-- Failed webhook processing
SELECT * FROM zaprite_payment_events
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Check Active Subscriptions
```sql
-- All active subscriptions
SELECT
  p.username,
  p.email,
  p.subscription_tier,
  p.zaprite_payment_method,
  zs.status,
  zs.current_period_end,
  zs.cancel_at_period_end
FROM players p
JOIN zaprite_subscriptions zs ON p.id = zs.player_id
WHERE zs.status = 'active'
ORDER BY zs.created_at DESC;
```

---

## 🚨 Troubleshooting

### Problem: Webhook not receiving events

**Solution:**
1. Verify webhook URL is publicly accessible
2. Check Zaprite dashboard for webhook delivery logs
3. Verify `ZAPRITE_WEBHOOK_SECRET` matches
4. Check server logs for 401/500 errors

### Problem: Subscription not upgrading user

**Solution:**
```sql
-- Check if webhook was received
SELECT * FROM zaprite_payment_events WHERE player_id = 'user-id';

-- Check subscription record
SELECT * FROM zaprite_subscriptions WHERE player_id = 'user-id';

-- Manually upgrade if needed
UPDATE players
SET subscription_tier = 'Basic',
    subscription_status = 'active'
WHERE id = 'user-id';
```

### Problem: Payment succeeded but user still shows "Free"

**Possible causes:**
1. Webhook signature verification failed
2. Customer ID/Subscription ID mismatch
3. Database transaction rolled back

**Check webhook logs:**
```sql
SELECT
  event_type,
  raw_event,
  error_message,
  status
FROM zaprite_payment_events
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 🔐 Security Checklist

- [ ] `ZAPRITE_API_KEY` is kept secret (not in git)
- [ ] `ZAPRITE_WEBHOOK_SECRET` is kept secret
- [ ] Webhook signature verification is enabled
- [ ] HTTPS is enforced for webhook endpoint
- [ ] Rate limiting is configured on webhook endpoint
- [ ] Database credentials are secured
- [ ] JWT secret is strong and unique

---

## 📚 API Reference

### Create Checkout Session
```
POST /api/subscriptions/create-checkout
```

**Auth:** Required (JWT Bearer token)

**Body:**
```json
{
  "tier": "Basic" | "Premium" | "Full Subscriber",
  "interval": "monthly" | "annual",
  "userId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "string",
  "checkoutId": "string",
  "tier": "string",
  "interval": "string",
  "expiresAt": "ISO 8601 timestamp"
}
```

### Webhook Handler
```
POST /api/webhooks/zaprite
```

**Auth:** Webhook signature verification

**Headers:**
- `X-Zaprite-Signature`: HMAC signature

**Events Handled:**
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.renewed`
- `payment.succeeded`
- `payment.failed`
- `payment.refunded`

---

## 🎯 Next Steps

1. ✅ Get Zaprite API key
2. ✅ Create subscription plans in Zaprite dashboard
3. ✅ Update `.env` with all Zaprite credentials
4. ✅ Run database migration
5. ✅ Deploy webhook endpoint
6. ✅ Configure webhook in Zaprite
7. ✅ Test end-to-end subscription flow
8. ✅ Add subscription UI to frontend
9. ✅ Monitor webhook logs for 24 hours
10. ✅ Set up automated subscription monitoring

---

## 💡 Pro Tips

1. **Use Lightning for instant confirmations** - Lightning payments confirm in seconds vs minutes for on-chain
2. **Enable email notifications** - Zaprite can email customers on payment success/failure
3. **Set up grace periods** - Give customers 7 days to update payment before downgrading
4. **Test with small amounts first** - Use testnet or small amounts during initial testing
5. **Monitor webhook health** - Set up alerts if webhooks fail for >5 minutes
6. **Keep customer support ready** - Have process for manually handling subscription issues

---

## 📞 Support

- **Zaprite Docs:** https://zaprite.com/developers
- **Zaprite Support:** support@zaprite.com
- **Bitcoin/Lightning Questions:** https://bitcoin.design/guide/

---

**Status:** Ready for production testing with your Organization ID `cmgbcd9d80008l104g3tasx06`
