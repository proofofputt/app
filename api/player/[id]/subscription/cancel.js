/**
 * Cancel Subscription Endpoint
 * POST /api/player/[id]/subscription/cancel
 *
 * Downgrades user from paid tier to free tier
 * Sets membership_tier to 'free' and clears subscription data
 */

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { id } = req.query;
  const playerId = parseInt(id);

  // Verify user is canceling their own subscription
  if (user.playerId !== playerId) {
    return res.status(403).json({
      success: false,
      message: 'You can only cancel your own subscription'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current player data
    const playerResult = await client.query(
      'SELECT player_id, name, email, membership_tier, subscription_status FROM players WHERE player_id = $1',
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Check if user has an active subscription
    if (player.membership_tier === 'free') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You do not have an active subscription to cancel'
      });
    }

    // Downgrade to free tier and clear subscription data
    await client.query(
      `UPDATE players
       SET
         membership_tier = 'free',
         subscription_status = 'canceled',
         subscription_tier = NULL,
         subscription_billing_cycle = NULL,
         subscription_cancel_at_period_end = TRUE,
         is_subscribed = FALSE,
         updated_at = NOW()
       WHERE player_id = $1`,
      [playerId]
    );

    // Log the cancellation
    console.log(`[Subscription] Player ${playerId} (${player.email}) canceled subscription`);
    console.log(`[Subscription] Previous tier: ${player.membership_tier}, new tier: free`);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Your subscription has been canceled successfully. You now have free tier access.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Subscription Cancel] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  } finally {
    client.release();
  }
}
