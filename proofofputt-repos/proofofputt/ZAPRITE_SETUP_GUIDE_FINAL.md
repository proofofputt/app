# Zaprite Subscription Setup - Final Configuration

## 🎯 Your Pricing Strategy

- **Monthly Subscription:** $2.10/month
- **Annual Subscription:** $21/year
- **Annual Bonus:** When someone buys annual, they get a **free 1-year gift code** to give to a friend

---

## ✅ Step-by-Step Setup

### 1. Create ONE Subscription Plan in Zaprite

1. Log in to [Zaprite Dashboard](https://app.zaprite.com)
2. Go to **Products** → **Create Product**
3. **Name:** "Proof of Putt Subscription"
4. **Type:** Subscription (recurring)
5. **Default Price:** $21 (we'll override this in code)
6. Save and **copy the Plan/Product ID**
7. Paste it into your `.env` file as `ZAPRITE_PLAN_ID`

> **Note:** You only need ONE plan. Our code dynamically sets the price to either $2.10 (monthly) or $21 (annual) when creating the checkout.

---

### 2. Configure Your Environment Variables

Your `.env` file is already configured with:

```bash
# Already set ✅
ZAPRITE_API_KEY=342ea623-1169-4633-9bd4-ba582be44d23
ZAPRITE_WEBHOOK_SECRET=4e74dbcb19f266ff31de24f6ec185ff3aa388c7a73e8a1f6f8bc38cd817cdf3c
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
ZAPRITE_BASE_URL=https://api.zaprite.com

# Still needed ⏳
ZAPRITE_PLAN_ID=<paste-your-plan-id-here>
```

Just add the Plan ID from step 1.

---

### 3. Database Setup

Run the migration to create the gift subscription tables (already exists):

```bash
psql $DATABASE_URL -f /Users/nw/proofofputt-repos/proofofputt/database/add_subscription_gifting_tables.sql
```

This creates:
- `subscription_bundles` - Predefined bundle packages
- `user_gift_subscriptions` - Tracks gift codes owned by users
- Updates `players` table with subscription fields

**Also run the Zaprite-specific schema:**

```bash
psql $DATABASE_URL -f /Users/nw/proofofputt-repos/proofofputt/database/add_zaprite_subscriptions.sql
```

This creates:
- `zaprite_payment_events` - Logs all webhook events
- `zaprite_subscriptions` - Tracks active subscriptions

---

### 4. Deploy API Endpoints

You have 3 new API endpoints to deploy:

#### A. Checkout Creation
**File:** `/api/subscriptions/create-zaprite-checkout.js`
**Route:** `POST /api/subscriptions/create-zaprite-checkout`
**Purpose:** Creates Zaprite checkout session (monthly or annual)

#### B. Webhook Handler
**File:** `/api/webhooks/zaprite-subscription.js`
**Route:** `POST /api/webhooks/zaprite-subscription`
**Purpose:** Handles payment events and auto-generates gift codes

#### C. Gift Redemption (Already exists)
**File:** `/api/subscriptions/gifts/redeem.js`
**Route:** `POST /api/subscriptions/gifts/redeem`
**Purpose:** Allows users to redeem gift codes

Deploy these to your production server.

---

### 5. Configure Zaprite Webhook

1. In Zaprite Dashboard → **Settings** → **Webhooks**
2. Click **Add Webhook**
3. **URL:** `https://app.proofofputt.com/api/webhooks/zaprite-subscription`
4. **Events:** Select these events:
   - ✅ `payment.succeeded`
   - ✅ `subscription.created`
   - ✅ `subscription.canceled`
   - ✅ `payment.failed`
5. Save the webhook

---

## 🧪 Testing Your Setup

### Test 1: Create Monthly Checkout

```bash
curl -X POST https://app.proofofputt.com/api/subscriptions/create-zaprite-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "interval": "monthly"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://zaprite.com/checkout/...",
  "interval": "monthly",
  "amount": 2.10,
  "currency": "USD",
  "includesGift": false
}
```

### Test 2: Create Annual Checkout (with gift)

```bash
curl -X POST https://app.proofofputt.com/api/subscriptions/create-zaprite-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "interval": "annual"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://zaprite.com/checkout/...",
  "interval": "annual",
  "amount": 21.00,
  "currency": "USD",
  "includesGift": true
}
```

### Test 3: Complete Payment & Verify Gift Code

1. Open the `checkoutUrl` from Test 2
2. Complete payment (use Lightning for instant confirmation)
3. Check if gift code was generated:

```sql
SELECT * FROM user_gift_subscriptions
WHERE owner_user_id = YOUR_USER_ID
AND is_redeemed = FALSE
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
id | owner_user_id | gift_code          | is_redeemed | created_at
---|---------------|--------------------|-------------|------------
1  | 123           | GIFT-A1B2C3D4E5F6  | false       | 2025-10-06
```

### Test 4: Redeem Gift Code

```bash
curl -X POST https://app.proofofputt.com/api/subscriptions/gifts/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer FRIEND_JWT_TOKEN" \
  -d '{
    "giftCode": "GIFT-A1B2C3D4E5F6"
  }'
```

**Expected Response:**
```json
{
  "message": "Subscription redeemed successfully"
}
```

**Verify friend's subscription:**
```sql
SELECT username, is_subscribed, subscription_expires_at
FROM players
WHERE id = FRIEND_USER_ID;
```

---

## 🎨 Frontend Integration Example

Add subscription buttons to your app:

```jsx
// components/SubscriptionOptions.jsx
import { useState } from 'react';

export default function SubscriptionOptions({ userId }) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (interval) => {
    setLoading(true);

    const response = await fetch('/api/subscriptions/create-zaprite-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ interval })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to Zaprite checkout
      window.location.href = data.checkoutUrl;
    } else {
      alert('Error creating checkout: ' + data.error);
      setLoading(false);
    }
  };

  return (
    <div className="subscription-options">
      <div className="plan monthly">
        <h3>Monthly Plan</h3>
        <p className="price">$2.10/month</p>
        <button
          onClick={() => handleSubscribe('monthly')}
          disabled={loading}
        >
          Subscribe Monthly
        </button>
      </div>

      <div className="plan annual featured">
        <span className="badge">Best Value</span>
        <h3>Annual Plan</h3>
        <p className="price">$21/year</p>
        <p className="bonus">🎁 Includes 1 free year to gift!</p>
        <button
          onClick={() => handleSubscribe('annual')}
          disabled={loading}
        >
          Subscribe Annually
        </button>
      </div>
    </div>
  );
}
```

---

## 📊 How It Works

### Monthly Subscription Flow
1. User clicks "Subscribe Monthly"
2. API creates Zaprite checkout for $2.10/month
3. User completes payment
4. Webhook receives `payment.succeeded`
5. User's `subscription_expires_at` set to +30 days
6. User gets access immediately

### Annual Subscription Flow
1. User clicks "Subscribe Annually"
2. API creates Zaprite checkout for $21/year with `metadata.includesGift = true`
3. User completes payment
4. Webhook receives `payment.succeeded`
5. User's `subscription_expires_at` set to +1 year
6. **Webhook auto-generates gift code** (e.g., `GIFT-A1B2C3D4E5F6`)
7. Gift code saved in `user_gift_subscriptions` table
8. User can view their gift code in "My Gifts" page
9. User shares code with a friend
10. Friend redeems code → gets 1 year free subscription

---

## 🔍 Monitoring & Admin

### Check Active Subscriptions
```sql
SELECT
  p.username,
  p.email,
  p.is_subscribed,
  p.subscription_expires_at,
  p.subscription_status
FROM players p
WHERE p.is_subscribed = TRUE
ORDER BY p.subscription_expires_at DESC;
```

### Check Gift Codes
```sql
SELECT
  p.username as owner,
  ugs.gift_code,
  ugs.is_redeemed,
  ugs.created_at,
  r.username as redeemed_by
FROM user_gift_subscriptions ugs
JOIN players p ON ugs.owner_user_id = p.id
LEFT JOIN players r ON ugs.redeemed_by_user_id = r.id
ORDER BY ugs.created_at DESC;
```

### Check Webhook Events
```sql
SELECT
  event_type,
  player_id,
  status,
  amount,
  processed_at,
  error_message
FROM zaprite_payment_events
ORDER BY processed_at DESC
LIMIT 20;
```

---

## 🚨 Troubleshooting

### Problem: Webhook not receiving events

**Check:**
1. Webhook URL is publicly accessible
2. Zaprite webhook is configured correctly
3. Check Zaprite webhook logs for delivery attempts

**Fix:**
```bash
# Test webhook endpoint
curl https://app.proofofputt.com/api/webhooks/zaprite-subscription
# Should return 405 Method Not Allowed (endpoint exists)
```

### Problem: Gift code not generated after annual purchase

**Check webhook logs:**
```sql
SELECT * FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded'
ORDER BY processed_at DESC
LIMIT 1;
```

**Verify metadata:**
```sql
SELECT raw_event::json->'metadata'->>'includesGift' as includes_gift
FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded'
ORDER BY processed_at DESC
LIMIT 1;
```

**Manual gift code generation:**
```sql
INSERT INTO user_gift_subscriptions (owner_user_id, gift_code)
VALUES (USER_ID, 'GIFT-MANUAL123');
```

### Problem: User can't redeem gift code

**Check if code exists:**
```sql
SELECT * FROM user_gift_subscriptions WHERE gift_code = 'GIFT-XXX';
```

**Check if already redeemed:**
```sql
SELECT is_redeemed, redeemed_by_user_id, redeemed_at
FROM user_gift_subscriptions
WHERE gift_code = 'GIFT-XXX';
```

---

## 📈 Analytics Queries

### Total Revenue
```sql
SELECT
  SUM(amount) as total_revenue,
  COUNT(*) as total_payments,
  AVG(amount) as avg_payment
FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded'
AND status = 'processed';
```

### Monthly vs Annual Split
```sql
SELECT
  CASE
    WHEN amount < 10 THEN 'Monthly'
    ELSE 'Annual'
  END as plan_type,
  COUNT(*) as count,
  SUM(amount) as revenue
FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded'
GROUP BY plan_type;
```

### Gift Code Redemption Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE is_redeemed = TRUE) as redeemed,
  COUNT(*) FILTER (WHERE is_redeemed = FALSE) as unredeemed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_redeemed = TRUE) / COUNT(*),
    2
  ) as redemption_rate_pct
FROM user_gift_subscriptions;
```

---

## ✅ Final Checklist

- [ ] Created ONE subscription plan in Zaprite
- [ ] Added Plan ID to `.env` as `ZAPRITE_PLAN_ID`
- [ ] Ran database migrations
- [ ] Deployed 3 API endpoints
- [ ] Configured webhook in Zaprite
- [ ] Tested monthly checkout
- [ ] Tested annual checkout
- [ ] Verified gift code auto-generation
- [ ] Tested gift code redemption
- [ ] Added subscription UI to frontend
- [ ] Monitoring webhooks for errors

---

## 🎉 You're Ready!

Your Zaprite subscription system is configured with:
- ✅ $2.10/month option
- ✅ $21/year option with automatic friend gift
- ✅ Existing batch subscription integration
- ✅ Gift code redemption system

**Organization ID:** `cmgbcd9d80008l104g3tasx06`

**Next steps:**
1. Create your Zaprite subscription plan
2. Add the Plan ID to `.env`
3. Deploy the APIs
4. Test with a real payment
5. Start marketing! 🚀
