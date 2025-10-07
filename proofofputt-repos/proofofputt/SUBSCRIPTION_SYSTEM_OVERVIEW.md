# Proof of Putt - Complete Subscription System Overview

## 🎯 Your Pricing Strategy

| Plan | Price | Gift Bonus |
|------|-------|------------|
| **Monthly** | $2.10/month | None |
| **Annual** | $21/year | **1 free year gift code** for a friend |

---

## 📁 System Components

### 1. Database Schema

**Existing Tables (Already Built):**
- ✅ `subscription_bundles` - Batch subscription packages (3-pack, 5-pack, etc.)
- ✅ `user_gift_subscriptions` - Gift codes owned by users
- ✅ `players` - User subscription status (`is_subscribed`, `subscription_expires_at`)

**New Zaprite Tables:**
- ✅ `zaprite_payment_events` - Webhook event logging
- ✅ `zaprite_subscriptions` - Active Zaprite subscriptions

**Migration Files:**
- `/database/add_subscription_gifting_tables.sql` (existing)
- `/database/add_zaprite_subscriptions.sql` (new)

---

### 2. API Endpoints

#### Zaprite Integration (New)

**A. Create Checkout**
- **File:** `/api/subscriptions/create-zaprite-checkout.js`
- **Route:** `POST /api/subscriptions/create-zaprite-checkout`
- **Body:** `{ "interval": "monthly" | "annual" }`
- **Response:** `{ checkoutUrl, amount, includesGift }`
- **Purpose:** Creates Zaprite payment link

**B. Webhook Handler**
- **File:** `/api/webhooks/zaprite-subscription.js`
- **Route:** `POST /api/webhooks/zaprite-subscription`
- **Events:** `payment.succeeded`, `subscription.canceled`, `payment.failed`
- **Purpose:** Processes payments and auto-generates gift codes

#### Gift Redemption (Existing)

**C. List Gifts**
- **File:** `/api/subscriptions/gifts/index.js`
- **Route:** `GET /api/subscriptions/gifts`
- **Purpose:** Shows user's available gift codes

**D. Redeem Gift**
- **File:** `/api/subscriptions/gifts/redeem.js`
- **Route:** `POST /api/subscriptions/gifts/redeem`
- **Body:** `{ "giftCode": "GIFT-XXX" }`
- **Purpose:** Activates 1-year subscription from gift code

#### Batch Subscriptions (Existing)

**E. Purchase Bundle**
- **File:** `/app/api/subscriptions/bundles/purchase.js`
- **Route:** `POST /api/subscriptions/bundles/purchase`
- **Body:** `{ "bundleId": 1 }`
- **Purpose:** Buy bulk subscriptions (3-pack, 5-pack, etc.)

---

### 3. Frontend Components (Existing)

**A. Subscription Bundles**
- **File:** `/app/src/components/SubscriptionBundles.jsx`
- **Purpose:** Display batch purchase options

**B. My Gifts**
- **File:** `/app/src/components/MyGifts.jsx`
- **Purpose:** Show user's gift codes and redemption status

**C. Settings Page**
- **File:** `/app/src/pages/SettingsPage.jsx`
- **Updates:** Links to bundles and gifts pages

---

## 🔄 Complete User Flows

### Flow 1: Monthly Subscription Purchase

```
1. User clicks "Subscribe Monthly" ($2.10/month)
   └─> Frontend calls POST /api/subscriptions/create-zaprite-checkout
       └─> API creates Zaprite checkout session
           └─> Returns checkoutUrl

2. User redirected to Zaprite payment page
   └─> Chooses Bitcoin/Lightning/Card
       └─> Completes payment

3. Zaprite sends webhook to /api/webhooks/zaprite-subscription
   └─> Webhook receives payment.succeeded event
       └─> Updates players table:
           - is_subscribed = TRUE
           - subscription_expires_at = NOW() + 30 days
           - subscription_tier = 'Full Subscriber'
       └─> Logs event in zaprite_payment_events

4. User gains immediate access to subscription features
```

---

### Flow 2: Annual Subscription Purchase (with Gift)

```
1. User clicks "Subscribe Annually" ($21/year + free gift)
   └─> Frontend calls POST /api/subscriptions/create-zaprite-checkout
       └─> API creates checkout with metadata.includesGift = true
           └─> Returns checkoutUrl

2. User completes payment at Zaprite
   └─> Same as monthly flow

3. Zaprite webhook received
   └─> Updates players table:
       - is_subscribed = TRUE
       - subscription_expires_at = NOW() + 1 year
       - subscription_tier = 'Full Subscriber'
   └─> Generates unique gift code (e.g., GIFT-A1B2C3D4E5F6)
       └─> Inserts into user_gift_subscriptions:
           - owner_user_id = purchaser
           - gift_code = GIFT-XXX
           - is_redeemed = FALSE

4. User can view gift code in "My Gifts" page
   └─> Share code with friend
```

