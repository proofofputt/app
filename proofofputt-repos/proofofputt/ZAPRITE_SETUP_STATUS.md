# Zaprite Payment Setup - Status & Testing Guide

**Last Updated:** 2025-10-10
**Status:** Ready for Testing

---

## ✅ Completed Setup

### 1. Payment Links Created in Zaprite
All payment links are active and configured:

| Product | Price | URL |
|---------|-------|-----|
| Lifetime Subscription | TBD | https://pay.zaprite.com/pl_NC6B3oH3dJ |
| 3-Pack Bundle | $56.70 | https://pay.zaprite.com/pl_5GiV3AIMVc |
| 5-Pack Bundle | $84 | https://pay.zaprite.com/pl_sLPDlcXmej |
| 10-Pack Bundle | $121 | https://pay.zaprite.com/pl_qwz5BPb1Th |
| 21-Pack Bundle | $221 | https://pay.zaprite.com/pl_c5uK0HOPlu |

**Redirect URL:** All set to `https://app.proofofputt.com/settings` ✅

### 2. Payment Methods Configured
- ⚡ Lightning Network (Bitcoin)
- 🟠 Bitcoin On-Chain
- 💳 Square (Credit/Debit Cards)

### 3. Code Changes Completed
- ✅ Simplified gift codes empty state message
- ✅ Created admin endpoint `/api/admin/subscriptions/grant-direct.js` for direct subscription grants
- ✅ Bundle purchase endpoint exists at `/api/subscriptions/bundles/purchase.js`
- ✅ Gift codes endpoint exists at `/api/subscriptions/gifts.js`

---

## 🔧 Current Issue: Bundle Purchase 500 Error

### Error Details
When clicking "Purchase Bundle" on the Settings page:
- **Error:** 500 Internal Server Error
- **Endpoint:** `/api/subscriptions/bundles/purchase`
- **Bundle ID:** 1 (3-Pack)

### Possible Causes

1. **Missing Zaprite Environment Variables**
   The endpoint requires these environment variables:
   ```
   ZAPRITE_API_KEY=zprt_live_...
   ZAPRITE_ORG_ID=org_...
   ZAPRITE_BASE_URL=https://api.zaprite.com
   ```

2. **Zaprite API Response Format**
   The code expects a `checkoutUrl` field in the response, but Zaprite might return a different field name.

3. **Database Connection Issue**
   The endpoint queries the database to verify the user's session token.

### How to Diagnose

**Option 1: Check Vercel Environment Variables**
```bash
vercel env ls
```
Verify that `ZAPRITE_API_KEY`, `ZAPRITE_ORG_ID`, and `ZAPRITE_BASE_URL` are set for production.

**Option 2: Check Vercel Function Logs**
```bash
vercel logs production
```
Look for lines like:
- "Creating Zaprite order: ..."
- "Zaprite response status: ..."
- "Zaprite response data: ..."

**Option 3: Test Locally**
```bash
cd app
npm run dev
# Then try bundle purchase in browser
```
Check console logs for detailed error messages.

---

## 🧪 Testing Checklist

### Test 1: Environment Variables
```bash
# Check if variables are set
vercel env ls

# If missing, add them:
vercel env add ZAPRITE_API_KEY production
vercel env add ZAPRITE_ORG_ID production
vercel env add ZAPRITE_BASE_URL production
```

### Test 2: Bundle Purchase Flow

1. **Login** to https://app.proofofputt.com
2. **Navigate** to Settings page
3. **Click** "Purchase Bundle" for 3-Pack ($56.70)
4. **Expected Result:** Redirect to Zaprite checkout page
5. **Actual Result:** 500 error (needs fixing)

**What Should Happen:**
1. Click "Purchase Bundle" → API creates Zaprite order
2. API returns `checkoutUrl`
3. Browser redirects to Zaprite payment page
4. User completes payment
5. Zaprite webhook fires → Gift codes generated
6. User redirected back to `/settings`
7. Gift codes appear in "Free Year Invites" section

### Test 3: Gift Codes Loading

1. **Login** to https://app.proofofputt.com
2. **Navigate** to Settings page
3. **Check** "Free Year Invites" section
4. **Expected:** Shows "You don't have any gift codes yet." (if no codes)
5. **Endpoint:** `/api/subscriptions/gifts`

**To Test with Existing Codes:**
If you have gift codes in the database, they should appear here with:
- Gift code string
- "Send" button for unredeemed codes
- "Redeemed" badge for redeemed codes

### Test 4: Admin Direct Grant

Use this to grant subscriptions without gift codes:

```bash
curl -X POST https://app.proofofputt.com/api/admin/subscriptions/grant-direct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "playerId": 1009,
    "duration": "1 year",
    "reason": "Testing direct grant"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully granted 1 year subscription to player 1009",
  "data": {
    "playerId": 1009,
    "email": "user@example.com",
    "displayName": "User Name",
    "duration": "1 year",
    "reason": "Testing direct grant"
  }
}
```

