/**
 * Admin API endpoint to directly grant subscription to any player
 * Use case: Grant subscriptions without generating gift codes (e.g., refunds, support, partnerships)
 *
 * Example usage:
 * POST /api/admin/subscriptions/grant-direct
 * {
 *   "playerId": 123,                         // Player to grant subscription to
 *   "duration": "1 year",                    // Duration (e.g., "1 month", "1 year", "lifetime")
 *   "reason": "Partnership with Golf Club XYZ"
 * }
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple admin authentication - check for admin token
function authenticateAdmin(req) {
  const adminToken = req.headers.authorization?.replace('Bearer ', '');
  const validAdminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || !validAdminToken) {
    return { isAdmin: false, error: 'Admin authentication not configured' };
  }

  if (adminToken !== validAdminToken) {
    return { isAdmin: false, error: 'Invalid admin credentials' };
  }

  return { isAdmin: true };
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authenticate admin
  const authResult = authenticateAdmin(req);
  if (!authResult.isAdmin) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'Unauthorized - Admin access required'
    });
  }

  const { playerId, duration, reason } = req.body;

  // Validate required fields
  if (!playerId || !duration) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: playerId, duration'
    });
  }

  // Validate duration format
  const validDurations = ['1 month', '1 year', 'lifetime', '3 months', '6 months', '2 years'];
  if (!validDurations.includes(duration.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid duration. Valid options: ${validDurations.join(', ')}`
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify player exists
    const playerCheck = await client.query(
      'SELECT player_id, email, display_name, is_subscribed, subscription_expires_at FROM players WHERE player_id = $1',
      [playerId]
    );

    if (playerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Player with ID ${playerId} not found`
      });
    }

    const player = playerCheck.rows[0];

    // 2. Calculate expiration date
    let expirationDate;
    let expirationInterval;

    if (duration.toLowerCase() === 'lifetime') {
      // Set expiration to 100 years from now (effectively lifetime)
      expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 100);
      expirationInterval = null;
    } else {
      // Parse duration (e.g., "1 year", "1 month")
      expirationInterval = duration;
    }

    // 3. Update player subscription
    if (expirationInterval) {
      await client.query(
        `UPDATE players
         SET is_subscribed = TRUE,
             membership_tier = 'premium',
             subscription_status = 'active',
             subscription_expires_at = NOW() + INTERVAL '${expirationInterval}',
             updated_at = NOW()
         WHERE player_id = $1`,
        [playerId]
      );
    } else {
      await client.query(
        `UPDATE players
         SET is_subscribed = TRUE,
             membership_tier = 'premium',
             subscription_status = 'active',
             subscription_expires_at = $2,
             updated_at = NOW()
         WHERE player_id = $1`,
        [playerId, expirationDate]
      );
    }

    // 4. Log the grant (optional - create a grant log table if needed)
    // For now, we'll just log to console

    await client.query('COMMIT');

    const finalExpiration = expirationInterval
      ? `NOW() + ${expirationInterval}`
      : expirationDate.toISOString();

    console.log(`[Admin] Directly granted subscription to player ${playerId} (${player.email})`);
    console.log(`[Admin] Duration: ${duration}`);
    console.log(`[Admin] Reason: ${reason || 'Not specified'}`);
    console.log(`[Admin] Expires: ${finalExpiration}`);

    return res.status(200).json({
      success: true,
      message: `Successfully granted ${duration} subscription to player ${playerId}`,
      data: {
        playerId: playerId,
        email: player.email,
        displayName: player.display_name,
        duration: duration,
        reason: reason,
        previouslySubscribed: player.is_subscribed,
        previousExpiration: player.subscription_expires_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Admin] Error granting subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    client.release();
  }
}
