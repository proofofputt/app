# Customer Journey: Subscription Upgrades & Bundle Purchases

## Overview

This document defines the expected customer journey for users upgrading to Full Subscriber tier and purchasing subscription bundles in Proof of Putt. It covers all entry points, decision paths, payment flows, and post-purchase experiences.

---

## Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW USER REGISTRATION                         │
│  Entry Points: Direct sign-up, Referral link, Gift code invite │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      FREE TIER USER                              │
│  • Limited session access                                        │
│  • Basic features unlocked                                       │
│  • Can view leaderboards, duels, leagues (limited participation)│
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  UPGRADE TRIGGERS │
                    └─────────────────┘
                              ↓
        ┌────────────────────┬────────────────────┬──────────────────┐
        │                    │                    │                  │
        ▼                    ▼                    ▼                  ▼
  ┌──────────┐         ┌──────────┐        ┌──────────┐      ┌──────────┐
  │ Settings │         │ Feature  │        │ Gift Code│      │ Intro    │
  │ Page     │         │ Paywall  │        │ Redeem   │      │ Offer    │
  └──────────┘         └──────────┘        └──────────┘      └──────────┘
        │                    │                    │                  │
        └────────────────────┴────────────────────┴──────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION DECISION POINT                         │
│  User chooses between:                                           │
│  1. Individual Subscription (Monthly/Annual)                     │
│  2. Bundle Purchase (for gifting)                                │
│  3. Gift Code Redemption (free upgrade)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────┐                    ┌──────────────────────┐
│ PATH A:          │                    │ PATH B:              │
│ INDIVIDUAL       │                    │ BUNDLE PURCHASE      │
│ SUBSCRIPTION     │                    │ (For Gifting)        │
└──────────────────┘                    └──────────────────────┘
        │                                           │
        ▼                                           ▼
  [See Path A]                              [See Path B]
