# Zaprite Configuration Checklist

Complete setup guide for integrating Zaprite payment processing with Proof of Putt subscription system.

---

## Overview

Zaprite is a payment processor that accepts Bitcoin (Lightning/On-chain), cryptocurrency, and credit cards. This checklist covers everything needed to configure Zaprite for both individual subscriptions and bundle purchases.

---

## Pre-Setup Requirements

### ✅ Business Information
- [ ] Legal business name registered
- [ ] Business email address
- [ ] Website URL (proofofputt.com)
- [ ] Business description ready
- [ ] Terms of Service URL
- [ ] Privacy Policy URL
- [ ] Support contact information

### ✅ Technical Prerequisites
- [ ] Access to production environment variables
- [ ] Database access for webhook verification
- [ ] HTTPS endpoint for webhooks (https://app.proofofputt.com)
- [ ] Server logs accessible for debugging
- [ ] API testing tools (Postman/curl)

---

## Phase 1: Zaprite Account Setup

### 1.1 Create Zaprite Account

- [ ] Visit https://zaprite.com or https://app.zaprite.com
- [ ] Click "Sign Up" or "Get Started"
- [ ] Choose account type:
  - [ ] Individual (for testing)
  - [ ] Business (for production)
- [ ] Complete registration form:
  - [ ] Email address
  - [ ] Password (secure, store in password manager)
  - [ ] Two-factor authentication (recommended)

**Expected Outcome:** Account created, email verified

---

### 1.2 Complete Business Profile

Navigate to Settings → Profile/Organization

- [ ] Organization Name: "Proof of Putt"
- [ ] Business Type: SaaS / Digital Services
- [ ] Website: https://www.proofofputt.com
- [ ] Support Email: support@proofofputt.com (or appropriate)
- [ ] Logo upload (if available)
- [ ] Business Description:
  ```
  AI-powered golf putting analytics and training platform.
  Subscription-based access to computer vision tracking,
  competitive leagues, and verifiable performance records.
  ```

**Expected Outcome:** Profile complete, visible on payment pages

---

### 1.3 Configure Payment Methods

Navigate to Settings → Payment Methods

**Bitcoin/Lightning:**
- [ ] Enable Bitcoin payments
- [ ] Enable Lightning Network (recommended for faster payments)
- [ ] Connect Bitcoin wallet or node:
  - Option A: Use Zaprite's hosted wallet
  - Option B: Connect own node (BTCPay Server, Voltage, etc.)
- [ ] Set Bitcoin settlement preferences:
  - [ ] Auto-convert to fiat (if needed)
  - [ ] Hold in Bitcoin
- [ ] Test Bitcoin payment flow

**Credit/Debit Cards:**
- [ ] Enable credit card payments
- [ ] Complete KYC verification (if required)
- [ ] Link bank account for settlements
- [ ] Set card processing fees:
  - [ ] Pass fees to customer OR
  - [ ] Absorb fees into pricing
- [ ] Test card payment flow

**Other Crypto (Optional):**
- [ ] Enable Ethereum (ETH)
- [ ] Enable Stablecoins (USDC, USDT)
- [ ] Configure settlement preferences

**Expected Outcome:** All desired payment methods active

---

### 1.4 Set Pricing Currency

Navigate to Settings → Currency

- [ ] Primary currency: USD
- [ ] Enable automatic crypto conversion
- [ ] Set exchange rate provider (use Zaprite default)
- [ ] Configure rate lock duration (e.g., 15 minutes)

**Expected Outcome:** Prices displayed in USD, converted at checkout

---

## Phase 2: API Configuration

### 2.1 Generate API Credentials

Navigate to Settings → API or Developers

- [ ] Click "Create API Key" or "Generate API Key"
- [ ] Name: "Proof of Putt Production API"
- [ ] Permissions:
  - [ ] Read orders
  - [ ] Create orders
  - [ ] Receive webhooks
- [ ] Copy API Key (shows only once!)
  ```
  Example format: zprt_live_abc123def456...
  ```
- [ ] Store API key securely:
  - [ ] Add to password manager
  - [ ] Add to environment variables (do NOT commit to git)

**Expected Outcome:** API key generated and stored

---

### 2.2 Obtain Organization ID

Navigate to Settings → Organization or API Documentation

- [ ] Find Organization ID (also called Org ID or Merchant ID)
  ```
  Example format: org_abc123def456
  ```
- [ ] Copy Organization ID
- [ ] Store in environment variables

**Alternative:** Organization ID may be in API documentation or visible in webhook payloads

**Expected Outcome:** Organization ID recorded

---

### 2.3 Configure Environment Variables

**Production Environment:**

```bash
# Zaprite Configuration
ZAPRITE_API_KEY=zprt_live_abc123def456...
ZAPRITE_ORG_ID=org_abc123def456
ZAPRITE_BASE_URL=https://api.zaprite.com

# Optional: Webhook signing secret (if Zaprite provides one)
ZAPRITE_WEBHOOK_SECRET=whsec_abc123...
```

**Development/Staging Environment:**

```bash
# Zaprite Test Mode
ZAPRITE_API_KEY=zprt_test_abc123def456...
ZAPRITE_ORG_ID=org_test_abc123def456
ZAPRITE_BASE_URL=https://api-staging.zaprite.com  # or test URL
ZAPRITE_WEBHOOK_SECRET=whsec_test_abc123...
```

**Verification Steps:**
- [ ] Environment variables loaded in production
- [ ] Variables accessible in Node.js (`process.env.ZAPRITE_API_KEY`)
- [ ] NO variables committed to git (.env in .gitignore)
- [ ] Team members with access have secure storage

**Expected Outcome:** API credentials accessible to application

---

## Phase 3: Webhook Configuration

### 3.1 Set Webhook URL

Navigate to Settings → Webhooks or Developers → Webhooks

**Create Webhook Endpoint:**
- [ ] Click "Add Webhook" or "New Endpoint"
- [ ] Webhook URL:
  ```
  https://app.proofofputt.com/api/webhooks/zaprite/subscription
  ```
- [ ] Description: "Proof of Putt Subscription Payments"
- [ ] Events to subscribe:
  - [ ] `order.paid` or `payment.succeeded`
  - [ ] `order.completed`
  - [ ] `order.failed` or `payment.failed`
  - [ ] `order.expired` (optional)
  - [ ] `subscription.created` (if using recurring)
  - [ ] `subscription.updated` (if using recurring)
  - [ ] `subscription.cancelled` (if using recurring)

**Expected Outcome:** Webhook endpoint configured

---

### 3.2 Configure Webhook Security

**Option A: Webhook Signing Secret (Recommended)**
- [ ] Zaprite generates signing secret
- [ ] Copy secret to environment variable:
  ```bash
  ZAPRITE_WEBHOOK_SECRET=whsec_abc123def456...
  ```
- [ ] Implement signature verification in webhook handler:
  ```javascript
  const crypto = require('crypto');

  function verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }
  ```

**Option B: IP Whitelisting**
- [ ] Get Zaprite webhook IP addresses
- [ ] Configure firewall/load balancer to allow only Zaprite IPs
- [ ] Document IP whitelist for future reference

**Expected Outcome:** Webhooks secured against spoofing

---

### 3.3 Test Webhook Delivery

**Using Zaprite Dashboard:**
- [ ] Find "Test Webhook" or "Send Test Event" button
- [ ] Trigger test payment event
- [ ] Verify webhook received in application logs
- [ ] Check webhook response (should return 200 OK)

**Using Manual Testing:**
- [ ] Create test order via Zaprite API
- [ ] Complete payment (use test mode)
- [ ] Verify webhook received
- [ ] Verify subscription activated in database

**Expected Outcome:** Webhooks successfully delivered and processed

---

## Phase 4: Product/Service Configuration

### 4.1 Create Subscription Products (Optional)

If Zaprite supports product catalog:

**Monthly Subscription:**
- [ ] Navigate to Products → Create Product
- [ ] Product Name: "Proof of Putt Monthly Subscription"
- [ ] Price: $18.99 USD
- [ ] Billing Interval: Monthly
- [ ] Description: "Full Subscriber access with monthly billing"
- [ ] Save product, copy Product ID

**Annual Subscription:**
- [ ] Create Product
- [ ] Product Name: "Proof of Putt Annual Subscription"
- [ ] Price: $189 USD
- [ ] Billing Interval: Yearly
- [ ] Description: "Full Subscriber access with annual billing (17% savings)"
- [ ] Save product, copy Product ID

**Expected Outcome:** Products created in Zaprite catalog

---

### 4.2 Create Bundle Products

**3-Pack Bundle:**
- [ ] Product Name: "Proof of Putt 3-Pack Gift Bundle"
- [ ] Price: $56.70 USD
- [ ] One-time payment
- [ ] Description: "3 one-year subscription gift codes (10% discount)"

**5-Pack Bundle:**
- [ ] Product Name: "Proof of Putt 5-Pack Gift Bundle"
- [ ] Price: $84 USD
- [ ] One-time payment
- [ ] Description: "5 one-year subscription gift codes (21% discount)"

**10-Pack Bundle:**
- [ ] Product Name: "Proof of Putt 10-Pack Gift Bundle"
- [ ] Price: $121 USD
- [ ] One-time payment
- [ ] Description: "10 one-year subscription gift codes (42% discount)"

**21-Pack Bundle:**
- [ ] Product Name: "Proof of Putt 21-Pack Gift Bundle"
- [ ] Price: $221 USD
- [ ] One-time payment
- [ ] Description: "21 one-year subscription gift codes (50% discount)"

**Alternative:** Create orders dynamically via API (no pre-configured products needed)

**Expected Outcome:** Bundle products available for purchase

---

## Phase 5: Integration Testing

### 5.1 Test Individual Subscription Flow

**Monthly Subscription:**
- [ ] User clicks "Subscribe Monthly" in app
- [ ] API call creates Zaprite order:
  ```bash
  curl -X POST https://api.zaprite.com/v1/order \
    -H "Authorization: Bearer $ZAPRITE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "organizationId": "org_abc123",
      "amount": 18.99,
      "currency": "USD",
      "description": "Proof of Putt Monthly Subscription",
      "metadata": {
        "userId": "123",
        "tier": "monthly",
        "type": "subscription"
      }
    }'
  ```
- [ ] Response includes `checkoutUrl`
- [ ] User redirected to Zaprite checkout
- [ ] Complete test payment (Bitcoin/Card)
- [ ] Webhook received with `order.paid` event
- [ ] Database updated: `is_subscribed = true`
- [ ] User redirected to success page
- [ ] Subscription visible in Settings

**Annual Subscription:**
- [ ] Repeat above with Annual tier ($189)
- [ ] Verify 1-year expiration set correctly

**Expected Outcome:** Both subscription tiers work end-to-end

---

### 5.2 Test Bundle Purchase Flow

**5-Pack Bundle:**
- [ ] User clicks "Purchase Bundle" for 5-Pack
- [ ] API creates Zaprite order:
  ```bash
  curl -X POST https://api.zaprite.com/v1/order \
    -H "Authorization: Bearer $ZAPRITE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "organizationId": "org_abc123",
      "amount": 84,
      "currency": "USD",
      "description": "Proof of Putt 5-Pack Bundle - 5 Year Subscriptions",
      "metadata": {
        "userId": "123",
        "bundleId": "2",
        "bundleQuantity": "5",
        "type": "bundle"
      }
    }'
  ```
- [ ] Complete test payment
- [ ] Webhook received
- [ ] 5 gift codes generated in database
- [ ] Codes visible in "Free Year Invites" section
- [ ] User can share codes

**Expected Outcome:** Bundle purchase generates correct number of gift codes

---

### 5.3 Test Gift Code Redemption

- [ ] Copy gift code from bundle purchase
- [ ] New user registers with gift code OR existing user redeems in Settings
- [ ] Gift code validated and marked as redeemed
- [ ] User subscription activated (1 year)
- [ ] Referral dashboard updated for bundle purchaser

**Expected Outcome:** Gift code redemption upgrades user to Full Subscriber

---

### 5.4 Test Error Scenarios

**Payment Declined:**
- [ ] Use test card that declines
- [ ] Verify graceful error handling
- [ ] User sees appropriate error message
- [ ] No subscription activated
- [ ] Webhook logs error

**Webhook Failure:**
- [ ] Simulate webhook timeout
- [ ] Verify Zaprite retries webhook
- [ ] Verify idempotency (duplicate webhook doesn't double-activate)
- [ ] Manual subscription grant if needed

**Expired Payment:**
- [ ] Create order but don't pay within expiration window
- [ ] Verify order expires
- [ ] Webhook received with `order.expired`
- [ ] No subscription activated

**Expected Outcome:** All error cases handled gracefully

---

## Phase 6: Production Readiness

### 6.1 Security Checklist

- [ ] API keys stored in environment variables (NOT in code)
- [ ] Webhook signature verification implemented
- [ ] HTTPS enforced for all API calls
- [ ] Database queries use parameterized statements (prevent SQL injection)
- [ ] User input validated before creating orders
- [ ] Rate limiting configured on webhook endpoint
- [ ] Logs do NOT contain sensitive data (API keys, full card numbers)

**Expected Outcome:** Production-ready security posture

---

### 6.2 Monitoring & Logging

**Application Logging:**
- [ ] Log all Zaprite API requests
- [ ] Log all webhook receipts with status codes
- [ ] Log subscription activations
- [ ] Log gift code generations
- [ ] Log redemptions
- [ ] Do NOT log API keys or payment details

**Zaprite Dashboard Monitoring:**
- [ ] Enable email notifications for failed payments
- [ ] Enable alerts for webhook failures
- [ ] Set up daily payment reconciliation
- [ ] Monitor refund requests

**Example Log Structure:**
```javascript
console.log('[Zaprite] Creating order', {
  userId: 123,
  amount: 18.99,
  currency: 'USD',
  type: 'subscription',
  tier: 'monthly',
  timestamp: new Date().toISOString()
});
```

**Expected Outcome:** Complete audit trail of all payment events

---

### 6.3 Reconciliation Process

**Daily Reconciliation:**
- [ ] Export payments from Zaprite dashboard (CSV/API)
- [ ] Compare with database subscriptions
- [ ] Identify mismatches:
  - Payment received but no subscription
  - Subscription active but no payment record
- [ ] Document resolution process

**SQL Query for Verification:**
```sql
-- Find subscriptions without payment records
SELECT p.player_id, p.username, p.subscription_expires_at
FROM players p
LEFT JOIN payment_records pr ON p.player_id = pr.player_id
WHERE p.is_subscribed = true
  AND pr.id IS NULL;
```

**Expected Outcome:** Payment/subscription sync verified daily

---

### 6.4 Customer Communication Templates

**Successful Payment Email:**
```
Subject: Welcome to Proof of Putt Full Subscriber!

Hi [Name],

Thank you for subscribing to Proof of Putt! Your payment of $[amount] has been received.

Your subscription is now active and includes:
- Unlimited practice sessions
- Full competition access
- Advanced analytics
- Computer vision tracking
- OpenTimestamps certificates

Subscription Details:
- Plan: [Monthly/Annual]
- Expires: [Date]
- Renewal: [Auto/Manual]

Questions? Reply to this email or visit https://www.proofofputt.com/support

Keep putting!
The Proof of Putt Team
```

**Bundle Purchase Confirmation:**
```
Subject: Your Proof of Putt Gift Bundle is Ready!

Hi [Name],

Thanks for purchasing the [X]-Pack gift bundle! Your payment of $[amount] has been confirmed.

Your [X] gift codes are now available in your Settings page:
https://app.proofofputt.com/settings

Share these codes with friends, family, or students to give them 1 year of Full Subscriber access.

Track redemptions in your Referrals Dashboard.

Questions? Contact support@proofofputt.com

Thanks for spreading the love of putting!
The Proof of Putt Team
```

- [ ] Templates created in email service
- [ ] Triggered by webhook events
- [ ] Tested with real users

**Expected Outcome:** Automated customer communication in place

---

## Phase 7: Advanced Configuration (Optional)

### 7.1 Subscription Management Features

If Zaprite supports recurring billing:

- [ ] Enable subscription cancellation
- [ ] Configure auto-renewal settings
- [ ] Set grace period for failed renewals (e.g., 7 days)
- [ ] Implement dunning emails (payment retry reminders)
- [ ] Allow subscription pause/resume
- [ ] Handle prorated upgrades/downgrades

**Expected Outcome:** Full subscription lifecycle managed

---

### 7.2 Refund & Cancellation Policy

- [ ] Define refund policy:
  - 30-day money-back guarantee OR
  - No refunds on digital subscriptions OR
  - Prorated refunds
- [ ] Implement refund request process
- [ ] Configure Zaprite refund settings
- [ ] Document refund workflow for support team
- [ ] Update Terms of Service with refund policy

**Example Refund Process:**
```
1. Customer requests refund via email
2. Support verifies eligibility (within 30 days, first purchase, etc.)
3. Support initiates refund in Zaprite dashboard
4. Webhook received: order.refunded
5. Backend deactivates subscription
6. Customer confirmation email sent
```

**Expected Outcome:** Clear refund policy implemented

---

### 7.3 Multi-Currency Support (Future)

- [ ] Enable EUR pricing
- [ ] Enable GBP pricing
- [ ] Configure automatic currency detection (by IP/locale)
- [ ] Display prices in user's local currency
- [ ] Handle FX fluctuations in pricing

**Expected Outcome:** International customers can pay in local currency

---

### 7.4 Coupon/Discount Codes (Future)

If Zaprite supports coupons:

- [ ] Create promotional coupons:
  - `LAUNCH50` - 50% off first month
  - `ANNUAL25` - 25% off annual plan
  - `REFER20` - 20% off for referred users
- [ ] Set expiration dates
- [ ] Set usage limits (single-use, multi-use)
- [ ] Track coupon redemption rates
- [ ] Apply coupon to order before creating Zaprite payment

**Expected Outcome:** Promotional pricing available

---

## Phase 8: Documentation & Handoff

### 8.1 Internal Documentation

Create/update the following documents:

- [ ] **Zaprite Integration Guide** (this checklist)
- [ ] **API Endpoint Documentation**
  - `/api/subscriptions/subscribe`
  - `/api/subscriptions/bundles/purchase`
  - `/api/webhooks/zaprite/subscription`
- [ ] **Database Schema Documentation**
  - `subscription_bundles` table
  - `user_gift_subscriptions` table
  - `payment_records` table (if exists)
- [ ] **Runbook for Common Issues**
  - Webhook not received
  - Payment successful but no subscription
  - Duplicate subscription activations
- [ ] **Environment Variables Reference**
- [ ] **Disaster Recovery Plan**
  - What if Zaprite goes down?
  - Manual subscription grant process
  - Backup payment processor

**Expected Outcome:** Team can troubleshoot without external help

---

### 8.2 Support Team Training

- [ ] Train support team on:
  - Viewing payments in Zaprite dashboard
  - Verifying subscription status
  - Manually granting subscriptions (if payment processed but webhook failed)
  - Issuing refunds
  - Handling gift code issues
- [ ] Create support scripts/macros
- [ ] Document escalation process

**Expected Outcome:** Support team self-sufficient

---

### 8.3 Developer Handoff Checklist

If handing off to another developer:

- [ ] All API credentials shared securely (password manager)
- [ ] Zaprite dashboard access granted
- [ ] Codebase walk-through completed
- [ ] Webhook testing demonstrated
- [ ] Database schema explained
- [ ] Gift code generation process reviewed
- [ ] Referral tracking system explained
- [ ] Known issues/bugs documented
- [ ] Future enhancements roadmap shared

**Expected Outcome:** New developer can maintain/extend integration

---

## Testing Cheat Sheet

### Quick Test: Individual Subscription

```bash
# 1. Create test order
curl -X POST https://api.zaprite.com/v1/order \
  -H "Authorization: Bearer $ZAPRITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ZAPRITE_ORG_ID'",
    "amount": 18.99,
    "currency": "USD",
    "description": "Test Monthly Subscription",
    "metadata": {"userId": "999", "tier": "monthly"}
  }'

# 2. Open returned checkoutUrl in browser
# 3. Complete payment
# 4. Verify webhook received:
tail -f /var/log/app/webhooks.log | grep zaprite

# 5. Check database:
psql $DATABASE_URL -c "SELECT is_subscribed, subscription_expires_at FROM players WHERE player_id = 999;"
```

### Quick Test: Bundle Purchase

```bash
# 1. Purchase 5-Pack bundle (same API call, different metadata)
# 2. Complete payment
# 3. Check gift codes generated:
psql $DATABASE_URL -c "SELECT gift_code, is_redeemed FROM user_gift_subscriptions WHERE owner_user_id = 999;"

# Should return 5 codes
```

### Quick Test: Gift Code Redemption

```bash
# 1. Get a code from above query
# 2. Redeem via API:
curl -X POST https://app.proofofputt.com/api/subscriptions/redeem-gift-code \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"giftCode": "GIFT-ABC123"}'

# 3. Verify subscription activated
# 4. Verify code marked as redeemed
```

---

## Troubleshooting Guide

### Issue: "API Key Invalid"

**Symptoms:** 401 Unauthorized from Zaprite API

**Solutions:**
- [ ] Verify API key is correct (copy-paste from Zaprite dashboard)
- [ ] Check environment variable loaded: `echo $ZAPRITE_API_KEY`
- [ ] Verify using correct key (test vs. live)
- [ ] Check for extra whitespace in environment variable
- [ ] Regenerate API key if necessary

---

### Issue: "Webhook Not Received"

**Symptoms:** Payment succeeds but subscription not activated

**Solutions:**
- [ ] Check webhook URL is accessible publicly (use curl from external server)
- [ ] Verify HTTPS certificate valid
- [ ] Check firewall/security groups allow Zaprite IPs
- [ ] Review webhook logs in Zaprite dashboard
- [ ] Verify webhook endpoint returns 200 status code
- [ ] Check application logs for errors processing webhook
- [ ] Manually trigger test webhook from Zaprite

**Manual Fix:**
```sql
-- Manually activate subscription if payment verified
UPDATE players
SET is_subscribed = true,
    subscription_expires_at = NOW() + INTERVAL '1 month'
WHERE player_id = 123;
```

---

### Issue: "Duplicate Subscription Activations"

**Symptoms:** Webhook received multiple times, subscription date doubled

**Solutions:**
- [ ] Implement idempotency check:
  ```javascript
  // Check if order ID already processed
  const existing = await db.query(
    'SELECT * FROM processed_webhooks WHERE order_id = $1',
    [orderId]
  );
  if (existing.rows.length > 0) {
    return res.status(200).json({ message: 'Already processed' });
  }
  ```
- [ ] Log all webhook receipts with unique ID
- [ ] Use database transactions for webhook processing

---

### Issue: "Gift Codes Not Appearing"

**Symptoms:** Bundle purchased but no codes in Settings

**Solutions:**
- [ ] Verify webhook processed successfully (check logs)
- [ ] Check database: `SELECT * FROM user_gift_subscriptions WHERE owner_user_id = 123;`
- [ ] Verify metadata in Zaprite order includes `bundleQuantity`
- [ ] Check frontend API call to `/api/subscriptions/gifts/`
- [ ] Verify user logged in as correct account

---

## Maintenance Schedule

### Daily
- [ ] Review webhook error logs
- [ ] Check for failed payments
- [ ] Monitor Zaprite dashboard for anomalies

### Weekly
- [ ] Reconcile payments vs. subscriptions
- [ ] Review support tickets related to payments
- [ ] Check gift code redemption rates

### Monthly
- [ ] Review subscription metrics (conversions, churn)
- [ ] Analyze bundle purchase patterns
- [ ] Update pricing if needed
- [ ] Review and optimize Zaprite fees

### Quarterly
- [ ] Full security audit of payment flow
- [ ] Review and update Terms of Service
- [ ] Evaluate alternative payment processors
- [ ] Analyze customer payment preferences (BTC vs. Card)

---

## Success Criteria

### Configuration Complete When:
- [ ] ✅ All environment variables set and verified
- [ ] ✅ Webhooks receiving events and processing correctly
- [ ] ✅ Individual subscriptions can be purchased end-to-end
- [ ] ✅ Bundle purchases generate correct number of gift codes
- [ ] ✅ Gift codes can be redeemed successfully
- [ ] ✅ Referral tracking dashboard shows accurate data
- [ ] ✅ Error scenarios handled gracefully
- [ ] ✅ Logs provide complete audit trail
- [ ] ✅ Support team trained and confident
- [ ] ✅ Documentation complete and accessible

---

## Resources

### Zaprite Documentation
- API Reference: https://docs.zaprite.com/api (check actual URL)
- Webhook Events: https://docs.zaprite.com/webhooks
- Payment Methods: https://docs.zaprite.com/payment-methods
- Security Best Practices: https://docs.zaprite.com/security

### Proof of Putt Documentation
- Customer Journey: `/CUSTOMER_JOURNEY_SUBSCRIPTIONS.md`
- Gift Code Admin Guide: `/GIFT_CODE_ADMIN_GUIDE.md`
- API Endpoint Documentation: `/API_DOCUMENTATION.md` (if exists)
- Database Schema: `/database/README.md` (if exists)

### Support Contacts
- Zaprite Support: support@zaprite.com (verify actual email)
- Zaprite Status Page: https://status.zaprite.com (if available)
- Development Team: [Internal contact]
- Database Admin: [Internal contact]

---

## Appendix: Environment Variable Template

Create `.env.production` file (DO NOT COMMIT):

```bash
# Zaprite Payment Processor
ZAPRITE_API_KEY=zprt_live_your_actual_api_key_here
ZAPRITE_ORG_ID=org_your_actual_org_id_here
ZAPRITE_BASE_URL=https://api.zaprite.com
ZAPRITE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here

# Database
DATABASE_URL=postgresql://user:password@host:5432/proofofputt

# Application
NODE_ENV=production
API_BASE_URL=https://app.proofofputt.com/api

# Admin (for gift code generation)
ADMIN_TOKEN=your_secure_admin_token_here
```

---

**Last Updated:** 2025-01-07
**Version:** 1.0
**Maintained By:** Development Team
**Status:** ✅ Ready for Production Setup