---

## 🔍 Debugging Steps

### Step 1: Check Zaprite API Credentials

**In Zaprite Dashboard:**
1. Go to https://app.zaprite.com
2. Navigate to Settings → API
3. Verify API Key is active
4. Copy Organization ID

**In Vercel:**
```bash
# Check current values (will show if they exist, not the actual values)
vercel env ls

# If missing or incorrect, update:
vercel env rm ZAPRITE_API_KEY production
vercel env add ZAPRITE_API_KEY production
# Enter the actual key when prompted

vercel env rm ZAPRITE_ORG_ID production
vercel env add ZAPRITE_ORG_ID production
# Enter your org ID (e.g., cmgbcd9d80008l104g3tasx06)
```

### Step 2: Test Zaprite API Directly

```bash
curl -X POST https://api.zaprite.com/v1/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ZAPRITE_API_KEY" \
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "amount": 56.70,
    "currency": "USD",
    "description": "Test Order - 3-Pack Bundle",
    "metadata": {
      "test": "true"
    }
  }'
```

**Expected Response:**
Should return JSON with a `checkoutUrl` or similar field.

### Step 3: Check Database Query

The bundle purchase endpoint queries:
```sql
SELECT player_id, email, display_name
FROM players
WHERE player_id = (
  SELECT player_id FROM sessions WHERE token = $1 LIMIT 1
)
```

**Verify session exists:**
```sql
-- Get your token from browser localStorage
-- Then check if session exists
SELECT * FROM sessions WHERE token = 'your_token_here';
```

### Step 4: Enable Debug Logging

The endpoint already has console.log statements. Check Vercel function logs:

```bash
vercel logs production --follow
```

Then try bundle purchase again and watch for:
- "Creating Zaprite order: ..."
- "Zaprite response status: ..."
- "Zaprite response data: ..."

---

## 🛠️ Quick Fixes

### Fix 1: Add Missing Environment Variable

If `ZAPRITE_BASE_URL` is missing:
```bash
vercel env add ZAPRITE_BASE_URL production
# Enter: https://api.zaprite.com
```

### Fix 2: Check Zaprite API Endpoint

The code uses `${ZAPRITE_BASE_URL}/v1/order`. Verify this is the correct Zaprite API endpoint.

According to Zaprite docs, it might be:
- `/v1/order` ✅
- `/v1/orders` ❓
- `/api/v1/order` ❓

### Fix 3: Update Zaprite Response Handling

If Zaprite returns a different field name, update lines 110-114 in `purchase.js`:

```javascript
// Current code checks these fields:
const checkoutUrl = zapriteData.checkoutUrl ||
                   zapriteData.checkout_url ||
                   zapriteData.url ||
                   zapriteData.paymentUrl ||
                   zapriteData.payment_url;
```

Add more field names if needed based on actual Zaprite response.

---

## 📊 Success Criteria

When everything is working:

1. ✅ Bundle purchase redirects to Zaprite checkout
2. ✅ Payment completes successfully
3. ✅ Webhook receives payment confirmation
4. ✅ Gift codes generated in database
5. ✅ User sees gift codes in Settings page
6. ✅ User can share gift codes
7. ✅ Recipients can redeem gift codes
8. ✅ Admin can grant subscriptions directly

---

## 🎯 Next Steps

1. **Diagnose 500 error:**
   - Check Vercel logs for detailed error
   - Verify environment variables
   - Test Zaprite API directly

2. **Fix the error:**
   - Add missing env vars if needed
   - Update API endpoint if incorrect
   - Handle different Zaprite response format if needed

3. **Test end-to-end:**
   - Bundle purchase → Payment → Gift codes generated
   - Gift code sharing → Redemption → Subscription activated

4. **Configure webhook:**
   - URL: `https://app.proofofputt.com/api/webhooks/zaprite-subscription`
   - Events: `payment.succeeded`, `order.paid`

5. **Document for future:**
   - Payment link reference (already created in `ZAPRITE_PAYMENT_LINKS.md`)
   - Admin procedures for direct grants
   - Troubleshooting guide for common issues

---

## 📞 Support Checklist

If you need help from Zaprite support:

**Information to provide:**
- Organization ID: cmgbcd9d80008l104g3tasx06
- API endpoint being called: `/v1/order`
- Request payload: (see `purchase.js` lines 67-83)
- Error message: (from Vercel logs)
- Expected response format: Need `checkoutUrl` field

**Questions to ask:**
1. What is the correct API endpoint for creating payment orders?
2. What fields are returned in a successful order response?
3. How should we structure the request payload for bundle purchases?
4. Do you have any rate limits or special requirements?

---

**Document Status:** ✅ Complete - Ready for Testing
**Last Updated:** 2025-10-10
**Maintained By:** Development Team
