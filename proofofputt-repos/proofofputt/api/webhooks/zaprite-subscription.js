import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Generate unique gift code
function generateGiftCode() {
  return `GIFT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const event = req.body;

  console.log('Zaprite webhook received:', JSON.stringify(event, null, 2));

  try {
    // Extract event data
    const eventType = event.type || event.event;
    const eventData = event.data || event;

    // Handle payment success
    if (eventType === 'payment.succeeded' || eventType === 'subscription.created') {
      const {
        customer,
        metadata,
        amount,
        currency,
        id: paymentId
      } = eventData;

      const userId = metadata?.userId || customer?.id;
      const interval = metadata?.interval;
      const includesGift = metadata?.includesGift === 'true' || interval === 'annual';

      if (!userId) {
        console.error('No userId found in webhook payload');
        return res.status(400).json({ error: 'Missing userId in payload' });
      }

      // Calculate subscription expiry
      let expiryDate = new Date();
      if (interval === 'annual') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }

      // Update user subscription status
      await pool.query(
        `UPDATE players
         SET is_subscribed = TRUE,
             subscription_expires_at = $1,
             subscription_tier = 'Full Subscriber',
             subscription_status = 'active',
             zaprite_customer_id = $2,
             zaprite_payment_method = $3,
             subscription_started_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [expiryDate, customer?.id || userId, 'zaprite', userId]
      );

      // Log payment event
      await pool.query(
        `INSERT INTO zaprite_payment_events (
          player_id,
          event_type,
          event_id,
          customer_id,
          amount,
          currency,
          raw_event,
          status,
          processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
        [
          userId,
          eventType,
          paymentId,
          customer?.id || userId,
          amount,
          currency || 'USD',
          JSON.stringify(event),
          'processed'
        ]
      );

      // If annual subscription, generate gift code
      if (includesGift) {
        const giftCode = generateGiftCode();

        await pool.query(
          `INSERT INTO user_gift_subscriptions (
            owner_user_id,
            gift_code,
            bundle_id,
            is_redeemed,
            created_at
          ) VALUES ($1, $2, NULL, FALSE, CURRENT_TIMESTAMP)`,
          [userId, giftCode]
        );

        console.log(`Generated gift code ${giftCode} for user ${userId}`);

        // You could send an email here to notify the user of their gift code
        // await sendGiftCodeEmail(userId, giftCode);
      }

      return res.status(200).json({
        success: true,
        message: 'Subscription processed successfully',
        giftGenerated: includesGift
      });
    }

    // Handle subscription cancellation
    if (eventType === 'subscription.canceled' || eventType === 'subscription.cancelled') {
      const userId = eventData.customer?.id || eventData.metadata?.userId;

      if (userId) {
        await pool.query(
          `UPDATE players
           SET subscription_status = 'canceled'
           WHERE id = $1`,
          [userId]
        );

        await pool.query(
          `INSERT INTO zaprite_payment_events (
            player_id,
            event_type,
            event_id,
            raw_event,
            status,
            processed_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            userId,
            eventType,
            eventData.id,
            JSON.stringify(event),
            'processed'
          ]
        );
      }

      return res.status(200).json({ success: true, message: 'Cancellation processed' });
    }

    // Handle payment failed
    if (eventType === 'payment.failed') {
      const userId = eventData.customer?.id || eventData.metadata?.userId;

      if (userId) {
        await pool.query(
          `UPDATE players
           SET subscription_status = 'past_due'
           WHERE id = $1`,
          [userId]
        );

        await pool.query(
          `INSERT INTO zaprite_payment_events (
            player_id,
            event_type,
            event_id,
            raw_event,
            status,
            error_message,
            processed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            userId,
            eventType,
            eventData.id,
            JSON.stringify(event),
            'processed',
            eventData.error_message || 'Payment failed'
          ]
        );
      }

      return res.status(200).json({ success: true, message: 'Payment failure recorded' });
    }

    // Unhandled event type
    console.log(`Unhandled webhook event type: ${eventType}`);
    return res.status(200).json({ success: true, message: 'Event received but not processed' });

  } catch (error) {
    console.error('Error processing Zaprite webhook:', error);

    // Log failed webhook
    try {
      await pool.query(
        `INSERT INTO zaprite_payment_events (
          event_type,
          raw_event,
          status,
          error_message,
          processed_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          'webhook.error',
          JSON.stringify(req.body),
          'failed',
          error.message
        ]
      );
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
}
