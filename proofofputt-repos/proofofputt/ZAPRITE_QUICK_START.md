# Zaprite Integration - Quick Start Guide

## Your Zaprite Organization

**Organization ID:** `cmgbcd9d80008l104g3tasx06`

This ID is already configured in the codebase.

## Setup Checklist

### 1. Get API Access ✓ (5 minutes)

1. Go to https://app.zaprite.com
2. Navigate to **Settings** → **API**
3. Click **"Request Access"** (if not already approved)
4. Once approved, click **"Generate API Key"**
5. Copy your API key

### 2. Configure Environment Variables (2 minutes)

Add to your production environment (Vercel):

```bash
ZAPRITE_API_KEY=<your_api_key_from_step_1>
ZAPRITE_WEBHOOK_SECRET=<get_this_after_webhook_setup>
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
```

### 3. Create Subscription Products in Zaprite (10 minutes)

Go to https://app.zaprite.com → **Products**

**Product 1: Basic ($4.99/month)**
- Name: "Proof of Putt - Basic"
- Price: $4.99 USD
- Billing: Monthly (create separate for Annual $49.99)
- Description: "Basic session tracking and statistics"
- Copy the **Product ID** → Add to `.env` as `ZAPRITE_PLAN_BASIC`

**Product 2: Premium ($9.99/month)**
- Name: "Proof of Putt - Premium"
- Price: $9.99 USD
- Billing: Monthly (create separate for Annual $99.99)
- Description: "Advanced analytics and competitive features"
- Copy the **Product ID** → Add to `.env` as `ZAPRITE_PLAN_PREMIUM`

**Product 3: Full Subscriber ($29.99/month)**
- Name: "Proof of Putt - Full Subscriber"
- Price: $29.99 USD
- Billing: Monthly (create separate for Annual $299.99)
- Description: "Complete access with all features"
- Copy the **Product ID** → Add to `.env` as `ZAPRITE_PLAN_FULL_SUBSCRIBER`

### 4. Set Up Webhook (5 minutes)

1. Go to **Settings** → **Webhooks** in Zaprite
2. Click **"Add Webhook"**
3. Webhook URL: `https://app.proofofputt.com/api/webhooks/zaprite`
4. Select events:
   - ☑️ `order.paid`
   - ☑️ `payment.succeeded`
   - ☑️ `subscription.created`
   - ☑️ `subscription.renewed`
   - ☑️ `subscription.canceled`
   - ☑️ `subscription.expired`
5. Copy the **Webhook Secret** → Add to `.env` as `ZAPRITE_WEBHOOK_SECRET`
6. Save webhook

### 5. Run Database Migration (2 minutes)

```bash
cd app
psql $DATABASE_URL < database/add_zaprite_subscriptions.sql
```

This creates:
- Zaprite tracking fields on `players` table
- `zaprite_events` table for webhook audit trail
- Helper functions for subscription management

### 6. Deploy to Production (5 minutes)

```bash
# Commit and push your code (already done in main repo)
git push

# Verify deployment in Vercel
# Check that environment variables are set
```

### 7. Test the Integration (10 minutes)

**Create Test Subscription:**

1. Log into your app as a test user
2. Go to `/subscribe` page
3. Click "Subscribe" on any plan
4. You'll be redirected to Zaprite checkout
5. Use Zaprite's test mode to complete payment
6. Check that webhook was received:
   ```sql
   SELECT * FROM zaprite_events ORDER BY received_at DESC LIMIT 5;
   ```
7. Verify subscription activated:
   ```sql
   SELECT player_id, subscription_status, subscription_tier, zaprite_payment_method
   FROM players WHERE subscription_status = 'active';
   ```

## API Endpoints Available

### Create Checkout
```bash
POST https://app.proofofputt.com/api/subscriptions/create-checkout
Headers: { "Authorization": "Bearer <jwt_token>" }
Body: {
  "tier": "premium",
  "billing_cycle": "monthly"
}

Response: {
  "success": true,
  "checkout_url": "https://zaprite.com/checkout/abc123",
  "session_id": "sess_xyz789"
}
```

### Webhook Handler
```bash
POST https://app.proofofputt.com/api/webhooks/zaprite
# Automatically called by Zaprite
# Processes: order.paid, subscription.created, renewed, canceled, expired
```

## Payment Methods Supported

✅ **Bitcoin (On-Chain)** - BTC network
✅ **Lightning Network** - Instant, low-fee
✅ **Credit/Debit Cards** - Visa, Mastercard (requires KYC)

Users can choose their preferred method at checkout.

## Testing Checklist

- [ ] Test Basic monthly subscription
- [ ] Test Premium monthly subscription
- [ ] Test Full Subscriber monthly subscription
- [ ] Test annual billing (if configured)
- [ ] Test Bitcoin payment
- [ ] Test Lightning payment
- [ ] Test card payment (if KYC complete)
- [ ] Test subscription cancellation
- [ ] Test subscription renewal
- [ ] Verify webhook events are logged
- [ ] Verify subscription status updates correctly

## Common Issues & Solutions

### Issue: "ZAPRITE_API_KEY not configured"
**Solution:** Add API key to production environment variables in Vercel

### Issue: Webhook not received
**Solution:**
1. Check webhook URL is correct in Zaprite
2. Verify webhook endpoint returns 200 OK: `curl -X POST https://app.proofofputt.com/api/webhooks/zaprite`
3. Check Zaprite webhook logs for errors

### Issue: "Invalid signature" error
**Solution:** Verify `ZAPRITE_WEBHOOK_SECRET` matches the secret from Zaprite dashboard

### Issue: Subscription not activating
**Solution:** Check `zaprite_events` table:
```sql
SELECT * FROM zaprite_events WHERE processed = FALSE;
```
Check `processing_error` column for details.

## Monitoring

**Daily checks:**
```sql
-- New subscriptions today
SELECT COUNT(*), subscription_tier
FROM players
WHERE DATE(subscription_started_at) = CURRENT_DATE
GROUP BY subscription_tier;

-- Failed webhooks
SELECT * FROM zaprite_events
WHERE processed = FALSE AND received_at > NOW() - INTERVAL '24 hours';

-- Active subscriptions by payment method
SELECT zaprite_payment_method, COUNT(*)
FROM players
WHERE subscription_status = 'active'
GROUP BY zaprite_payment_method;
```

## Support

- **Zaprite Help:** https://help.zaprite.com
- **Zaprite API Docs:** https://api.zaprite.com
- **Your Integration Docs:** See `ZAPRITE_SUBSCRIPTION_SETUP.md`

## Estimated Setup Time

- **If you have API access:** 30-45 minutes total
- **If waiting for API access:** 1-2 business days + 30 minutes setup

---

**Status:** Ready to implement
**Organization ID:** cmgbcd9d80008l104g3tasx06
**Next Step:** Request API access and generate API key
