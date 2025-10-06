# Zaprite Subscription Payment Integration Guide

## Overview

This guide walks through setting up **Zaprite** for subscription payments in Proof of Putt, supporting Bitcoin (on-chain & Lightning), Lightning Network, and traditional card payments.

## What is Zaprite?

Zaprite is a Bitcoin-native payment processor that supports:
- ⚡ Lightning Network payments
- ₿ Bitcoin on-chain payments
- 💳 Traditional card payments (Visa/Mastercard)
- 🔄 Subscription billing
- 🔗 Payment links and invoices
- 📊 Merchant dashboard

**Why Zaprite for Proof of Putt?**
- Native Bitcoin support for golf crypto enthusiasts
- Lower fees than traditional processors
- Modern API with webhooks
- No chargebacks on Bitcoin payments

## Prerequisites

1. **Zaprite Account**
   - Sign up at https://app.zaprite.com
   - Complete KYC verification (if using card payments)
   - Current pricing: $25/month

2. **API Access**
   - Go to Settings → API in Zaprite dashboard
   - Click "Request Access"
   - Wait for approval (currently limited beta)

3. **Existing Setup**
   - PostgreSQL database with `players` table
   - Subscription tiers defined
   - Environment variables configured

## Step 1: Zaprite Account Setup

### 1.1 Create Account
```bash
# Visit https://app.zaprite.com
# Sign up with business email
# Complete profile setup
```

### 1.2 Configure Payment Methods

**Enable Bitcoin/Lightning:**
- Go to Settings → Payment Methods
- Connect your Lightning node (optional) or use Zaprite's custodial wallet
- Set up on-chain Bitcoin wallet
- Configure settlement preferences

**Enable Card Payments (Optional):**
- Complete KYC verification
- Add business details
- Connect bank account for settlements

### 1.3 Request API Access

1. Navigate to **Settings → API**
2. Click **"Request Access"**
3. Describe your use case: "Subscription billing for SaaS golf app"
4. Wait for approval email (usually 24-48 hours)

### 1.4 Generate API Key

Once approved:
1. Go to **Settings → API**
2. Click **"Generate API Key"**
3. Copy and securely store your API key
4. **⚠️ Never commit API keys to git!**

## Step 2: Environment Configuration

Add to `app/.env`:

```bash
# Zaprite Configuration
ZAPRITE_API_KEY=your_zaprite_api_key_here
ZAPRITE_WEBHOOK_SECRET=your_webhook_secret_here
ZAPRITE_BASE_URL=https://api.zaprite.com

# Zaprite Subscription Plans (create these in Zaprite dashboard first)
ZAPRITE_PLAN_BASIC=zaprite_plan_id_basic
ZAPRITE_PLAN_PREMIUM=zaprite_plan_id_premium
ZAPRITE_PLAN_FULL=zaprite_plan_id_full_subscriber
```

Add to `app/.env.example`:
```bash
# Zaprite Payment Processing
ZAPRITE_API_KEY=your_zaprite_api_key_here
ZAPRITE_WEBHOOK_SECRET=your_webhook_secret_here
ZAPRITE_BASE_URL=https://api.zaprite.com
ZAPRITE_PLAN_BASIC=zaprite_plan_id_basic
ZAPRITE_PLAN_PREMIUM=zaprite_plan_id_premium
ZAPRITE_PLAN_FULL=zaprite_plan_id_full_subscriber
```

## Step 3: Create Subscription Plans in Zaprite

### 3.1 Define Your Plans

Navigate to Zaprite Dashboard → Products/Services → Create:

**Plan 1: Basic**
- Name: "Proof of Putt - Basic"
- Price: $4.99/month or $49.99/year
- Description: "Basic session tracking and stats"
- Billing Cycle: Monthly or Annual

**Plan 2: Premium**
- Name: "Proof of Putt - Premium"
- Price: $9.99/month or $99.99/year
- Description: "Advanced analytics and competitive features"
- Billing Cycle: Monthly or Annual

**Plan 3: Full Subscriber**
- Name: "Proof of Putt - Full Subscriber"
- Price: $29.99/month or $299.99/year
- Description: "Complete access with all features"
- Billing Cycle: Monthly or Annual

### 3.2 Get Plan IDs

After creating plans:
1. Click on each plan
2. Copy the Plan ID (looks like `plan_abc123xyz`)
3. Add to your `.env` file

## Step 4: Database Schema Updates

### 4.1 Add Zaprite Fields to Players Table

```sql
-- Add Zaprite subscription tracking fields
ALTER TABLE players
ADD COLUMN IF NOT EXISTS zaprite_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_payment_method VARCHAR(50), -- 'bitcoin', 'lightning', 'card'
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_players_zaprite_customer ON players(zaprite_customer_id);
CREATE INDEX IF NOT EXISTS idx_players_zaprite_subscription ON players(zaprite_subscription_id);
```

