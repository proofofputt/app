import pg from 'pg';
import crypto from 'crypto';
import {
  logCronJob,
  logSubscriptionEvent,
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

/**
 * Check for Expired Subscriptions
 *
 * This cron job runs daily and:
 * 1. Finds all subscriptions that have expired (period_end < NOW)
 * 2. Downgrades them to free tier
 * 3. Logs the changes for tracking
 */

/**
 * Get expired subscriptions
 */
async function getExpiredSubscriptions() {
  const query = `
    SELECT
      player_id,
      email,
      display_name,
      subscription_current_period_end,
      subscription_billing_cycle,
      subscription_tier,
      membership_tier
    FROM players
    WHERE is_subscribed = TRUE
      AND subscription_status = 'active'
      AND subscription_cancel_at_period_end = FALSE
      AND subscription_current_period_end IS NOT NULL
      AND subscription_current_period_end < NOW()
    ORDER BY subscription_current_period_end ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get subscriptions marked for cancellation that have reached period end
 */
async function getCanceledSubscriptions() {
  const query = `
    SELECT
      player_id,
      email,
      display_name,
      subscription_current_period_end,
      subscription_billing_cycle
    FROM players
    WHERE is_subscribed = TRUE
      AND subscription_status = 'active'
      AND subscription_cancel_at_period_end = TRUE
      AND subscription_current_period_end IS NOT NULL
      AND subscription_current_period_end < NOW()
    ORDER BY subscription_current_period_end ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Downgrade player to free tier
 */
async function downgradeToFreeTier(player, reason, logger) {
  const { player_id, email, display_name } = player;

  try {
    logger.info('Downgrading player to free tier', {
      playerId: player_id,
      email,
      reason,
      periodEnd: player.subscription_current_period_end
    });

    const query = `
      UPDATE players
      SET
        subscription_status = 'canceled',
        subscription_tier = NULL,
        is_subscribed = FALSE,
        membership_tier = 'free',
        updated_at = NOW()
      WHERE player_id = $1
    `;

    await pool.query(query, [player_id]);

    logSubscriptionEvent('subscription_expired_downgraded', {
      playerId: player_id,
      email,
      reason,
      previousTier: player.subscription_tier || player.membership_tier,
      periodEnd: player.subscription_current_period_end
    });

    logger.info('Player downgraded successfully', {
      playerId: player_id,
      email
    });

    return {
      success: true,
      playerId: player_id,
      email
    };

  } catch (error) {
    logger.error('Error downgrading player', error, {
      playerId: player_id,
      email
    });

    return {
      success: false,
      playerId: player_id,
      email,
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

  logCronJob('check-expired-subscriptions', 'started', { requestId });

  try {
    // Get all expired subscriptions
    const expiredSubscriptions = await getExpiredSubscriptions();
    const canceledSubscriptions = await getCanceledSubscriptions();

    const totalToProcess = expiredSubscriptions.length + canceledSubscriptions.length;

    logger.info('Found subscriptions to process', {
      expired: expiredSubscriptions.length,
      canceled: canceledSubscriptions.length,
      total: totalToProcess,
      requestId
    });

    if (totalToProcess === 0) {
      logCronJob('check-expired-subscriptions', 'completed', {
        requestId,
        message: 'No expired subscriptions to process'
      });

      return res.status(200).json({
        success: true,
        message: 'No expired subscriptions to process',
        processed: 0
      });
    }

    // Process expired subscriptions
    const results = [];

    for (const subscription of expiredSubscriptions) {
      const result = await downgradeToFreeTier(subscription, 'expired', logger);
      results.push(result);

      // Add delay between processing
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Process canceled subscriptions
    for (const subscription of canceledSubscriptions) {
      const result = await downgradeToFreeTier(subscription, 'canceled_at_period_end', logger);
      results.push(result);

      // Add delay between processing
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logCronJob('check-expired-subscriptions', 'completed', {
      requestId,
      total: totalToProcess,
      successful: successCount,
      failed: failureCount
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription expiration check completed',
      total: totalToProcess,
      successful: successCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    logger.error('Cron job failed', error);

    logCronJob('check-expired-subscriptions', 'failed', {
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
