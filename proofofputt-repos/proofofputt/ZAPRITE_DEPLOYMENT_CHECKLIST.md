# Zaprite Deployment Checklist

## 📋 Pre-Deployment (Do These First)

### 1. Zaprite Dashboard Setup
- [ ] Log in to [Zaprite Dashboard](https://app.zaprite.com)
- [ ] Verify Organization ID: `cmgbcd9d80008l104g3tasx06`
- [ ] Generate API key (Settings → API Keys)
- [ ] Save API key securely

### 2. Create Subscription Plans
- [ ] **Basic Tier** - $5/month
  - Name: "Proof of Putt - Basic"
  - Copy Plan ID → save as `ZAPRITE_PLAN_BASIC`

- [ ] **Premium Tier** - $10/month
  - Name: "Proof of Putt - Premium"
  - Copy Plan ID → save as `ZAPRITE_PLAN_PREMIUM`

- [ ] **Full Subscriber** - $15/month
  - Name: "Proof of Putt - Full Subscriber"
  - Copy Plan ID → save as `ZAPRITE_PLAN_FULL_SUBSCRIBER`

### 3. Environment Variables
Update your production `.env` file:

```bash
# Zaprite Configuration
ZAPRITE_API_KEY=<your-api-key>                          # From step 1
ZAPRITE_WEBHOOK_SECRET=<generate-this-next>            # Generate in step 5
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06              # Already set
ZAPRITE_BASE_URL=https://api.zaprite.com

# Plan IDs from step 2
ZAPRITE_PLAN_BASIC=<basic-plan-id>
ZAPRITE_PLAN_PREMIUM=<premium-plan-id>
ZAPRITE_PLAN_FULL_SUBSCRIBER=<full-plan-id>
```

---

## 🗄️ Database Deployment

### 4. Run Migration
```bash
# Connect to production database
psql $DATABASE_URL -f database/add_zaprite_subscriptions.sql

# Verify tables created
psql $DATABASE_URL -c "\dt zaprite*"
```

**Expected output:**
```
              List of relations
 Schema |         Name          | Type  | Owner
--------+-----------------------+-------+-------
 public | zaprite_payment_events| table | ...
 public | zaprite_subscriptions | table | ...
```

### 5. Verify Schema
```sql
-- Check players table updated
SELECT column_name FROM information_schema.columns
WHERE table_name = 'players'
  AND column_name LIKE 'zaprite%';
```

**Expected columns:**
- `zaprite_customer_id`
- `zaprite_subscription_id`
- `zaprite_payment_method`

---

## 🚀 API Deployment

### 6. Deploy API Endpoints

#### Deploy Checkout API
```bash
# Deploy to production
# (adjust based on your deployment method - Vercel/Railway/etc)
vercel deploy api/subscriptions/create-checkout.js --prod
```

**Verify endpoint:**
```bash
curl https://app.proofofputt.com/api/subscriptions/create-checkout
# Should return 401 Unauthorized (auth required)
```

#### Deploy Webhook Handler
```bash
# Deploy webhook handler
vercel deploy api/webhooks/zaprite.js --prod
```

**Verify endpoint is publicly accessible:**
```bash
curl https://app.proofofputt.com/api/webhooks/zaprite
# Should return 200 OK with "Webhook endpoint ready"
```

---

## 🔗 Webhook Configuration

### 7. Configure Webhook in Zaprite

1. Go to **Zaprite Dashboard** → **Settings** → **Webhooks**
2. Click **Add Webhook**
3. **URL:** `https://app.proofofputt.com/api/webhooks/zaprite`
4. Click **Generate Secret** → Copy webhook secret
5. Add secret to `.env` as `ZAPRITE_WEBHOOK_SECRET`
6. **Select Events:**
   - [x] `subscription.created`
   - [x] `subscription.updated`
   - [x] `subscription.canceled`
   - [x] `subscription.renewed`
   - [x] `payment.succeeded`
   - [x] `payment.failed`
   - [x] `payment.refunded`
7. Click **Save**
8. Click **Test Webhook** to verify

---

## ✅ Testing (CRITICAL - Don't Skip!)

### 8. End-to-End Test Flow

#### Create Test User
```sql
INSERT INTO players (id, username, email, subscription_tier)
VALUES ('test-prod-user', 'test_prod', 'your-email@domain.com', 'Free');
```

#### Test Checkout Creation
```bash
# Get a JWT token for test user
TOKEN="your-jwt-token-here"

# Create checkout session
curl -X POST https://app.proofofputt.com/api/subscriptions/create-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tier": "Basic",
    "interval": "monthly",
    "userId": "test-prod-user"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "checkoutUrl": "https://zaprite.com/checkout/...",
  "checkoutId": "checkout_...",
  "tier": "Basic",
  "interval": "monthly"
}
```

#### Complete Test Payment
1. Open the `checkoutUrl` in browser
2. Choose **Lightning** for instant test
3. Complete payment with test Lightning wallet
4. Wait for webhook (should be instant)

#### Verify Webhook Processed
```sql
-- Check webhook received
SELECT * FROM zaprite_payment_events
WHERE player_id = 'test-prod-user'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `event_type` = "payment.succeeded"
- `status` = "processed"
- `error_message` IS NULL

#### Verify User Upgraded
```sql
SELECT
  username,
  subscription_tier,
  subscription_status,
  zaprite_subscription_id
FROM players
WHERE id = 'test-prod-user';
```

**Expected:**
- `subscription_tier` = "Basic"
- `subscription_status` = "active"
- `zaprite_subscription_id` is NOT NULL

---

## 🎨 Frontend Integration

### 9. Add Subscription UI

Example React component:

```jsx
// components/SubscribeButton.jsx
import { useState } from 'react';

export default function SubscribeButton({ tier, userId }) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);

    const response = await fetch('/api/subscriptions/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        tier: tier,
        interval: 'monthly',
        userId: userId
      })
    });

    const { checkoutUrl } = await response.json();
    window.location.href = checkoutUrl;
  };

  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Processing...' : `Subscribe to ${tier}`}
    </button>
  );
}
```

### 10. Create Success Page

```jsx
// pages/subscription/success.jsx
export default function SubscriptionSuccess() {
  return (
    <div className="success-page">
      <h1>🎉 Subscription Activated!</h1>
      <p>Your payment was successful. You now have full access to your subscription benefits.</p>
      <a href="/dashboard">Go to Dashboard</a>
    </div>
  );
}
```

---

## 📊 Monitoring Setup

### 11. Set Up Monitoring

#### Create Monitoring Query
```sql
-- Save as zaprite_health_check.sql
-- Run daily to check subscription health

