import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { player_id, coupon_code } = req.body;

    if (!player_id || !coupon_code) {
      return res.status(400).json({ success: false, message: 'Player ID and coupon code are required.' });
    }

    // Check if it's the early access coupon (case-insensitive)
    const isEarlyAccessCoupon = coupon_code.toLowerCase() === 'early';
    
    if (!isEarlyAccessCoupon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid coupon code.' 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify the player exists and get full subscription info
      const playerCheck = await client.query(`
        SELECT
          player_id,
          membership_tier,
          subscription_status,
          is_subscribed
        FROM players
        WHERE player_id = $1
      `, [player_id]);

      if (playerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid player ID' });
      }

      const currentPlayer = playerCheck.rows[0];
      console.log(`🎫 Attempting to redeem coupon: "${coupon_code}" for player ${player_id}`);
      console.log(`   Current tier: ${currentPlayer.membership_tier}, status: ${currentPlayer.subscription_status}, subscribed: ${currentPlayer.is_subscribed}`);

      // Check if user already has an active subscription (not cancelled)
      if (currentPlayer.is_subscribed && currentPlayer.subscription_status === 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'You already have an active subscription. Coupon codes are for new or expired subscriptions only.'
        });
      }

      // Grant 1 year of Full Subscriber access
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      await client.query(`
        UPDATE players
        SET
          membership_tier = 'premium',
          subscription_status = 'active',
          subscription_tier = 'full_subscriber',
          subscription_billing_cycle = 'coupon',
          subscription_started_at = COALESCE(subscription_started_at, NOW()),
          subscription_current_period_start = NOW(),
          subscription_current_period_end = $1,
          subscription_expires_at = $1,
          subscription_cancel_at_period_end = FALSE,
          is_subscribed = TRUE,
          updated_at = NOW()
        WHERE player_id = $2
      `, [expirationDate, player_id]);

      // Update coupon redemption count
      await client.query(`
        UPDATE coupons
        SET times_redeemed = times_redeemed + 1
        WHERE LOWER(code) = LOWER($1)
      `, [coupon_code]);

      // Create coupon_redemptions table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS coupon_redemptions (
          id SERIAL PRIMARY KEY,
          player_id INTEGER REFERENCES players(player_id),
          coupon_code VARCHAR(50),
          redeemed_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Track this redemption
      await client.query(`
        INSERT INTO coupon_redemptions (player_id, coupon_code)
        VALUES ($1, $2)
      `, [player_id, coupon_code]);

      await client.query('COMMIT');

      console.log(`🎫 Successfully granted Full Subscriber access to player ${player_id} via coupon "${coupon_code}"`);
      console.log(`   Expires: ${expirationDate.toISOString()}`);

      return res.status(200).json({
        success: true,
        message: 'Coupon redeemed successfully! You now have Full Subscriber access for 1 year.',
        subscription: {
          tier: 'full_subscriber',
          expiresAt: expirationDate
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Coupon redemption error:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
  }
}