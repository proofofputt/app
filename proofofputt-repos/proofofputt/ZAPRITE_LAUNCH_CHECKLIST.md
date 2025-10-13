# Zaprite Integration - Final Launch Checklist

**Status**: Ready for Configuration
**Last Updated**: October 9, 2025
**Time to Complete**: 15-20 minutes

---

## ✅ COMPLETED - Infrastructure Ready

### 1. Environment Variables ✅
- [x] `ZAPRITE_API_KEY` - Set in Vercel production
- [x] `ZAPRITE_ORG_ID` - Set in Vercel production (cmgbcd9d80008l104g3tasx06)
- [x] `FRONTEND_URL` - Set in Vercel production
- [x] `DATABASE_URL` - Set in Vercel production

### 2. API Endpoints Deployed ✅
- [x] `/api/subscriptions/create-zaprite-order.js` - Creates Zaprite payment orders
- [x] `/api/webhooks/zaprite-subscription.js` - Handles payment webhooks
- [x] Webhook endpoint tested and responding

### 3. Database Schema ✅
Migration files exist and ready to run:
- [x] `add_zaprite_subscriptions.sql` - Core Zaprite tables
- [x] `add_subscription_gifting_tables.sql` - Gift code system

---

## 🔧 REQUIRED - Complete These Steps Now

### Step 1: Add Missing Environment Variable (2 min)
**Action Required**: Add `ZAPRITE_BASE_URL` to Vercel production

```bash
# Run this command:
vercel env add ZAPRITE_BASE_URL production

# When prompted, enter:
https://api.zaprite.com
```

**Why**: The order creation endpoint needs this to make API calls to Zaprite.

---

### Step 2: Run Database Migrations (3 min)
**Action Required**: Execute SQL migrations on production database

```bash
# Connect to production database and run:
psql $DATABASE_URL -f app/database/add_zaprite_subscriptions.sql
psql $DATABASE_URL -f app/database/add_subscription_gifting_tables.sql
```

**Expected Result**: These tables should be created:
- `zaprite_events` - Webhook event audit trail
- `zaprite_payment_events` - Payment tracking (if not exists)
- `subscription_bundles` - Bundle pricing (3-pack, 5-pack, etc.)
- `user_gift_subscriptions` - Gift code tracking

**Verify Tables Created**:
```sql
-- Run this to verify:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%zaprite%' OR table_name LIKE '%gift%' OR table_name LIKE '%bundle%';
```

---

### Step 3: Configure Zaprite Dashboard (5 min)
**Action Required**: Set up webhook in Zaprite dashboard

1. **Log in to Zaprite**: https://app.zaprite.com
2. **Navigate to**: Settings → Webhooks (or Developers → Webhooks)
3. **Click**: "Add Webhook" or "Create Endpoint"
4. **Webhook URL**:
   ```
   https://app.proofofputt.com/api/webhooks/zaprite-subscription
   ```
5. **Events to Subscribe** (select all that apply):
   - [x] `payment.succeeded`
   - [x] `subscription.created`
   - [x] `subscription.canceled` (or `subscription.cancelled`)
   - [x] `subscription.renewed`
   - [x] `payment.failed`
   - [x] `order.paid` (if available)

6. **Note**: Zaprite does NOT provide webhook signing secrets - this is normal
7. **Test**: Click "Test Webhook" if available
8. **Expected Response**: `200 OK` with `{"success":true}`

---

### Step 4: Create Subscription Products in Zaprite (5 min)
**Action Required**: Create payment products in Zaprite dashboard

#### Monthly Subscription
1. Navigate to: Products → Create Product
2. **Name**: Proof of Putt Monthly Subscription
3. **Price**: $2.10 USD
4. **Interval**: One-time (we handle recurring via webhooks)
5. **Description**: Monthly access to Proof of Putt Full Subscriber features
6. **Save** (optional - API can create orders dynamically)

#### Annual Subscription
1. Navigate to: Products → Create Product
2. **Name**: Proof of Putt Annual Subscription
3. **Price**: $21.00 USD
4. **Interval**: One-time
5. **Description**: Annual access + 1 free year gift code for a friend
6. **Save** (optional)

**Note**: The API (`create-zaprite-order.js`) can create orders dynamically without pre-configured products.

---

## 🧪 TESTING - Verify Before Launch (5 min)

### Test 1: Check API Connectivity
```bash
# This should return 401 (auth required) - meaning endpoint exists
curl -X POST https://app.proofofputt.com/api/subscriptions/create-zaprite-order \
  -H "Content-Type: application/json" \
  -d '{"interval":"monthly"}'

# Expected: {"error":"Unauthorized - No token provided"}
```

### Test 2: Check Webhook Endpoint
```bash
# This should return 200 OK
curl -X POST https://app.proofofputt.com/api/webhooks/zaprite-subscription \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'

# Expected: {"success":true,"message":"Event received but not processed"}
```

### Test 3: Database Connection
```sql
-- Verify tables exist
SELECT COUNT(*) FROM subscription_bundles;
-- Expected: 4 (3-pack, 5-pack, 10-pack, 21-pack)

SELECT COUNT(*) FROM zaprite_events;
-- Expected: 0 (or existing events)
```

---

## 📋 CRITICAL PRE-LAUNCH CHECKS

