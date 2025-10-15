import pg from 'pg';
import { info, logSubscriptionEvent, error as logError } from '../../utils/logger.js';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Cron Job: Expire Subscriptions
 * Runs daily at 2am UTC to expire subscriptions that have passed their period end date
 * Vercel Cron Schedule: "0 2 * * *"
 */
export default async function handler(req, res) {
  // Verify this is being called by Vercel Cron (or allow GET for manual testing in development)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify cron secret
  if (process.env.NODE_ENV === 'production') {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logError('Unauthorized cron job access attempt', new Error('Invalid cron secret'));
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  info('Running subscription expiry cron job');

  try {
    // Find all active subscriptions that have expired
    const expiredQuery = `
      SELECT player_id, email, subscription_tier, subscription_current_period_end
      FROM players
      WHERE subscription_status = 'active'
        AND subscription_current_period_end < NOW()
    `;

    const expiredResult = await pool.query(expiredQuery);
    const expiredCount = expiredResult.rows.length;

    info(`Found ${expiredCount} expired subscriptions to process`);

    if (expiredCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No expired subscriptions found',
        expired_count: 0
      });
    }

    // Expire all subscriptions that have passed their period end
    const updateQuery = `
      UPDATE players
      SET
        subscription_status = 'canceled',
        subscription_tier = NULL,
        is_subscribed = FALSE,
        updated_at = NOW()
      WHERE subscription_status = 'active'
        AND subscription_current_period_end < NOW()
      RETURNING player_id, email
    `;

    const updateResult = await pool.query(updateQuery);

    // Log each expiration
    for (const player of updateResult.rows) {
      logSubscriptionEvent('subscription_expired_by_cron', {
        playerId: player.player_id,
        email: player.email
      });
    }

    info(`Successfully expired ${updateResult.rows.length} subscriptions`);

    res.status(200).json({
      success: true,
      message: `Expired ${updateResult.rows.length} subscriptions`,
      expired_count: updateResult.rows.length,
      players: updateResult.rows.map(p => ({ player_id: p.player_id, email: p.email }))
    });

  } catch (error) {
    logError('Error in subscription expiry cron job', error);
    res.status(500).json({
      success: false,
      error: 'Failed to expire subscriptions',
      message: error.message
    });
  }
}