SELECT
  DATE(created_at) as date,
  event_type,
  status,
  COUNT(*) as count
FROM zaprite_payment_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type, status
ORDER BY date DESC, event_type;
```

#### Set Up Alerts
Create alerts for:
- [ ] Failed webhook processing (>5 in 1 hour)
- [ ] Payment failures (>10% failure rate)
- [ ] Subscription cancellations (>5 per day)

### 12. Log Monitoring
```bash
# Watch webhook processing in real-time
tail -f /var/log/zaprite-webhooks.log | grep "error"

# Or if using Vercel
vercel logs --follow --filter="zaprite"
```

---

## 🔒 Security Verification

### 13. Security Checklist
- [ ] `ZAPRITE_API_KEY` is in `.env` (NOT in git)
- [ ] `ZAPRITE_WEBHOOK_SECRET` is in `.env` (NOT in git)
- [ ] Webhook signature verification is enabled
- [ ] All API endpoints use HTTPS
- [ ] JWT authentication is required for checkout endpoint
- [ ] Database credentials are secured
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled on webhook endpoint

### 14. Test Security
```bash
# Try webhook without signature (should fail)
curl -X POST https://app.proofofputt.com/api/webhooks/zaprite \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
# Expected: 401 Unauthorized

# Try checkout without auth (should fail)
curl -X POST https://app.proofofputt.com/api/subscriptions/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"tier": "Basic"}'
# Expected: 401 Unauthorized
```

---

## 🚦 Go-Live Checklist

### Final Verification Before Launch
- [ ] All environment variables set
- [ ] Database migration complete
- [ ] API endpoints deployed and responding
- [ ] Webhook configured in Zaprite
- [ ] End-to-end test completed successfully
- [ ] Frontend UI deployed
- [ ] Monitoring/alerts configured
- [ ] Security tests passed
- [ ] Customer support process documented
- [ ] Rollback plan prepared

### Launch Steps
1. [ ] Enable subscription features in app
2. [ ] Monitor first 10 subscriptions closely
3. [ ] Check webhook processing every hour for first day
4. [ ] Verify no failed webhooks
5. [ ] Confirm all payments are processing correctly

---

## 🆘 Rollback Plan

If something goes wrong:

### Emergency Rollback
```sql
-- 1. Disable new subscriptions (set feature flag)
UPDATE system_settings SET allow_new_subscriptions = false;

-- 2. Preserve existing subscriptions
-- Don't drop tables or change existing data

-- 3. Manually process pending payments
SELECT * FROM zaprite_payment_events
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour';
```

### Common Issues & Fixes

**Webhook not working:**
```bash
# Check webhook logs in Zaprite dashboard
# Verify signature secret matches
# Ensure endpoint is publicly accessible
```

**Payments not upgrading users:**
```sql
-- Manually upgrade user
UPDATE players
SET subscription_tier = 'Basic',
    subscription_status = 'active',
    zaprite_subscription_id = 'sub_xxx'
WHERE id = 'user_id';
```

---

## 📞 Support Contacts

**Zaprite Support:**
- Email: support@zaprite.com
- Docs: https://zaprite.com/developers
- Status: https://status.zaprite.com

**Your Team:**
- Developer: [Your email]
- Database: [DBA email]
- DevOps: [DevOps email]

---

## ✅ Deployment Complete!

Once all items are checked:
1. Subscriptions are live ✅
2. Payments are processing ✅
3. Webhooks are working ✅
4. Monitoring is active ✅

**Organization ID:** `cmgbcd9d80008l104g3tasx06`

**Next:** Monitor for 48 hours, then scale up marketing! 🚀
