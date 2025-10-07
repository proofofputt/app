# Zaprite API Quick Reference

## 🔑 Your Configuration

```bash
ZAPRITE_API_KEY=342ea623-1169-4633-9bd4-ba582be44d23
ZAPRITE_ORG_ID=cmgbcd9d80008l104g3tasx06
ZAPRITE_BASE_URL=https://api.zaprite.com
```

---

## 📡 Create Order Endpoint

### Request

```http
POST https://api.zaprite.com/v1/order
Content-Type: application/json
Authorization: Bearer 342ea623-1169-4633-9bd4-ba582be44d23
```

### Monthly Subscription ($2.10)

```json
{
  "organizationId": "cmgbcd9d80008l104g3tasx06",
  "customerId": "user-123",
  "customerEmail": "user@example.com",
  "customerName": "John Doe",
  "amount": 2.10,
  "currency": "USD",
  "description": "Proof of Putt Monthly Subscription",
  "metadata": {
    "userId": "123",
    "interval": "monthly",
    "includesGift": "false"
  },
  "successUrl": "https://app.proofofputt.com/subscription/success?session_id={ORDER_ID}",
  "cancelUrl": "https://app.proofofputt.com/settings?canceled=true"
}
```

### Annual Subscription ($21 + Free Gift)

```json
{
  "organizationId": "cmgbcd9d80008l104g3tasx06",
  "customerId": "user-123",
  "customerEmail": "user@example.com",
  "customerName": "John Doe",
  "amount": 21.00,
  "currency": "USD",
  "description": "Proof of Putt Annual Subscription (includes 1 free year gift)",
  "metadata": {
    "userId": "123",
    "interval": "annual",
    "includesGift": "true"
  },
  "successUrl": "https://app.proofofputt.com/subscription/success?session_id={ORDER_ID}",
  "cancelUrl": "https://app.proofofputt.com/settings?canceled=true"
}
```

### Expected Response

```json
{
  "id": "order_abc123xyz456",
  "checkoutUrl": "https://zaprite.com/checkout/xyz789",
  "amount": 21.00,
  "currency": "USD",
  "status": "pending",
  "organizationId": "cmgbcd9d80008l104g3tasx06",
  "customerId": "user-123"
}
```

---

## 🔔 Webhook Events

### Webhook URL to Configure

```
https://app.proofofputt.com/api/webhooks/zaprite-subscription
```

### Event: Order Paid

```json
{
  "event": "order.paid",
  "data": {
    "id": "order_abc123",
    "customerId": "user-123",
    "amount": 21.00,
    "currency": "USD",
    "status": "paid",
    "paidAt": "2025-10-06T12:00:00Z",
    "metadata": {
      "userId": "123",
      "interval": "annual",
      "includesGift": "true"
    }
  }
}
```

**What happens:**
1. Webhook handler updates user:
   - `is_subscribed = TRUE`
   - `subscription_expires_at = NOW() + 1 year`
   - `subscription_tier = 'Full Subscriber'`
2. If annual, generates gift code like `GIFT-A1B2C3D4E5F6`
3. Inserts into `user_gift_subscriptions`

### Event: Order Expired

```json
{
  "event": "order.expired",
  "data": {
    "id": "order_abc123",
    "customerId": "user-123",
    "expiredAt": "2025-10-06T12:30:00Z"
  }
}
```

### Event: Order Cancelled

```json
{
  "event": "order.cancelled",
  "data": {
    "id": "order_abc123",
    "customerId": "user-123",
    "cancelledAt": "2025-10-06T12:15:00Z"
  }
}
```

---

## 🧪 Test with cURL

### Create Monthly Order

```bash
curl -X POST https://api.zaprite.com/v1/order \
  -H "Authorization: Bearer 342ea623-1169-4633-9bd4-ba582be44d23" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "cmgbcd9d80008l104g3tasx06",
    "customerId": "test-user-1",
    "customerEmail": "test@proofofputt.com",
    "customerName": "Test User",
    "amount": 2.10,
    "currency": "USD",
    "description": "Proof of Putt Monthly Subscription",
    "metadata": {
      "userId": "1",
      "interval": "monthly",
      "includesGift": "false"
    },
    "successUrl": "https://app.proofofputt.com/subscription/success",
    "cancelUrl": "https://app.proofofputt.com/settings"
  }'
```

### Create Annual Order

```bash
curl -X POST https://api.zaprite.com/v1/order \
  -H "Authorization: Bearer 342ea623-1169-4633-9bd4-ba582be44d23" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "cmgbcd9d80008l104g3tasx06",
    "customerId": "test-user-1",
    "customerEmail": "test@proofofputt.com",
    "customerName": "Test User",
    "amount": 21.00,
    "currency": "USD",
    "description": "Proof of Putt Annual Subscription",
    "metadata": {
      "userId": "1",
      "interval": "annual",
      "includesGift": "true"
    },
    "successUrl": "https://app.proofofputt.com/subscription/success",
    "cancelUrl": "https://app.proofofputt.com/settings"
  }'
```

---

## 📋 Possible Response Fields

The Zaprite response might include (not all confirmed):

```javascript
{
  id: "order_xxx",              // Order ID
  checkoutUrl: "https://...",   // Payment page URL
  url: "https://...",           // Alternative URL field
  hostedUrl: "https://...",     // Alternative URL field
  paymentUrl: "https://...",    // Alternative URL field
  amount: 21.00,
  currency: "USD",
  status: "pending",
  organizationId: "...",
  customerId: "user-123",
  expiresAt: "2025-10-06...",
  createdAt: "2025-10-06..."
}
```

Our code handles all URL variations:
```javascript
const checkoutUrl = orderData.checkoutUrl
  || orderData.url
  || orderData.hostedUrl
  || orderData.paymentUrl
  || orderData.checkoutLink;
```

---

## 🎯 Frontend Usage

```javascript
// Create order
const response = await fetch('/api/subscriptions/create-zaprite-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    interval: 'annual'  // or 'monthly'
  })
});

const { checkoutUrl } = await response.json();

// Redirect to Zaprite payment page
window.location.href = checkoutUrl;
```

---

## 🔍 Debugging

### Check if API key works

```bash
curl -X GET https://api.zaprite.com/v1/orders \
  -H "Authorization: Bearer 342ea623-1169-4633-9bd4-ba582be44d23"
```

If you get `401 Unauthorized`, your API key is invalid.

### View recent orders (if endpoint exists)

```bash
curl -X GET "https://api.zaprite.com/v1/orders?limit=10" \
  -H "Authorization: Bearer 342ea623-1169-4633-9bd4-ba582be44d23"
```

### Test webhook locally

Use ngrok to expose local server:

```bash
ngrok http 3000
# Copy https URL
# Add to Zaprite webhook: https://abc123.ngrok.io/api/webhooks/zaprite-subscription
```

---

## 📚 Full API Documentation

**Official Docs:** https://api.zaprite.com

**Key sections to check:**
- `POST /v1/order` - Create order
- `GET /v1/order/{id}` - Get order details
- `GET /v1/orders` - List orders
- Webhook events reference

**Note:** Zaprite API is in beta, so some endpoints may change.

---

## ✅ Quick Checklist

When testing:
- [ ] API returns `checkoutUrl`
- [ ] Clicking URL shows Zaprite payment page
- [ ] Payment methods available (Lightning/Bitcoin/Card)
- [ ] After payment, webhook hits your endpoint
- [ ] User subscription updated in database
- [ ] Gift code generated for annual subscriptions
- [ ] Gift code redeemable by friend

---

**Organization ID:** `cmgbcd9d80008l104g3tasx06`
**Ready to test!** 🚀