```

---

## Path A: Individual Subscription Upgrade

### 1. Entry Points

**A. Settings Page (Primary)**
- Location: `Settings > Manage Subscription`
- User sees:
  - Current tier: "Free Tier"
  - Subscription status: "Not subscribed"
  - Clear upgrade options with pricing

**B. Feature Paywall (Contextual)**
- Triggered when user attempts to:
  - Create unlimited practice sessions
  - Join premium leagues
  - Access advanced analytics
  - Use computer vision features (desktop app)
- Modal displays:
  - Feature being blocked
  - "Upgrade to Full Subscriber" CTA
  - Pricing comparison

**C. Intro Offer (New Users)**
- Shown to new registrations (first 7 days)
- Special discounted rate for first year
- Time-limited urgency messaging

### 2. Upgrade Decision

User views pricing options:

```
┌──────────────────────────────────────────┐
│     SUBSCRIPTION PLANS                    │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────┐    ┌──────────────┐   │
│  │   Monthly    │    │    Annual    │   │
│  │   $18.99/mo  │    │  $189/year   │   │
│  │              │    │  Save 17%    │   │
│  │  [Subscribe] │    │  [Subscribe] │   │
│  └──────────────┘    └──────────────┘   │
│                                           │
│         OR                                │
│                                           │
│  Have a Gift Code? [Redeem Code]         │
└──────────────────────────────────────────┘
```

**Key Information Displayed:**
- Monthly: $18.99/month
- Annual: $189/year (17% savings)
- Features included:
  - Unlimited practice sessions
  - Full competition access
  - Advanced analytics
  - Computer vision tracking
  - OpenTimestamps certificates
  - Priority support

### 3. Payment Flow (Zaprite)

**Step 1: User clicks "Subscribe"**
- Frontend: `POST /api/subscriptions/subscribe`
- Backend creates Zaprite order
- Returns checkout URL

**Step 2: Redirect to Zaprite**
- User chooses payment method:
  - Bitcoin (Lightning/On-chain)
  - Credit/Debit Card
  - Other crypto
- Zaprite handles all payment processing

**Step 3: Payment Completion**
- Zaprite webhook notifies backend: `POST /api/webhooks/zaprite/subscription`
- Backend processes:
  ```javascript
  - Verify payment status
  - Update player record:
    - is_subscribed = true
    - subscription_tier = 'full_subscriber'
    - subscription_expires_at = NOW() + 1 year (or 1 month)
  - Grant access to premium features
  - Send confirmation email (if available)
  ```

**Step 4: Redirect to Success**
- User returns to Settings page
- Updated subscription status displays:
  - "Full Subscriber"
  - Expiration date
  - Renewal information

### 4. Post-Upgrade Experience

**Immediate Changes:**
- All feature paywalls removed
- Access to unlimited sessions
- Can create/join leagues
- Desktop app CV features unlocked
- Profile badge shows "Full Subscriber"

**Ongoing:**
- Monthly/Annual renewal reminders
- Usage analytics tracking
- Subscription management in Settings

---

## Path B: Bundle Purchase (For Gifting)

### 1. Entry Point

**Settings Page Only**
- Location: `Settings > Manage Subscription > Purchase Bundles`
- Displayed below individual subscription options

### 2. Bundle Selection

User views bundle options:

```
┌──────────────────────────────────────────────────────────────┐
│           GIFT SUBSCRIPTION BUNDLES                           │
│  Purchase multiple 1-year subscriptions to share with others │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 3-Pack   │  │ 5-Pack   │  │ 10-Pack  │  │ 21-Pack  │    │
│  │          │  │          │  │          │  │          │    │
│  │ $56.70   │  │ $84      │  │ $121     │  │ $221     │    │
│  │ Save 10% │  │ Save 21% │  │ Save 42% │  │ Save 50% │    │
│  │          │  │          │  │          │  │          │    │
│  │[Purchase]│  │[Purchase]│  │[Purchase]│  │[Purchase]│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                               │
│  Each pack = Multiple 1-year Full Subscriber codes           │
│  $21/year per code in 21-Pack (best value!)                 │
└──────────────────────────────────────────────────────────────┘
```

**Bundle Details:**
- 3-Pack: 3 codes × $18.90 = $56.70 (10% discount)
- 5-Pack: 5 codes × $16.80 = $84 (21% discount)
- 10-Pack: 10 codes × $12.10 = $121 (42% discount)
- 21-Pack: 21 codes × $10.52 = $221 (50% discount)

### 3. Payment Flow (Zaprite)

**Step 1: User clicks "Purchase Bundle"**
- Frontend: `POST /api/subscriptions/bundles/purchase`
  ```javascript
  {
    "bundleId": 2,  // 5-Pack
    "userId": 123
  }
  ```
- Backend creates Zaprite order:
  ```javascript
  {
    "amount": 84,
    "currency": "USD",
    "description": "Proof of Putt 5-Pack Bundle - 5 Year Subscriptions",
    "metadata": {
      "userId": "123",
      "bundleId": "2",
      "bundleQuantity": "5",
      "type": "bundle"
    }
  }
  ```

**Step 2: Zaprite Checkout**
- User redirected to Zaprite payment page
- Same payment options as individual subscription

**Step 3: Payment Completion**
- Zaprite webhook: `POST /api/webhooks/zaprite/subscription`
- Backend processes bundle payment:
  ```javascript
  // Extract metadata
  const { userId, bundleId, bundleQuantity } = metadata;

  // Generate gift codes
  for (let i = 0; i < bundleQuantity; i++) {
    const giftCode = generateGiftCode();
    await db.query(
      `INSERT INTO user_gift_subscriptions
       (owner_user_id, bundle_id, gift_code, is_redeemed, created_at)
       VALUES ($1, $2, $3, false, NOW())`,
      [userId, bundleId, giftCode]
    );
  }

  // Return success
  ```

**Step 4: Access Gift Codes**
- User returns to Settings page
- New section appears: "Free Year Invites"
- Displays all unredeemed gift codes with send functionality

### 4. Gift Code Distribution

**User's View (Settings Page):**

```
┌──────────────────────────────────────────────┐
│         FREE YEAR INVITES                     │
├──────────────────────────────────────────────┤
│                                               │
│  Gift Code: GIFT-A3F2B1E4-001                │
│  ┌────────────────────────┐                  │
│  │ Phone/Email: _________ │  [Send]          │
│  └────────────────────────┘                  │
│                                               │
│  Gift Code: GIFT-B8D9C5F1-002                │
│  ┌────────────────────────┐                  │
│  │ Phone/Email: _________ │  [Send]          │
│  └────────────────────────┘                  │
│                                               │
│  Gift Code: GIFT-C4E7A2D8-003  [Redeemed ✓] │
│                                               │
└──────────────────────────────────────────────┘
```

**Distribution Methods:**
1. **Direct Share (Manual)**
   - User copies gift code
   - Shares via any channel (text, email, social)
   - Recipient manually enters code

2. **In-App Send (Automated)**
   - User enters recipient phone/email
   - System tracks send attempt
   - Recipient receives notification (future: email/SMS integration)

### 5. Referral Tracking

Bundle purchaser can track gift code usage:

```
┌──────────────────────────────────────────────┐
│       REFERRALS DASHBOARD                     │
├──────────────────────────────────────────────┤
│                                               │
│  Total Invites Sent:        5                │
│  Viewed Invites:            3                │
│  Accounts Created:          2                │
│  Upgraded to Subscriber:    2                │
│                                               │
│  Recent Invites:                             │
│  ┌──────────────────────────────────────┐   │
│  │ Recipient    │ Status    │ Redeemed  │   │
│  ├──────────────────────────────────────┤   │
│  │ john@ex.com  │ Viewed    │ Yes       │   │
│  │ jane@ex.com  │ Pending   │ No        │   │
│  │ +1234567890  │ Accepted  │ Yes       │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