### 4.2 Create Zaprite Events Table

```sql
-- Track all Zaprite webhook events for audit trail
CREATE TABLE IF NOT EXISTS zaprite_events (
    event_id BIGSERIAL PRIMARY KEY,

    -- Event identification
    zaprite_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'order.paid', 'subscription.created', etc.

    -- Related entities
    player_id INTEGER REFERENCES players(player_id),
    zaprite_customer_id VARCHAR(255),
    zaprite_subscription_id VARCHAR(255),
    zaprite_order_id VARCHAR(255),

    -- Event data
    event_data JSONB NOT NULL, -- Full webhook payload

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,

    -- Metadata
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zaprite_events_type ON zaprite_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_player ON zaprite_events(player_id);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_processed ON zaprite_events(processed);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_received ON zaprite_events(received_at DESC);
```

## Step 5: Implementation Architecture

### 5.1 Architecture Overview

```
User Flow:
1. User selects subscription plan on Proof of Putt
2. Frontend calls /api/subscriptions/create-checkout
3. Backend creates Zaprite payment link/order
4. User redirected to Zaprite checkout page
5. User pays via Bitcoin/Lightning/Card
6. Zaprite sends webhook to /api/webhooks/zaprite
7. Backend processes webhook, updates subscription
8. User redirected back to Proof of Putt with success

Webhook Events:
- order.paid → Activate subscription
- subscription.created → Log subscription start
- subscription.renewed → Extend subscription period
- subscription.canceled → Mark for cancellation
- subscription.expired → Deactivate subscription
```

### 5.2 Key Components to Build

**Backend API Endpoints:**
- `POST /api/subscriptions/create-checkout` - Create Zaprite payment link
- `POST /api/webhooks/zaprite` - Handle Zaprite webhooks
- `GET /api/subscriptions/status` - Check subscription status
- `POST /api/subscriptions/cancel` - Cancel subscription
- `POST /api/subscriptions/reactivate` - Reactivate subscription

**Frontend Components:**
- Subscription plan selection page
- Payment redirect handler
- Subscription management dashboard
- Payment method display

## Step 6: Webhook Configuration

### 6.1 Set Up Webhook Endpoint

In Zaprite Dashboard:
1. Go to **Settings → Webhooks**
2. Add webhook URL: `https://app.proofofputt.com/api/webhooks/zaprite`
3. Select events to receive:
   - ☑️ `order.paid`
   - ☑️ `subscription.created`
   - ☑️ `subscription.renewed`
   - ☑️ `subscription.canceled`
   - ☑️ `subscription.expired`
4. Copy the **Webhook Secret** and add to `.env`

### 6.2 Webhook Security

Zaprite signs webhooks with HMAC-SHA256. You must verify signatures:

```javascript
const crypto = require('crypto');

function verifyZapriteWebhook(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}
```

## Step 7: Subscription Pricing Matrix

### 7.1 Proof of Putt Subscription Tiers

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Basic** | $4.99 | $49.99 (2 months free) | Session tracking, basic stats |
| **Premium** | $9.99 | $99.99 (2 months free) | + Advanced analytics, duels |
| **Full Subscriber** | $29.99 | $299.99 (2 months free) | + All features, priority support |

### 7.2 Bitcoin/Sat Pricing (Optional)

If offering Bitcoin-only pricing, consider:
- Fixed sat amounts (e.g., 100,000 sats/month)
- Or USD equivalent converted at checkout

Zaprite handles conversion automatically.

## Step 8: Testing Strategy

### 8.1 Zaprite Test Mode

1. Use Zaprite test API keys (if available)
2. Use Bitcoin testnet for testing
3. Use low-value Lightning payments for testing

### 8.2 Test Scenarios

**Successful Flow:**
- ✅ User selects plan
- ✅ Zaprite checkout loads
- ✅ Payment completes
- ✅ Webhook received
- ✅ Subscription activated
- ✅ User gains access

**Edge Cases:**
- ⚠️ Webhook arrives before redirect (idempotency)
- ⚠️ Duplicate webhooks (deduplication)
- ⚠️ Partial payment (Lightning routing failure)
- ⚠️ Overpayment
- ⚠️ Underpayment

## Step 9: Migration Plan

### 9.1 Existing Subscriptions

If you have existing subscribers (from coupons, etc.):

```sql
-- Option 1: Migrate to Zaprite manually
-- Have users re-subscribe through Zaprite with special migration coupon

-- Option 2: Mark as "legacy" and grandfather
UPDATE players
SET subscription_tier = 'legacy_full_subscriber',
    subscription_status = 'active'
WHERE subscription_tier IS NOT NULL;
```