### Security ✅
- [x] API keys stored in environment variables (not in code)
- [x] Webhook endpoint requires HTTPS
- [x] JWT authentication on order creation endpoint
- [x] Database credentials secured

### Functionality ⏳ (Test After Setup)
- [ ] User can click "Subscribe" button
- [ ] Zaprite checkout page opens
- [ ] Payment completes successfully
- [ ] Webhook received and processed
- [ ] User subscription status updated in database
- [ ] Annual subscribers receive gift code

### Monitoring ⏳ (Set Up Post-Launch)
- [ ] Watch Vercel logs: `vercel logs --follow --filter="zaprite"`
- [ ] Monitor webhook success rate in Zaprite dashboard
- [ ] Check database for failed events: `SELECT * FROM zaprite_events WHERE processed = FALSE`

---

## 🎯 SUBSCRIPTION PRICING SUMMARY

### Individual Subscriptions
| Tier | Price | Interval | Includes Gift |
|------|-------|----------|---------------|
| Monthly | $2.10/month | Monthly | No |
| Annual | $21.00/year | Annual | **Yes - 1 year gift code** |

### Bundles (For Clubs/Instructors)
| Bundle | Quantity | Total Price | Per Code | Discount |
|--------|----------|-------------|----------|----------|
| 3-Pack | 3 years | $56.70 | $18.90 | 10% |
| 5-Pack | 5 years | $84.00 | $16.80 | 20% |
| 10-Pack | 10 years | $121.00 | $12.10 | 42% |
| 21-Pack | 21 years | $221.00 | $10.52 | 50% |

---

## 🚀 POST-SETUP: How It Works

### User Flow - Individual Subscription
1. User clicks "Subscribe Monthly" or "Subscribe Annually" in Settings
2. Frontend calls `/api/subscriptions/create-zaprite-order` with JWT token
3. API creates Zaprite order and returns `checkoutUrl`
4. User redirected to Zaprite checkout page
5. User completes payment (Bitcoin/Lightning/Card)
6. Zaprite sends webhook to `/api/webhooks/zaprite-subscription`
7. Webhook handler updates database:
   - Sets `is_subscribed = TRUE`
   - Sets `subscription_expires_at`
   - Sets `subscription_tier = 'Full Subscriber'`
   - Generates gift code if annual subscription
8. User redirected to success page

### Webhook Event Handling
| Event Type | Action |
|------------|--------|
| `payment.succeeded` | Activate subscription, generate gift code if annual |
| `subscription.created` | Log subscription start |
| `subscription.canceled` | Set status to 'canceled' |
| `payment.failed` | Set status to 'past_due', log error |

---

## 🆘 TROUBLESHOOTING

### Issue: "Missing ZAPRITE_BASE_URL"
**Solution**: Add environment variable (see Step 1)

### Issue: Webhook not receiving events
**Solution**:
1. Check webhook URL is correct in Zaprite dashboard
2. Verify endpoint is publicly accessible: `curl https://app.proofofputt.com/api/webhooks/zaprite-subscription`
3. Check Zaprite dashboard for webhook delivery logs

### Issue: Database table doesn't exist
**Solution**: Run migrations (see Step 2)

### Issue: Payment succeeds but subscription not activated
**Solution**:
1. Check Vercel logs: `vercel logs --filter="zaprite"`
2. Check `zaprite_events` table for processing errors
3. Manually activate if needed:
   ```sql
   UPDATE players
   SET is_subscribed = TRUE,
       subscription_expires_at = NOW() + INTERVAL '1 year'
   WHERE id = <user_id>;
   ```

---

## ✅ LAUNCH READY CRITERIA

### Must Complete (Blocking)
- [ ] `ZAPRITE_BASE_URL` environment variable added
- [ ] Database migrations executed successfully
- [ ] Webhook configured in Zaprite dashboard
- [ ] Test webhook receives 200 OK response

### Should Complete (Highly Recommended)
- [ ] Create subscription products in Zaprite (optional)
- [ ] Test order creation with real API call
- [ ] Verify database tables have correct data

### Optional (Can Do Post-Launch)
- [ ] Set up email notifications for new subscriptions
- [ ] Configure monitoring alerts for failed webhooks
- [ ] Add custom branding to Zaprite checkout page

---

## 📞 SUPPORT & DOCUMENTATION

### Zaprite Support
- **Documentation**: https://docs.zaprite.com
- **API Reference**: https://docs.zaprite.com/api
- **Support Email**: support@zaprite.com
- **Status Page**: https://status.zaprite.com

### Internal Documentation
- **API Implementation**: `/app/api/subscriptions/create-zaprite-order.js`
- **Webhook Handler**: `/app/api/webhooks/zaprite-subscription.js`
- **Database Schema**: `/app/database/add_zaprite_subscriptions.sql`
- **Gift System**: `/app/database/add_subscription_gifting_tables.sql`

---

## 🎉 LAUNCH ESTIMATE

**Current Status**: 85% Complete
**Remaining Time**: 15-20 minutes
**Blocking Issues**: 3 quick configuration steps

**You are ready to launch subscriptions once:**
1. ✅ `ZAPRITE_BASE_URL` added (2 min)
2. ✅ Database migrations run (3 min)
3. ✅ Webhook configured in Zaprite (5 min)

**Total Time to Launch-Ready**: ~10-15 minutes

---

**Generated**: October 9, 2025
**Version**: 1.0
**Status**: Ready for Configuration
