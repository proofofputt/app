# Zaprite Order API Setup Guide

## 🎯 Important: Zaprite Uses Orders, Not Products

Zaprite doesn't have a "Products" section. Instead, you create **Orders** dynamically via API for each purchase.

**Your Pricing:**
- Monthly: $2.10/month
- Annual: $21/year (includes 1 free year gift code)

---

## ✅ Setup Steps

### Step 1: Get Your Zaprite API Key

1. Log in to [Zaprite Dashboard](https://app.zaprite.com)
2. Go to **Settings** → **API**
3. Click **Request API Access** (if in beta) or **Generate API Key**
4. Copy your API key
5. Already added to your `.env` ✅:
   ```bash
   ZAPRITE_API_KEY=342ea623-1169-4633-9bd4-ba582be44d23
   ```

### Step 2: Verify Your Organization ID

Your Organization ID is already configured ✅:
```bash
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
```

You can verify this in Zaprite Settings → Organization.

### Step 3: No Plan/Product Creation Needed!

**Unlike Stripe or other payment processors, Zaprite doesn't require pre-created products.**

You simply call `POST /v1/order` with the amount, and Zaprite generates a payment page on the fly.

---

## 📡 API Integration

### Order Creation Endpoint

**New File:** `/api/subscriptions/create-zaprite-order.js`

**How it works:**
```javascript
// User clicks "Subscribe Monthly"
// API creates order with Zaprite:

POST https://api.zaprite.com/v1/order
Headers:
  Authorization: Bearer {ZAPRITE_API_KEY}
  Content-Type: application/json

Body:
{
  "organizationId": "cmgbcd9d80008l104g3tasx06",
  "customerId": "user-123",
  "customerEmail": "user@example.com",
  "customerName": "John Doe",
  "amount": 2.10,           // or 21.00 for annual
  "currency": "USD",
  "description": "Proof of Putt Monthly Subscription",
  "metadata": {
    "userId": "123",
    "interval": "monthly",
    "includesGift": "false"  // true for annual
  },
  "successUrl": "https://app.proofofputt.com/subscription/success?session_id={ORDER_ID}",
  "cancelUrl": "https://app.proofofputt.com/settings?canceled=true"
}

Response:
{
  "id": "order_abc123",
  "checkoutUrl": "https://zaprite.com/checkout/xyz789",
  "amount": 2.10,
  "currency": "USD",
  "status": "pending"
}
```

---

## 🔔 Webhook Configuration

### Step 4: Set Up Webhook

1. Go to Zaprite → **Settings** → **Webhooks**
2. Click **Add Webhook**
3. **URL:** `https://app.proofofputt.com/api/webhooks/zaprite-subscription`
4. **Events to Subscribe:**
   - ✅ `order.paid` (or `payment.succeeded`)
   - ✅ `order.expired`
   - ✅ `order.cancelled`
5. Save webhook

Zaprite will send events like:
```json
{
  "event": "order.paid",
  "data": {
    "id": "order_abc123",
    "customerId": "user-123",
    "amount": 21.00,
    "currency": "USD",
    "metadata": {
      "userId": "123",
      "interval": "annual",
      "includesGift": "true"
    }
  }
}
```

---

## 🗄️ Database Setup

Run these migrations:

```bash
# Gift subscription tables (already exists)
psql $DATABASE_URL -f database/add_subscription_gifting_tables.sql

# Zaprite payment event tracking
psql $DATABASE_URL -f database/add_zaprite_subscriptions.sql
```

---

## 🧪 Testing

### Test Order Creation

```bash
curl -X POST https://app.proofofputt.com/api/subscriptions/create-zaprite-order \
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
  "checkoutUrl": "https://zaprite.com/checkout/xyz",
  "orderId": "order_abc123",
  "interval": "annual",
  "amount": 21.00,
  "currency": "USD",
  "includesGift": true
}
```

### Test Payment Flow

1. Open the `checkoutUrl` in a browser
2. You'll see a Zaprite-hosted payment page
3. Choose payment method:
   - ⚡ **Lightning** (instant, recommended for testing)
   - ₿ **Bitcoin** (on-chain, takes ~10-60 min)
   - 💳 **Card** (if enabled)
4. Complete payment
5. Check if webhook was received:

```sql
SELECT * FROM zaprite_payment_events
ORDER BY created_at DESC
LIMIT 1;
```

6. For annual purchases, verify gift code generated:

```sql
SELECT * FROM user_gift_subscriptions
WHERE owner_user_id = YOUR_USER_ID
AND is_redeemed = FALSE
ORDER BY created_at DESC
LIMIT 1;
```

---

## 🎨 Frontend Integration

```jsx
// components/SubscriptionPage.jsx
import { useState } from 'react';

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (interval) => {
    setLoading(true);

    try {
      const response = await fetch('/api/subscriptions/create-zaprite-order', {
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
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } catch (error) {
      alert('Error creating order: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="subscription-plans">
      <h1>Choose Your Plan</h1>

      <div className="plans-grid">
        {/* Monthly Plan */}
        <div className="plan-card">
          <h3>Monthly</h3>
          <div className="price">
            <span className="amount">$2.10</span>
            <span className="period">/month</span>
          </div>
          <ul className="features">
            <li>✅ Session recording</li>
            <li>✅ Leagues & competitions</li>
            <li>✅ 1v1 duels</li>
            <li>✅ OTS certification</li>
          </ul>
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={loading}
            className="subscribe-btn"
          >
            {loading ? 'Loading...' : 'Subscribe Monthly'}
          </button>
        </div>

        {/* Annual Plan */}
        <div className="plan-card featured">
          <div className="badge">Best Value</div>
          <h3>Annual</h3>
          <div className="price">
            <span className="amount">$21</span>
            <span className="period">/year</span>
          </div>
          <div className="savings">Save $4.20 vs monthly!</div>
          <ul className="features">
            <li>✅ Everything in Monthly</li>
            <li>🎁 <strong>1 Free Year Gift Code</strong></li>
            <li>✅ Share with a friend</li>
          </ul>
          <button
            onClick={() => handleSubscribe('annual')}
            disabled={loading}
            className="subscribe-btn primary"
          >
            {loading ? 'Loading...' : 'Subscribe Annually'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔄 How Subscriptions Work with Orders

### Recurring Payments

Zaprite's Order API creates **one-time payments** by default. For recurring subscriptions, you have two options:

#### Option 1: Manual Renewal (Simpler)

- User pays once for the period (month or year)
- 7 days before expiry, send email reminder to renew
- User clicks "Renew" → Creates new order

**Implementation:**
```javascript
// Cron job runs daily
const expiringUsers = await pool.query(`
  SELECT id, email, subscription_expires_at
  FROM players
  WHERE subscription_expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
`);

expiringUsers.rows.forEach(user => {
  sendEmail({
    to: user.email,
    subject: 'Your Proof of Putt subscription expires soon',
    body: `Renew now: https://app.proofofputt.com/renew`
  });
});
```

#### Option 2: Auto-Renewal (Advanced)

If Zaprite supports recurring orders in their API:
- Create order with `recurring: true`
- Zaprite automatically charges customer each period
- Webhook notifies you of each payment

**Check Zaprite docs or contact support to confirm if this is available.**

---

## 📊 Monitoring

### Check Recent Orders
```sql
SELECT
  p.username,
  zpe.event_type,
  zpe.amount,
  zpe.status,
  zpe.processed_at
FROM zaprite_payment_events zpe
JOIN players p ON zpe.player_id = p.id
ORDER BY zpe.created_at DESC
LIMIT 20;
```

### Check Active Subscriptions
```sql
SELECT
  username,
  email,
  subscription_expires_at,
  subscription_status,
  is_subscribed
FROM players
WHERE is_subscribed = TRUE
ORDER BY subscription_expires_at DESC;
```

### Gift Code Analytics
```sql
-- Redemption rate
SELECT
  COUNT(*) FILTER (WHERE is_redeemed) as redeemed,
  COUNT(*) FILTER (WHERE NOT is_redeemed) as pending,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_redeemed) / COUNT(*), 2) as redemption_pct