---

## Path C: Gift Code Redemption

### 1. Entry Points

**A. Direct URL (from recipient)**
- `https://app.proofofputt.com/register?gift_code=GIFT-ABC123`
- Pre-fills code on registration
- Auto-applies on account creation

**B. Settings Page**
- Location: `Settings > Manage Subscription > Have a Gift Code?`
- Input field for manual entry

**C. Invitation Link (from sender)**
- Sender shares link with embedded code
- Recipient clicks, lands on registration with pre-filled code

### 2. Redemption Flow

**Step 1: User enters gift code**
- Frontend: `POST /api/subscriptions/redeem-gift-code`
  ```javascript
  {
    "giftCode": "GIFT-A3F2B1E4-001",
    "userId": 456  // or from auth token
  }
  ```

**Step 2: Backend validation**
```javascript
// Check gift code exists
const giftCode = await db.query(
  'SELECT * FROM user_gift_subscriptions WHERE gift_code = $1',
  [code]
);

// Validate not already redeemed
if (giftCode.is_redeemed) {
  return error('Gift code already used');
}

// Apply subscription
await db.query('BEGIN');

// Update gift code
await db.query(
  `UPDATE user_gift_subscriptions
   SET is_redeemed = true,
       redeemed_by_user_id = $1,
       redeemed_at = NOW()
   WHERE gift_code = $2`,
  [userId, code]
);

// Update player subscription
await db.query(
  `UPDATE players
   SET is_subscribed = true,
       subscription_tier = 'full_subscriber',
       subscription_expires_at = NOW() + INTERVAL '1 year'
   WHERE player_id = $1`,
  [userId]
);

await db.query('COMMIT');
```

**Step 3: Success confirmation**
- User sees success message
- Subscription status updates immediately
- Redirect to dashboard or Settings

### 3. Post-Redemption

**User Experience:**
- Immediate Full Subscriber access
- Welcome message/notification
- Access to all premium features
- 1-year subscription validity

**Gift Code Sender Notification:**
- Referrals Dashboard updates
- Shows code was redeemed
- Links to new subscriber (if privacy settings allow)

---

## Use Case Scenarios

### Scenario 1: Individual User Upgrade (Monthly)

**Context:** John is a casual putter who wants to track his progress

**Journey:**
1. Signs up for free account
2. Creates 2-3 practice sessions (hits limit)
3. Sees paywall: "Upgrade to continue tracking unlimited sessions"
4. Clicks "Upgrade Now"
5. Chooses Monthly ($18.99/month)
6. Pays via credit card through Zaprite
7. Returns to app, creates unlimited sessions
8. Receives monthly renewal reminder

