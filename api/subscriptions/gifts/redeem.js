/**
 * Redeem a gift subscription code
 * POST /api/subscriptions/gifts/redeem
 *
 * Body: { giftCode: "GIFT-XXXXX" }
 */

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Verify JWT token from request
 */
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

  // Authenticate user
  const user = await verifyToken(req);
  if (!user || !user.playerId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { giftCode } = req.body;

  if (!giftCode || typeof giftCode !== 'string') {
    return res.status(400).json({ success: false, message: 'Gift code is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find the gift subscription
    const giftResult = await client.query(
      'SELECT * FROM user_gift_subscriptions WHERE gift_code = $1',
      [giftCode.trim().toUpperCase()]
    );

    if (giftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Gift code not found' });
    }

    const gift = giftResult.rows[0];

    if (gift.is_redeemed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Gift code has already been redeemed',
        redeemedAt: gift.redeemed_at,
        redeemedBy: gift.redeemed_by_user_id
      });
    }

    // Check if user is trying to redeem their own gift code
    if (gift.owner_user_id === user.playerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You cannot redeem your own gift code. Please share it with someone else!'
      });
    }

    // Mark the gift as redeemed
    await client.query(
      `UPDATE user_gift_subscriptions
       SET is_redeemed = TRUE,
           redeemed_by_user_id = $1,
           redeemed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [user.playerId, gift.id]
    );

    // Update the user's subscription status (1 year subscription)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await client.query(
      `UPDATE players
       SET subscription_status = 'active',
           membership_tier = 'premium',
           subscription_expires_at = $1,
           updated_at = NOW()
       WHERE player_id = $2`,
      [oneYearFromNow, user.playerId]
    );

    // Get updated player info
    const playerResult = await client.query(
      'SELECT player_id, name, email, subscription_status, membership_tier, subscription_expires_at FROM players WHERE player_id = $1',
      [user.playerId]
    );

    const player = playerResult.rows[0];

    await client.query('COMMIT');

    console.log(`[Gift Redemption] Player ${user.playerId} redeemed gift code ${giftCode}`);

    return res.status(200).json({
      success: true,
      message: 'Gift subscription redeemed successfully! You now have premium access for 1 year.',
      subscription: {
        status: player.subscription_status,
        tier: player.membership_tier,
        expiresAt: player.subscription_expires_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Gift Redemption] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to redeem gift code',
      error: error.message
    });
  } finally {
    client.release();
  }
}