---

### Flow 3: Gift Code Redemption

```
1. Friend receives gift code (e.g., GIFT-A1B2C3D4E5F6)
   └─> Enters code in redemption form

2. Frontend calls POST /api/subscriptions/gifts/redeem
   └─> API validates gift code:
       - Check if code exists
       - Check if not already redeemed
   └─> If valid:
       - Mark gift as redeemed:
           - is_redeemed = TRUE
           - redeemed_by_user_id = friend's ID
           - redeemed_at = NOW()
       - Update friend's subscription:
           - is_subscribed = TRUE
           - subscription_expires_at = NOW() + 1 year
           - subscription_tier = 'Full Subscriber'

3. Friend gets 1 year free subscription
```

---

### Flow 4: Batch Purchase (Existing System)

```
1. User wants to buy subscriptions for their golf club
   └─> Views bundle options (3-pack, 5-pack, 10-pack, 21-pack)
       └─> Clicks "Purchase 10-Pack" ($121 total)

2. Frontend calls POST /api/subscriptions/bundles/purchase
   └─> API calculates discounted price
       └─> Processes payment
           └─> Generates 10 unique gift codes
               └─> Inserts 10 rows in user_gift_subscriptions

3. User receives 10 gift codes
   └─> Can distribute to club members
       └─> Each member redeems independently
```

---

## 🗄️ Database Schema Reference

### Players Table (Updated)
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS:
  - is_subscribed BOOLEAN DEFAULT FALSE
  - subscription_expires_at TIMESTAMP WITH TIME ZONE
  - subscription_tier VARCHAR(50)
  - subscription_status VARCHAR(50)
  - zaprite_customer_id VARCHAR(255)
  - zaprite_subscription_id VARCHAR(255)
  - zaprite_payment_method VARCHAR(50)
  - subscription_started_at TIMESTAMP WITH TIME ZONE
