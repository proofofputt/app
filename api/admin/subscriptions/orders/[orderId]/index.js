/**
 * Admin API: Get detailed order information
 * GET /api/admin/subscriptions/orders/[orderId]
 *
 * Returns:
 * - Order details
 * - Customer information
 * - Gift codes generated (if bundle)
 * - Full webhook event data
 */

import { Pool } from 'pg';
import { verifyAdmin } from '../../../../../utils/adminAuth.js';
import { setCORSHeaders } from '../../../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
  }

  try {
    // Get order details
    const orderQuery = `
      SELECT
        ze.event_id,
        ze.zaprite_event_id,
        ze.zaprite_order_id,
        ze.event_type,
        ze.player_id,
        p.player_id,
        p.name as player_name,
        p.email as player_email,
        p.display_name,
        p.membership_tier,
        p.subscription_status,
        ze.zaprite_customer_id,
        ze.zaprite_subscription_id,
        ze.payment_amount,
        ze.payment_currency,
        ze.payment_method,
        ze.processed,
        ze.processing_error,
        ze.retry_count,
        ze.created_at,
        ze.processed_at,
        ze.event_data
      FROM zaprite_events ze
      LEFT JOIN players p ON ze.player_id = p.player_id
      WHERE ze.zaprite_order_id = $1
        OR ze.zaprite_event_id = $1
        OR ze.event_id::text = $1
      ORDER BY ze.created_at DESC
      LIMIT 1
    `;

    const orderResult = await pool.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get gift codes generated for this order
    const giftCodesQuery = `
      SELECT
        id,
        gift_code,
        bundle_id,
        is_redeemed,
        redeemed_by_player_id,
        redeemed_at,
        created_at,
        custom_label,
        granted_by_admin_id,
        grant_reason
      FROM user_gift_subscriptions
      WHERE owner_player_id = $1
        AND created_at >= $2
        AND created_at <= $2 + INTERVAL '10 minutes'
      ORDER BY created_at ASC
    `;

    const giftCodesResult = await pool.query(giftCodesQuery, [
      order.player_id,
      order.created_at
    ]);

    // Get redeemed player info for redeemed gift codes
    const redeemedPlayerIds = giftCodesResult.rows
      .filter(gc => gc.redeemed_by_player_id)
      .map(gc => gc.redeemed_by_player_id);

    let redeemedPlayers = {};
    if (redeemedPlayerIds.length > 0) {
      const redeemedQuery = `
        SELECT player_id, name, email
        FROM players
        WHERE player_id = ANY($1)
      `;
      const redeemedResult = await pool.query(redeemedQuery, [redeemedPlayerIds]);
      redeemedPlayers = Object.fromEntries(
        redeemedResult.rows.map(p => [p.player_id, p])
      );
    }

    // Format gift codes with redeemer info
    const giftCodes = giftCodesResult.rows.map(gc => ({
      id: gc.id,
      code: gc.gift_code,
      bundleId: gc.bundle_id,
      isRedeemed: gc.is_redeemed,
      redeemedBy: gc.redeemed_by_player_id ? {
        playerId: gc.redeemed_by_player_id,
        name: redeemedPlayers[gc.redeemed_by_player_id]?.name,
        email: redeemedPlayers[gc.redeemed_by_player_id]?.email
      } : null,
      redeemedAt: gc.redeemed_at,
      createdAt: gc.created_at,
      customLabel: gc.custom_label,
      grantedByAdmin: gc.granted_by_admin_id,
      grantReason: gc.grant_reason
    }));

    // Parse event metadata
    const eventData = order.event_data;
    const metadata = eventData.metadata || {};

    return res.status(200).json({
      success: true,
      order: {
        eventId: order.event_id,
        zapriteEventId: order.zaprite_event_id,
        orderId: order.zaprite_order_id,
        eventType: order.event_type,
        amount: order.payment_amount,
        currency: order.payment_currency,
        paymentMethod: order.payment_method,
        processed: order.processed,
        error: order.processing_error,
        retryCount: order.retry_count,
        createdAt: order.created_at,
        processedAt: order.processed_at,
        metadata: {
          type: metadata.type,
          bundleId: metadata.bundleId,
          bundleQuantity: metadata.bundleQuantity,
          interval: metadata.interval
        }
      },
      customer: {
        playerId: order.player_id,
        name: order.player_name,
        displayName: order.display_name,
        email: order.player_email,
        membershipTier: order.membership_tier,
        subscriptionStatus: order.subscription_status,
        zapriteCustomerId: order.zaprite_customer_id,
        zapriteSubscriptionId: order.zaprite_subscription_id
      },
      giftCodes: giftCodes,
      giftCodesSummary: {
        total: giftCodes.length,
        redeemed: giftCodes.filter(gc => gc.isRedeemed).length,
        pending: giftCodes.filter(gc => !gc.isRedeemed).length
      },
      rawEventData: eventData
    });

  } catch (error) {
    console.error('Admin order detail fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
}