**Duration:** 3-5 minutes

---

### Scenario 2: Golf Pro Purchases Bundle for Students

**Context:** Sarah is a golf instructor with 8 students

**Journey:**
1. Already a Full Subscriber herself
2. Navigates to Settings > Manage Subscription
3. Scrolls to "Purchase Bundles"
4. Selects 10-Pack ($121, best value for 8 students + 2 extras)
5. Pays via Bitcoin Lightning through Zaprite
6. Receives 10 gift codes in "Free Year Invites" section
7. Shares codes with students via text message
8. Tracks redemptions in Referrals Dashboard
9. Students redeem codes, get 1-year Full Subscriber access

**Duration:** 5-10 minutes for purchase, ongoing for distribution

---

### Scenario 3: Partnership Bundle Generation (Admin)

**Context:** Partnership with "Pebble Beach Golf Club" for 21 members

**Journey:**
1. Admin runs CLI script:
   ```bash
   node scripts/generate-gift-bundle.js \
     --user-id=999 \
     --bundle-id=4 \
     --label="PARTNERSHIP-PEBBLEBEACH" \
     --reason="Annual partnership agreement 2025"
   ```
2. Script generates 21 codes:
   - `PARTNERSHIP-PEBBLEBEACH-A3F2B1E4-001`
   - `PARTNERSHIP-PEBBLEBEACH-B8D9C5F1-002`
   - ... (19 more)
3. Club admin (user 999) sees codes in Settings
4. Distributes to members via club newsletter
5. Members redeem codes at registration or in Settings
6. Admin tracks usage via Referrals Dashboard

**Duration:** 2 minutes for admin, ongoing for distribution

---

### Scenario 4: New User with Gift Code

**Context:** Mike receives gift code from friend Jane

**Journey:**
1. Jane (Full Subscriber with 5-Pack) goes to Settings
2. Enters Mike's email in "Free Year Invites"
3. Clicks "Send" (code: `GIFT-C4E7A2D8-003`)
4. Mike receives link (future: email notification)
5. Clicks link, lands on registration page
6. Creates account (code auto-applied)
7. Account created with Full Subscriber status
8. Mike starts using premium features immediately
9. Jane sees "Redeemed ✓" in her Referrals Dashboard

**Duration:** 2-3 minutes for Mike, instant for Jane

---

## Technical Integration Points

### Frontend Components

**Settings Page (`SettingsPage.jsx`):**
- Subscription status display
- Individual subscription options (Monthly/Annual)
- Bundle purchase cards (3/5/10/21-Pack)
- Gift code redemption input
- Free Year Invites section (for bundle purchasers)
- Referrals Dashboard

**API Endpoints:**

```javascript
// Individual subscription
POST /api/subscriptions/subscribe
{
  "tier": "monthly" | "annual",
  "userId": number
}
→ Returns: { checkoutUrl, orderId }

// Bundle purchase
POST /api/subscriptions/bundles/purchase
{
  "bundleId": 1-4,
  "userId": number
}
→ Returns: { checkoutUrl, orderId }

// Gift code redemption
POST /api/subscriptions/redeem-gift-code
{
  "giftCode": string,
  "userId": number
}
→ Returns: { success, expiresAt }

// Send gift invitation
POST /api/subscriptions/gifts/send
{
  "giftCodeId": number,
  "recipient": string (email/phone)
}
→ Returns: { success, sentAt }

// Referral stats
GET /api/referrals/stats
→ Returns: {
    totalInvites, viewed, rejected,
    accountsCreated, upgraded, invites[]
  }
```

### Webhook Handlers

**Zaprite Subscription Webhook:**
```javascript
POST /api/webhooks/zaprite/subscription

Handles:
- Payment confirmation
- Subscription activation
- Bundle code generation
- Error handling and retries
```

### Database Tables

**Key Tables:**
- `players` - subscription status, tier, expiration
- `subscription_bundles` - bundle definitions (3/5/10/21-Pack)
- `user_gift_subscriptions` - individual gift codes
- `gift_code_sends` - tracking invitation sends
- `sessions` - auth tokens for API access