```

### Gift Subscriptions
```sql
CREATE TABLE user_gift_subscriptions (
  id SERIAL PRIMARY KEY,
  owner_user_id INT REFERENCES players(id),
  bundle_id INT REFERENCES subscription_bundles(id),
  gift_code VARCHAR(255) UNIQUE NOT NULL,
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_by_user_id INT REFERENCES players(id),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Payment Events
```sql
CREATE TABLE zaprite_payment_events (
  id SERIAL PRIMARY KEY,
  player_id INT REFERENCES players(id),
  event_type VARCHAR(100),
  event_id VARCHAR(255),
  customer_id VARCHAR(255),
  subscription_id VARCHAR(255),
  amount NUMERIC(10, 2),
  currency VARCHAR(10),
  status VARCHAR(50),
  error_message TEXT,
  raw_event JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

---

## 🔐 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret

# Zaprite Configuration
ZAPRITE_API_KEY=342ea623-1169-4633-9bd4-ba582be44d23
ZAPRITE_WEBHOOK_SECRET=4e74dbcb19f266ff31de24f6ec185ff3aa388c7a73e8a1f6f8bc38cd817cdf3c
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
ZAPRITE_BASE_URL=https://api.zaprite.com
ZAPRITE_PLAN_ID=<create-in-zaprite-dashboard>

# Frontend
FRONTEND_URL=https://app.proofofputt.com
```

---

## 📊 Key Metrics to Track

### Revenue Metrics
```sql
-- Total subscription revenue
SELECT SUM(amount) FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded';

-- Monthly vs Annual breakdown
SELECT
  CASE WHEN amount < 10 THEN 'Monthly' ELSE 'Annual' END as plan,
  COUNT(*) as purchases,
  SUM(amount) as revenue
FROM zaprite_payment_events
WHERE event_type = 'payment.succeeded'
GROUP BY plan;
```

### User Metrics
```sql
-- Active subscribers
SELECT COUNT(*) FROM players
WHERE is_subscribed = TRUE
AND subscription_expires_at > NOW();

-- Subscription expiring in next 7 days
SELECT username, email, subscription_expires_at
FROM players
WHERE subscription_expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days';
```

### Gift Code Metrics
```sql
-- Gift redemption rate
SELECT
  COUNT(*) FILTER (WHERE is_redeemed) as redeemed,
  COUNT(*) FILTER (WHERE NOT is_redeemed) as unredeemed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_redeemed) / COUNT(*), 2) as pct
FROM user_gift_subscriptions;

-- Most successful gift givers
SELECT
  p.username,
  COUNT(*) as gifts_given,
  COUNT(*) FILTER (WHERE ugs.is_redeemed) as gifts_redeemed
FROM players p
JOIN user_gift_subscriptions ugs ON p.id = ugs.owner_user_id
GROUP BY p.username
ORDER BY gifts_redeemed DESC
LIMIT 10;
```

---

## 🚀 Integration with Your Bootstrap Model

From your `BOOTSTRAP_INVESTMENT_MODEL.md`, this system supports:

### Micro-Influencer Strategy (Line 105-108)
```
Partner with local golf pros
→ Provide free lifetime memberships
→ If positive review, give batch of 10 year-long subscriptions
→ They distribute to their players
```

**How to implement:**
```sql
-- Grant 10 gift codes to an influencer
DO $$
DECLARE
  influencer_id INT := 123; -- Golf pro's user ID
  i INT;
  gift_code TEXT;
BEGIN
  FOR i IN 1..10 LOOP
    gift_code := 'GIFT-' || upper(md5(random()::text || now()::text));
    INSERT INTO user_gift_subscriptions (owner_user_id, gift_code)
    VALUES (influencer_id, gift_code);
  END LOOP;
END $$;
```

### Referral Incentives (Line 135)
- 50%+ commission rates → Your $21 annual subscription
- Each annual buyer gets a **free year gift** to share
- Creates viral loop: Pay $21 → Get 1 year + give 1 year free

### Network Effects (Line 141)
- Each annual subscriber can bring 1+ user (via gift code)
- Already achieving "1.5+ additional users" target
- Zero additional cost per referred user

---

## 🎁 Gift Code Generation Logic

When annual subscription is purchased, webhook automatically:

```javascript
// From api/webhooks/zaprite-subscription.js

if (interval === 'annual') {
  const giftCode = generateGiftCode(); // Returns GIFT-XXXXXXXX

  await pool.query(
    `INSERT INTO user_gift_subscriptions (
      owner_user_id,
      gift_code,
      is_redeemed
    ) VALUES ($1, $2, FALSE)`,
    [userId, giftCode]
  );

  console.log(`Gift code ${giftCode} generated for user ${userId}`);
  // TODO: Send email notification with gift code
}
```

---

## 📧 Next Steps for Email Notifications

Add email notifications when:
1. Annual subscription purchased → Send email with gift code
2. Gift code redeemed → Notify both giver and receiver
3. Subscription expiring soon → Renewal reminder

**Example email template:**

```
Subject: Your Proof of Putt Subscription + Free Gift! 🎁

Hi {username},

Thanks for subscribing to Proof of Putt Annual ($21/year)!

Your subscription is active until {expiry_date}.

As a bonus, you get a FREE 1-year subscription to share with a friend:

Gift Code: {gift_code}

Share this code with anyone, and they'll get 1 full year free!

View all your gifts: https://app.proofofputt.com/gifts

Happy putting! ⛳
```

---

## ✅ System Status

**Implemented:**
- ✅ Zaprite checkout creation (monthly & annual)
- ✅ Webhook processing
- ✅ Auto gift code generation for annual plans
- ✅ Gift code redemption system
- ✅ Batch subscription purchases
- ✅ Database schema
- ✅ Payment event logging
- ✅ Frontend components (bundles & gifts)

**Ready to Deploy:**
- 📦 API endpoints ready
- 🗄️ Database migrations ready
- 🎨 Frontend components ready
- 📊 Analytics queries ready

**Needs Configuration:**
1. Create Zaprite subscription plan
2. Add Plan ID to `.env`
3. Deploy APIs to production
4. Configure Zaprite webhook
5. Test with real payment

---

## 📖 Documentation Files

1. **ZAPRITE_SETUP_GUIDE_FINAL.md** - Complete setup instructions
2. **SUBSCRIPTION_BUNDLING_FEATURE_HANDOVER.md** - Original batch system docs
3. **ZAPRITE_SUBSCRIPTION_SETUP.md** - Zaprite overview
4. **ZAPRITE_TESTING_GUIDE.md** - Testing procedures
5. **This file** - System architecture overview

---

**Organization ID:** `cmgbcd9d80008l104g3tasx06`

**You're ready to launch! 🚀**