### 9.2 Coupon Codes in Zaprite

Create promotional codes in Zaprite:
1. Go to **Coupons** in dashboard
2. Create codes like `EARLY_BIRD`, `FRIEND50`, etc.
3. Set discount percentages or fixed amounts
4. Share with users

## Step 10: User Experience Flow

### 10.1 Subscription Purchase Flow

```
1. User visits app.proofofputt.com/subscribe
2. Sees three tiers with pricing
3. Clicks "Subscribe" on preferred tier
4. Frontend calls: POST /api/subscriptions/create-checkout
   Body: { tier: 'premium', billing_cycle: 'monthly' }
5. Backend returns: { checkout_url: 'https://zaprite.com/checkout/xyz' }
6. User redirected to Zaprite checkout
7. User pays with Bitcoin/Lightning/Card
8. Zaprite redirects to: app.proofofputt.com/subscription/success?session_id=xyz
9. Backend receives webhook, activates subscription
10. User sees success page with subscription details
```

### 10.2 Subscription Management

**Cancel Subscription:**
- User goes to Settings → Subscription
- Clicks "Cancel Subscription"
- Subscription continues until end of current period
- `subscription_cancel_at_period_end = true`

**Reactivate:**
- User can reactivate before period ends
- Removes cancellation flag

**Upgrade/Downgrade:**
- Create new checkout for higher/lower tier
- Prorate remaining balance (handled by Zaprite)

## Step 11: Monitoring & Analytics

### 11.1 Key Metrics to Track

```sql
-- Monthly Recurring Revenue (MRR)
SELECT
  subscription_tier,
  COUNT(*) as subscribers,
  SUM(CASE subscription_billing_cycle
    WHEN 'monthly' THEN 4.99
    WHEN 'annual' THEN 49.99/12
  END) as mrr
FROM players
WHERE subscription_status = 'active'
GROUP BY subscription_tier;

-- Churn Rate
SELECT
  DATE_TRUNC('month', subscription_canceled_at) as month,
  COUNT(*) as cancellations
FROM players
WHERE subscription_canceled_at IS NOT NULL
GROUP BY month
ORDER BY month DESC;

-- Payment Method Distribution
SELECT
  zaprite_payment_method,
  COUNT(*) as count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM players
WHERE subscription_status = 'active'
GROUP BY zaprite_payment_method;
```

### 11.2 Alerts to Set Up

- ⚠️ Webhook failures (retry mechanism)
- ⚠️ Subscription churn spikes
- ⚠️ Payment failures
- ✅ New subscriptions (celebrate!)

## Step 12: Compliance & Legal

### 12.1 Terms of Service

Update ToS to include:
- Subscription billing terms
- Refund policy (Bitcoin = no chargebacks!)
- Cancellation policy
- Auto-renewal disclosure

### 12.2 Bitcoin/Crypto Disclosure

Add disclaimer:
> "Bitcoin and Lightning Network payments are final and non-refundable.
> Exchange rates are locked at time of payment."

## Troubleshooting

### Webhook Not Received

1. **Check Zaprite dashboard** → Webhooks → Event Log
2. **Verify URL** is publicly accessible (not localhost)
3. **Check endpoint** returns 200 OK
4. **Verify webhook secret** matches `.env`

### Subscription Not Activating

1. **Check zaprite_events table** for received webhooks
2. **Check processing_error** column for errors
3. **Manually process webhook:**
   ```sql
   SELECT * FROM zaprite_events WHERE processed = false;
   ```
4. **Verify player_id mapping** is correct

### Payment Method Not Showing

1. **Check Zaprite dashboard** payment methods enabled
2. **For Lightning**: Verify node connection
3. **For cards**: Verify KYC complete

## Next Steps After Setup

1. ✅ Test all payment flows thoroughly
2. ✅ Set up monitoring and alerts
3. ✅ Update marketing site with pricing
4. ✅ Create onboarding emails for new subscribers
5. ✅ Build subscription management dashboard
6. ✅ Integrate with analytics (track conversion rates)
7. ✅ Set up customer support for payment issues

## Support & Resources

- **Zaprite Help Center**: https://help.zaprite.com
- **API Documentation**: https://api.zaprite.com
- **Support Email**: support@zaprite.com
- **Discord**: Check Zaprite website for community link

## Estimated Timeline

- **Account setup**: 1 hour
- **API access approval**: 24-48 hours
- **Backend implementation**: 8-16 hours
- **Frontend implementation**: 4-8 hours
- **Testing**: 4-8 hours
- **Deployment**: 2-4 hours

**Total**: 1-2 weeks for complete integration

---

**Version**: 1.0.0
**Last Updated**: October 2025
**Maintainer**: Proof of Putt Development Team
