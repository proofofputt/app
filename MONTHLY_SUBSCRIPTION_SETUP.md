# Monthly Subscription Setup Guide

## Overview
Complete setup for monthly subscriptions using Zaprite payment links with automatic expiration handling.

## Payment Links
- **Monthly**: `https://pay.zaprite.com/pl_F32s4VbLaN` ($2.10/month)
- **Yearly**: `https://pay.zaprite.com/pl_NC6B3oH3dJ` ($21/year + 1 free year gift)

## Database Setup

### 1. Run Migration
```bash
psql $DATABASE_URL -f database/add_subscription_payment_links.sql
```

This creates the `zaprite_subscription_links` table and maps payment links to subscription types.

## Webhook Configuration

### 1. Zaprite Webhook Setup
Configure webhook in Zaprite dashboard:
- **Webhook URL**: `https://app.proofofputt.com/api/webhooks/zaprite`
- **Events to send**:
  - `order.paid` - When payment completes
  - `invoice.paid` - For recurring payments
  - `invoice.payment_failed` - When payment fails
  - `subscription.canceled` - When user cancels
  - `subscription.expired` - When subscription expires

### 2. Payment Link Metadata
For each payment link in Zaprite, ensure it passes:
- Customer email (required for player lookup)
- Player ID in metadata (if possible)

The webhook will:
1. Look up the payment link ID in `zaprite_subscription_links` table
2. Determine if it's monthly or yearly
3. Set the appropriate billing cycle and period end
4. Activate the subscription
5. Generate gift codes if `includes_gift = TRUE`

## Automated Processes

### Cron Jobs

#### 1. Check Expired Subscriptions
- **Path**: `/api/cron/check-expired-subscriptions`
- **Schedule**: Daily at 3:00 AM UTC (`0 3 * * *`)
- **Purpose**: Downgrade expired subscriptions to free tier
- **Process**:
  - Finds subscriptions where `subscription_current_period_end < NOW()`
  - Downgrades to free tier
  - Updates `membership_tier = 'free'`
  - Logs all changes

#### 2. Process Monthly Renewals (Future)
- **Path**: `/api/cron/process-monthly-subscriptions`
- **Schedule**: Daily at 9:00 AM UTC (`0 9 * * *`)
- **Purpose**: Auto-charge saved payment methods for renewals
- **Note**: Requires payment profile setup in Zaprite

## Player Flow

### New Monthly Subscription
1. Player clicks "Subscribe Monthly" button
2. Redirected to Zaprite payment link `pl_F32s4VbLaN`
3. Completes payment (Bitcoin/Lightning/Card)
4. Zaprite sends `order.paid` webhook
5. Webhook handler:
   - Looks up payment link → finds monthly subscription config
   - Sets `subscription_billing_cycle = 'monthly'`
   - Sets `subscription_current_period_end = NOW() + 1 month`
   - Sets `membership_tier = 'premium'`
   - Activates subscription

### Subscription Expiration
1. Daily cron job runs at 3:00 AM
2. Finds subscriptions where period_end < now
3. Updates player:
   - `subscription_status = 'canceled'`
   - `is_subscribed = FALSE`
   - `membership_tier = 'free'`
4. Player loses premium features
5. Event logged for tracking

### Yearly Subscription
1. Player clicks "Subscribe Yearly" button
2. Redirected to Zaprite payment link `pl_NC6B3oH3dJ`
3. Completes payment
4. Webhook handler:
   - Looks up payment link → finds yearly subscription config
   - Sets `subscription_billing_cycle = 'annual'`
   - Sets `subscription_current_period_end = NOW() + 1 year`
   - Sets `membership_tier = 'premium'`
   - Generates 1 gift code (includes_gift = TRUE)
   - Activates subscription

## Testing

### Test Monthly Subscription
1. Log in as test user
2. Go to Settings → Manage Subscription
3. Click "Subscribe Monthly"
4. Complete payment on Zaprite
5. Verify webhook received in logs
6. Check player record updated:
   ```sql
   SELECT
     player_id,
     membership_tier,
     subscription_status,
     subscription_billing_cycle,
     subscription_current_period_end,
     is_subscribed
   FROM players
   WHERE player_id = <test_player_id>;
   ```

### Test Expiration
1. Manually set period_end to past:
   ```sql
   UPDATE players
   SET subscription_current_period_end = NOW() - INTERVAL '1 day'
   WHERE player_id = <test_player_id>;
   ```
2. Manually trigger cron:
   ```bash
   curl -X POST https://app.proofofputt.com/api/cron/check-expired-subscriptions \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
3. Verify player downgraded to free tier

### Test Webhook Locally
1. Use Zaprite test mode webhook
2. Send test `order.paid` event
3. Verify player subscription activated
4. Check logs for payment link detection

## Environment Variables
Ensure these are set:
- `DATABASE_URL` - PostgreSQL connection string
- `ZAPRITE_WEBHOOK_SECRET` - Webhook signature verification
- `CRON_SECRET` - Cron job authentication
- `ZAPRITE_API_KEY` - Zaprite API access (for future auto-renewals)
- `ZAPRITE_ORG_ID` - Your Zaprite organization ID

## Monitoring

### Key Metrics to Track
- Subscriptions activated (webhook logs)
- Subscriptions expired (cron logs)
- Failed payments (webhook logs)
- Payment link usage (by payment_link_id)

### Logs to Monitor
```sql
-- Recent subscription activations
SELECT * FROM zaprite_events
WHERE event_type = 'order.paid'
ORDER BY created_at DESC
LIMIT 10;

-- Recent expirations
SELECT player_id, email, subscription_current_period_end
FROM players
WHERE subscription_status = 'canceled'
  AND updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

## Troubleshooting

### Webhook Not Received
1. Check Zaprite webhook settings
2. Verify webhook URL is correct
3. Check webhook signature in logs
4. Ensure `ZAPRITE_WEBHOOK_SECRET` is set

### Subscription Not Activated
1. Check `zaprite_events` table for received webhook
2. Verify payment link ID in event data
3. Check `zaprite_subscription_links` mapping exists
4. Look for processing errors in logs

### Player Not Downgraded
1. Check cron job logs
2. Verify `subscription_current_period_end` is in past
3. Check cron authentication (CRON_SECRET)
4. Manually trigger cron to test

## Future Enhancements
1. Email notifications on expiration
2. Auto-renewal with saved payment methods
3. Grace period before downgrade (3-7 days)
4. Retry failed payments
5. Upgrade/downgrade between plans