---

## Key Metrics to Track

### Subscription Conversions
- Free → Paid conversion rate
- Monthly vs Annual split
- Average time to upgrade (days from registration)
- Paywall trigger effectiveness

### Bundle Performance
- Most popular bundle size
- Bundle purchase conversion rate
- Average codes redeemed per bundle
- Time to full bundle redemption

### Referral Effectiveness
- Gift code redemption rate
- Referred user retention
- Viral coefficient (invites sent per purchaser)
- Time from send to redemption

### Revenue Metrics
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (LTV)
- Churn rate

---

## Future Enhancements

### Phase 1 (Current State)
✅ Manual gift code sharing
✅ Zaprite payment integration
✅ Basic referral tracking
✅ Admin CLI for partnership bundles

### Phase 2 (Near-term)
- [ ] Email/SMS notifications for gift code sends
- [ ] In-app notification when code is redeemed
- [ ] Gift code expiration dates
- [ ] Bulk import for large partnerships (CSV)

### Phase 3 (Mid-term)
- [ ] Subscription pause/resume functionality
- [ ] Team/organization pricing tiers
- [ ] Referral rewards program
- [ ] QR codes for event-based redemptions

### Phase 4 (Long-term)
- [ ] White-label partnership portals
- [ ] Automated renewal management
- [ ] Usage-based pricing tiers
- [ ] Enterprise SSO integration

---

## Support & Troubleshooting

### Common Issues

**"Gift code already redeemed"**
- Check code hasn't been used
- Verify code was typed correctly (case-sensitive)
- Contact support if purchased but shows redeemed

**"Payment successful but no subscription"**
- Check Zaprite webhook logs
- Verify player record in database
- Manual subscription grant if needed

**"Can't see my gift codes"**
- Verify bundle payment completed
- Check user_gift_subscriptions table
- Ensure owner_user_id matches logged-in user

### Admin Actions

**Manually grant subscription:**
```sql
UPDATE players
SET is_subscribed = true,
    subscription_tier = 'full_subscriber',
    subscription_expires_at = NOW() + INTERVAL '1 year'
WHERE player_id = 123;
```

**Check gift code status:**
```sql
SELECT * FROM user_gift_subscriptions
WHERE gift_code = 'GIFT-ABC123';
```

**Generate partnership bundle:**
```bash
node scripts/generate-gift-bundle.js \
  --user-id=123 \
  --bundle-id=4 \
  --label="CUSTOM-LABEL" \
  --reason="Partnership agreement"
```

---

## Appendix: Payment Flow Diagrams

### Individual Subscription Flow

```
User clicks "Subscribe" (Monthly/Annual)
        ↓
Frontend calls /api/subscriptions/subscribe
        ↓
Backend creates Zaprite order
        ↓
Zaprite returns checkout URL
        ↓
User redirected to Zaprite
        ↓
User completes payment (BTC/Card)
        ↓
Zaprite webhook → /api/webhooks/zaprite/subscription
        ↓
Backend updates player record
        ↓
User redirected to success page
        ↓
Subscription status updated in UI
```

### Bundle Purchase Flow

```
User clicks "Purchase Bundle" (3/5/10/21-Pack)
        ↓
Frontend calls /api/subscriptions/bundles/purchase
        ↓
Backend creates Zaprite order with metadata
        ↓
User completes Zaprite payment
        ↓
Webhook processes bundle purchase
        ↓
Generate N gift codes (N = bundle quantity)
        ↓
Insert codes into user_gift_subscriptions table
        ↓
User sees codes in "Free Year Invites" section
        ↓
User distributes codes to recipients
        ↓
Recipients redeem → Full Subscriber access
```

---

## Contact & Support

For questions about the subscription journey:
- Technical issues: Review API logs and database records
- Payment issues: Check Zaprite dashboard
- Gift code issues: Query user_gift_subscriptions table
- Partnership requests: Use admin CLI scripts

---

**Last Updated:** 2025-01-07
**Version:** 1.0
**Maintained By:** Development Team