FROM user_gift_subscriptions;
```

---

## 🚨 Common Issues

### Issue: "Invalid API Key"

**Solution:**
1. Verify API key in Zaprite → Settings → API
2. Check `.env` file has correct key
3. Make sure no extra spaces or quotes

### Issue: "Organization ID not found"

**Solution:**
1. Go to Zaprite → Settings → Organization
2. Copy the exact Organization ID
3. Update `ZAPRITE_ORG_ID` in `.env`

### Issue: No checkout URL in response

**Solution:**
Check the Zaprite API response structure. The field might be:
- `checkoutUrl`
- `url`
- `hostedUrl`
- `paymentUrl`

The code handles all these variations.

### Issue: Webhook not receiving events

**Solution:**
1. Test webhook endpoint is accessible:
   ```bash
   curl https://app.proofofputt.com/api/webhooks/zaprite-subscription
   ```
2. Check Zaprite webhook logs for delivery attempts
3. Verify webhook secret matches (if required)

---

## ✅ Deployment Checklist

- [x] Zaprite API key obtained
- [x] Organization ID verified
- [x] Webhook secret generated
- [x] Database migrations run
- [ ] Deploy `/api/subscriptions/create-zaprite-order.js`
- [ ] Deploy `/api/webhooks/zaprite-subscription.js`
- [ ] Configure webhook in Zaprite dashboard
- [ ] Test order creation
- [ ] Test payment with Lightning (instant)
- [ ] Verify gift code generation for annual
- [ ] Test gift code redemption
- [ ] Add subscription UI to frontend
- [ ] Set up renewal reminders (cron job)

---

## 📞 Need Help?

**Zaprite Support:**
- Email: support@zaprite.com
- Help Center: https://help.zaprite.com
- API Docs: https://api.zaprite.com

**Your Config:**
- Organization ID: `cmgbcd9d80008l104g3tasx06`
- API Key: Configured ✅
- Webhook: Ready to configure

---

## 🎉 Ready to Launch!

No product/plan creation needed - just deploy the APIs and start creating orders!

Each subscription purchase creates a new order dynamically with the correct amount ($2.10 or $21).
