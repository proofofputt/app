/**
 * Admin API: Manually generate gift codes for a user
 * POST /api/admin/subscriptions/gift-codes/manual-generate
 *
 * Use cases:
 * - Automatic generation failed during order processing
 * - Customer support: compensate for issues
 * - Manual grants for partnerships/promotions
 * - Retroactive gift code generation for old orders
 *
 * Body:
 * {
 *   "playerId": 1009,
 *   "quantity": 5,
 *   "bundleId": 2,
 *   "reason": "Automatic generation failed for order od_ABC123",
 *   "orderId": "od_ABC123" (optional - link to specific order)
 * }
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { verifyAdmin } from '../../../../utils/adminAuth.js';
import { setCORSHeaders } from '../../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verify admin authentication
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.isAdmin) {
    return res.status(adminCheck.error === 'Authentication required' ? 401 : 403).json({
      success: false,
      message: adminCheck.error
    });
  }

  const { playerId, quantity, bundleId, reason, orderId } = req.body;

  // Validation
  if (!playerId || !quantity || !reason) {
    return res.status(400).json({
      success: false,
      message: 'playerId, quantity, and reason are required'
    });
  }

  if (quantity < 1 || quantity > 100) {
    return res.status(400).json({
      success: false,
      message: 'Quantity must be between 1 and 100'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify player exists
    const playerCheck = await client.query(
      'SELECT player_id, name, email FROM players WHERE player_id = $1',
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

    // If orderId provided, verify it exists and belongs to this player
    if (orderId) {
      const orderCheck = await client.query(
        'SELECT event_id, player_id FROM zaprite_events WHERE zaprite_order_id = $1',
        [orderId]
      );

      if (orderCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Order ${orderId} not found`
        });
      }

      if (orderCheck.rows[0].player_id !== parseInt(playerId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Order ${orderId} does not belong to player ${playerId}`
        });
      }
    }

    // Generate gift codes
    const generatedCodes = [];
    for (let i = 0; i < quantity; i++) {
      const giftCode = `GIFT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      await client.query(
        `INSERT INTO user_gift_subscriptions (
          owner_user_id,
          gift_code,
          bundle_id,
          is_redeemed,
          granted_by_admin_id,
          grant_reason,
          granted_at,
          created_at
        ) VALUES ($1, $2, $3, FALSE, $4, $5, NOW(), NOW())`,
        [playerId, giftCode, bundleId || null, adminCheck.user.player_id, reason]
      );

      generatedCodes.push(giftCode);
    }

    // Log admin action
    await client.query(
      `INSERT INTO admin_action_logs (
        admin_id,
        action_type,
        target_type,
        target_id,
        action_data,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING`,
      [
        adminCheck.user.player_id,
        'manual_gift_code_generation',
        'player',
        playerId,
        JSON.stringify({
          quantity,
          bundleId,
          orderId,
          reason,
          generatedCodes
        })
      ]
    );

    await client.query('COMMIT');

    console.log(`[Admin] Manually generated ${quantity} gift codes for player ${playerId} (${player.name})`);
    console.log(`[Admin] Reason: ${reason}`);
    console.log(`[Admin] Admin: ${adminCheck.user.name} (${adminCheck.user.player_id})`);

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${quantity} gift code(s) for ${player.name}`,
      data: {
        playerId,
        playerName: player.name,
        playerEmail: player.email,
        quantity,
        bundleId,
        orderId,
        reason,
        generatedCodes,
        generatedBy: adminCheck.user.name,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Admin] Error manually generating gift codes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate gift codes',
      error: error.message
    });
  } finally {
    client.release();
  }
}
