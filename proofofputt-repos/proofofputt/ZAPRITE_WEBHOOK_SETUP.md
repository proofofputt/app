# Zaprite Webhook Configuration Guide

**Status**: Database Ready ✅ | Webhook Setup In Progress
**Last Updated**: October 9, 2025

---

## ✅ COMPLETED

1. **Environment Variables**: All Zaprite variables set in Vercel
2. **Database Tables**: All tables created and verified
3. **API Endpoints**: Deployed and tested
4. **Subscription Bundles**: 4 bundles configured (3, 5, 10, 21-pack)

---

## 🔧 FINAL STEP: Configure Webhook in Zaprite Dashboard

### Step 1: Log in to Zaprite
Go to: https://app.zaprite.com

### Step 2: Navigate to Webhooks
- Click **Settings** (gear icon) or **Developers**
- Select **Webhooks** from the menu
- Click **Add Webhook** or **Create Endpoint**

### Step 3: Configure Webhook URL

**Webhook Endpoint URL:**
```
https://app.proofofputt.com/api/webhooks/zaprite-subscription
```

### Step 4: Subscribe to Events

Select these event types (check all that apply):

- ✅ `payment.succeeded` - Customer payment completed successfully
- ✅ `subscription.created` - New subscription started
- ✅ `subscription.canceled` (or `subscription.cancelled`) - Subscription cancelled
- ✅ `subscription.renewed` - Subscription renewed for another period
- ✅ `payment.failed` - Payment attempt failed
- ✅ `order.paid` - Order payment completed (if available)

**Note**: Event names may vary slightly in Zaprite dashboard. Select all payment and subscription-related events.

### Step 5: Save Webhook

- Click **Save** or **Create Webhook**
- **Important**: Zaprite does NOT require a webhook signing secret (this is normal)

### Step 6: Test Webhook (Optional but Recommended)

If Zaprite provides a "Test Webhook" button:
1. Click **Test Webhook** or **Send Test Event**
2. You should see: `200 OK` response
3. Response body: `{"success":true,"message":"Event received but not processed"}`

---

## 🧪 VERIFICATION

### Verify Webhook is Active

After saving, you should see:
- ✅ Webhook URL: `https://app.proofofputt.com/api/webhooks/zaprite-subscription`
- ✅ Status: Active or Enabled
- ✅ Events subscribed: 5-6 events selected

### Test Webhook Manually (From Terminal)

```bash
curl -X POST https://app.proofofputt.com/api/webhooks/zaprite-subscription \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'

# Expected response:
# {"success":true,"message":"Event received but not processed"}
```

---

## 📊 DATABASE VERIFICATION

Your database is ready with:

### Tables Created:
- ✅ `zaprite_payment_events` - Webhook event log
- ✅ `subscription_bundles` - Bundle pricing
- ✅ `user_gift_subscriptions` - Gift codes

### Subscription Bundles:
| Bundle | Quantity | Discount | Price Each |
|--------|----------|----------|------------|
| 3-Pack | 3 years | 10% | $18.90 |
| 5-Pack | 5 years | 20% | $16.80 |
| 10-Pack | 10 years | 42% | $12.10 |
| 21-Pack | 21 years | 50% | $10.52 |

### Player Table Columns Added:
- `zaprite_customer_id`
- `zaprite_subscription_id`
- `zaprite_payment_method`
- `subscription_started_at`
- `subscription_current_period_start`
- `subscription_current_period_end`
- `subscription_cancel_at_period_end`
- `subscription_billing_cycle`
- `is_subscribed`
- `subscription_expires_at`

---

## 🎯 WHAT HAPPENS WHEN A PAYMENT IS MADE

