import pg from 'pg';
import crypto from 'crypto';
import {
  createZapriteOrder,
  createZapriteOrderCharge,
  extractOrderId,
  ZapriteApiError
} from '../../utils/zaprite-client.js';
import {
  logCronJob,
  logPaymentEvent,
  error as logError,
  warn as logWarn,
  createRequestLogger
} from '../../utils/logger.js';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Zaprite Custom Checkout ID for monthly subscriptions
const ZAPRITE_CUSTOM_CHECKOUT_ID = 'cmgoepfh00001kv04t7a0mvdk';
const MONTHLY_SUBSCRIPTION_AMOUNT = 2.10;

/**
 * Process Monthly Subscription Auto-pay
 *
 * This cron job runs daily and processes monthly subscription renewals:
 * 1. Find all active monthly subscribers whose period is expiring soon (within 3 days)
 * 2. Create a new order for each subscriber
 * 3. Auto-charge their saved payment profile
 * 4. Webhook will update subscription period when payment succeeds
 */

/**
 * Get subscribers due for renewal
 * Returns subscribers whose subscription expires within the next 3 days
 */
async function getSubscribersDueForRenewal() {
  const query = `
    SELECT
      player_id,
      email,
      display_name,
      zaprite_customer_id,
      zaprite_payment_profile_id,
      subscription_current_period_end,
      subscription_billing_cycle
    FROM players
    WHERE subscription_billing_cycle = 'monthly'
      AND is_subscribed = TRUE
      AND subscription_status = 'active'
      AND zaprite_payment_profile_id IS NOT NULL
      AND subscription_current_period_end IS NOT NULL
      AND subscription_current_period_end <= NOW() + INTERVAL '3 days'
      AND subscription_current_period_end > NOW()
    ORDER BY subscription_current_period_end ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Process renewal for a single subscriber
 */
async function processSubscriberRenewal(subscriber, logger) {
  const { player_id, email, display_name, zaprite_payment_profile_id } = subscriber;

  try {
    logger.info('Processing monthly renewal', {
      playerId: player_id,
      email,
      periodEnd: subscriber.subscription_current_period_end
    });

    // Step 1: Create a new order
    const orderPayload = {
      customerId: player_id.toString(),
      customerEmail: email,
      customerName: display_name || `Player ${player_id}`,
      amount: MONTHLY_SUBSCRIPTION_AMOUNT,
      currency: 'USD',
      description: 'Proof of Putt Monthly Subscription - Auto Renewal',
      customCheckoutId: ZAPRITE_CUSTOM_CHECKOUT_ID,
      metadata: {
        userId: player_id.toString(),
        playerId: player_id.toString(),
        userEmail: email,
        displayName: display_name || 'Anonymous',
        interval: 'monthly',
        subscriptionType: 'proof-of-putt',
        isAutoRenewal: 'true',
        renewalDate: new Date().toISOString()
      }
    };

    logger.info('Creating renewal order', {
      playerId: player_id,
      amount: MONTHLY_SUBSCRIPTION_AMOUNT
    });

    const orderData = await createZapriteOrder(orderPayload);
    const orderId = extractOrderId(orderData);

    if (!orderId) {
      throw new Error('Failed to extract order ID from Zaprite response');
    }

    logger.info('Order created, now auto-charging', {
      playerId: player_id,
      orderId,
      paymentProfileId: zaprite_payment_profile_id
    });

    // Step 2: Auto-charge the saved payment profile
    const chargePayload = {
      orderId,
      paymentProfileId: zaprite_payment_profile_id
    };

    const chargeResult = await createZapriteOrderCharge(chargePayload);

    logPaymentEvent('monthly_renewal_charged', {
      playerId: player_id,
      orderId,
      amount: MONTHLY_SUBSCRIPTION_AMOUNT,
      paymentProfileId: zaprite_payment_profile_id,
      chargeResult
    });

    logger.info('Monthly renewal charged successfully', {
      playerId: player_id,
      orderId
    });

    // Record successful renewal in database
    await pool.query(
      `INSERT INTO zaprite_payment_events (
        player_id,
        event_type,
        event_id,
        raw_event,
        status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        player_id,
        'renewal.auto_charged',
        `renewal_${orderId}`,
        JSON.stringify({
          orderId,
          amount: MONTHLY_SUBSCRIPTION_AMOUNT,
          paymentProfileId: zaprite_payment_profile_id,
          chargeResult,
          processedAt: new Date().toISOString()
        }),
        'completed'
      ]
    );

    return {
      success: true,
      playerId: player_id,
      orderId
    };

  } catch (error) {
    logger.error('Error processing subscriber renewal', error, {
      playerId: player_id,
      email
    });

    // Record failed renewal
    await pool.query(
      `INSERT INTO zaprite_payment_events (
        player_id,
        event_type,
        event_id,
        raw_event,
        status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        player_id,
        'renewal.failed',
        `renewal_fail_${Date.now()}`,
        JSON.stringify({
          error: error.message,
          paymentProfileId: zaprite_payment_profile_id,
          failedAt: new Date().toISOString()
        }),
        'failed'
      ]
    );

    // Mark subscription as past_due
    await pool.query(
      `UPDATE players
       SET subscription_status = 'past_due', updated_at = NOW()
       WHERE player_id = $1`,
      [player_id]
    );

    return {
      success: false,
      playerId: player_id,
      error: error.message
    };
  }
}

/**
 * Main cron handler
 */
export default async function handler(req, res) {
  // Verify this is a legitimate cron request
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // In production, require authentication
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      logError('CRON_SECRET not configured', new Error('Missing CRON_SECRET'));
      return res.status(500).json({ error: 'Cron not properly configured' });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logWarn('Unauthorized cron request attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId);

  logCronJob('process-monthly-subscriptions', 'started', { requestId });

  try {
    // Get all subscribers due for renewal
    const subscribers = await getSubscribersDueForRenewal();

    logger.info('Found subscribers for renewal', {
      count: subscribers.length,
      requestId
    });

    if (subscribers.length === 0) {
      logCronJob('process-monthly-subscriptions', 'completed', {
        requestId,
        message: 'No subscribers due for renewal'
      });

      return res.status(200).json({
        success: true,
        message: 'No subscribers due for renewal',
        processed: 0
      });
    }

    // Process each subscriber
    const results = [];
    for (const subscriber of subscribers) {
      const result = await processSubscriberRenewal(subscriber, logger);
      results.push(result);

      // Add delay between processing to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logCronJob('process-monthly-subscriptions', 'completed', {
      requestId,
      total: subscribers.length,
      successful: successCount,
      failed: failureCount
    });

    return res.status(200).json({
      success: true,
      message: 'Monthly subscription processing completed',
      total: subscribers.length,
      successful: successCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    logger.error('Cron job failed', error);

    logCronJob('process-monthly-subscriptions', 'failed', {
      requestId,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Cron job failed',
      message: error.message
    });
  }
}