### User Flow:
1. User clicks "Subscribe Monthly" ($2.10) or "Subscribe Annually" ($21)
2. Frontend calls: `POST /api/subscriptions/create-zaprite-order`
3. API creates Zaprite order and returns `checkoutUrl`
4. User redirected to Zaprite payment page
5. User completes payment (Bitcoin/Lightning/Card)
6. **Zaprite sends webhook** → `POST /api/webhooks/zaprite-subscription`
7. Webhook handler updates database:
   ```sql
   UPDATE players SET
     is_subscribed = TRUE,
     subscription_expires_at = NOW() + INTERVAL '1 year',
     subscription_tier = 'Full Subscriber',
     zaprite_customer_id = '<customer_id>',
     zaprite_payment_method = 'lightning'
   WHERE id = <user_id>;
   ```
8. If annual subscription: Generate gift code → `user_gift_subscriptions` table
9. User redirected to success page

### Webhook Events Handled:
| Event | Action |
|-------|--------|
| `payment.succeeded` | Activate subscription, generate gift if annual |
| `subscription.created` | Log subscription start |
| `subscription.canceled` | Set status to 'canceled' |
| `payment.failed` | Set status to 'past_due', log error |

---

## 🚀 POST-WEBHOOK SETUP: TEST SUBSCRIPTION FLOW

### Test Checklist:
- [ ] Log in to web app: https://app.proofofputt.com/login
- [ ] Navigate to Settings page
- [ ] Click "Subscribe Monthly" or "Subscribe Annually"
- [ ] Verify Zaprite checkout page opens
- [ ] Complete payment (use test mode if available)
- [ ] Verify webhook received (check Vercel logs)
- [ ] Verify subscription activated (check Settings page)
- [ ] If annual: Verify gift code generated

### Monitor Webhooks:
```bash
# Watch Vercel logs for webhook activity
vercel logs --follow --filter="zaprite"

# Check database for webhook events
# (Run via psql or database client)
SELECT event_type, status, created_at, error_message
FROM zaprite_payment_events
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🆘 TROUBLESHOOTING

### Issue: Webhook not receiving events
**Solution**:
1. Verify webhook URL in Zaprite dashboard is correct
2. Check webhook endpoint is publicly accessible: `curl https://app.proofofputt.com/api/webhooks/zaprite-subscription`
3. Check Zaprite dashboard → Webhooks → View Delivery Logs

### Issue: Payment succeeds but subscription not activated
**Solution**:
1. Check Vercel logs: `vercel logs --filter="zaprite"`
2. Check `zaprite_payment_events` table for errors
3. Manually activate if needed:
   ```sql
   UPDATE players
   SET is_subscribed = TRUE,
       subscription_expires_at = NOW() + INTERVAL '1 year',
       subscription_tier = 'Full Subscriber'
   WHERE id = <user_id>;
   ```

### Issue: Gift code not generated for annual subscription
**Solution**:
```sql
-- Manually generate gift code
INSERT INTO user_gift_subscriptions (owner_user_id, gift_code, is_redeemed)
VALUES (<user_id>, CONCAT('GIFT-', UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 16))), FALSE);
```

---

## ✅ LAUNCH READY CHECKLIST

- [x] `ZAPRITE_BASE_URL` environment variable set
- [x] `ZAPRITE_API_KEY` environment variable set
- [x] `ZAPRITE_ORG_ID` environment variable set
- [x] Database migrations executed successfully
- [x] 3 tables created: `zaprite_payment_events`, `subscription_bundles`, `user_gift_subscriptions`
- [x] 4 subscription bundles configured
- [x] 12 columns added to `players` table
- [ ] **Webhook configured in Zaprite dashboard** ← FINAL STEP
- [ ] Webhook tested and receiving events
- [ ] End-to-end subscription flow tested

---

## 🎉 YOU'RE ALMOST THERE!

**Remaining Time**: 5-10 minutes
**Final Step**: Configure webhook in Zaprite dashboard (instructions above)

Once the webhook is configured, your Zaprite payment integration will be **100% complete** and ready for production!

---

**Generated**: October 9, 2025
**Status**: Database Ready | Webhook Setup Pending
