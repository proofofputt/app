/**
 * Admin API: Get user's complete subscription history
 * GET /api/admin/subscriptions/users/[userId]/history
 *
 * Returns:
 * - All subscription orders
 * - Gift codes owned
 * - Gift codes redeemed by user
 * - Current subscription status
 * - Subscription timeline
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

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID, email, or name is required'
    });
  }

  try {
    // Get player info - support lookup by player_id, email, or name
    let playerQuery;
    let queryParams;

    // Check if userId is numeric (player_id lookup)
    if (!isNaN(userId) && Number.isInteger(Number(userId))) {
      playerQuery = `
        SELECT
          player_id,
          name,
          email,
          display_name,
          membership_tier,
          subscription_status,
          subscription_tier,
          subscription_billing_cycle,
          subscription_started_at,
          subscription_current_period_start,
          subscription_current_period_end,
          subscription_cancel_at_period_end,
          is_subscribed,
          zaprite_customer_id,
          zaprite_subscription_id,
          zaprite_payment_method,
          created_at,
          updated_at
        FROM players
        WHERE player_id = $1
      `;
      queryParams = [parseInt(userId)];
    } else {
      // Search by email or name (case-insensitive partial match)
      const searchTerm = userId.trim();
      playerQuery = `
        SELECT
          player_id,
          name,
          email,
          display_name,
          membership_tier,
          subscription_status,
          subscription_tier,
          subscription_billing_cycle,
          subscription_started_at,
          subscription_current_period_start,
          subscription_current_period_end,
          subscription_cancel_at_period_end,
          is_subscribed,
          zaprite_customer_id,
          zaprite_subscription_id,
          zaprite_payment_method,
          created_at,
          updated_at
        FROM players
        WHERE LOWER(email) = LOWER($1)
           OR LOWER(email) LIKE LOWER($2)
           OR LOWER(name) LIKE LOWER($2)
           OR LOWER(display_name) LIKE LOWER($2)
        ORDER BY
          CASE WHEN LOWER(email) = LOWER($1) THEN 1 ELSE 2 END
        LIMIT 1
      `;
      queryParams = [searchTerm, `%${searchTerm}%`];
    }

    const playerResult = await pool.query(playerQuery, queryParams);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const player = playerResult.rows[0];

    // Get all orders/payments
    const ordersQuery = `
      SELECT
        event_id,
        zaprite_event_id,
        zaprite_order_id,
        event_type,
        payment_amount,
        payment_currency,
        payment_method,
        processed,
        processing_error,
        created_at,
        processed_at,
        event_data
      FROM zaprite_events
      WHERE player_id = $1
      ORDER BY created_at DESC
    `;

    const ordersResult = await pool.query(ordersQuery, [player.player_id]);

    // Get gift codes owned by user
    const ownedGiftCodesQuery = `
      SELECT
        id,
        gift_code,
        bundle_id,
        is_redeemed,
        redeemed_by_user_id,
        redeemed_at,
        created_at
      FROM user_gift_subscriptions
      WHERE owner_user_id = $1
      ORDER BY created_at DESC
    `;

    const ownedGiftCodesResult = await pool.query(ownedGiftCodesQuery, [player.player_id]);

    // Get gift codes redeemed by user (where they received the gift)
    const redeemedGiftCodesQuery = `
      SELECT
        ugs.id,
        ugs.gift_code,
        ugs.bundle_id,
        ugs.owner_user_id,
        p.name as gifter_name,
        p.email as gifter_email,
        ugs.redeemed_at,
        ugs.created_at
      FROM user_gift_subscriptions ugs
      LEFT JOIN players p ON ugs.owner_user_id = p.player_id
      WHERE ugs.redeemed_by_user_id = $1
      ORDER BY ugs.redeemed_at DESC
    `;

    const redeemedGiftCodesResult = await pool.query(redeemedGiftCodesQuery, [player.player_id]);

    // Get subscription change timeline (from zaprite_events)
    const timeline = ordersResult.rows.map(event => ({
      date: event.created_at,
      type: event.event_type,
      orderId: event.zaprite_order_id,
      amount: event.payment_amount,
      currency: event.payment_currency,
      status: event.processed ? 'processed' : 'pending',
      error: event.processing_error
    }));

    // Add gift code redemptions to timeline
    redeemedGiftCodesResult.rows.forEach(gc => {
      timeline.push({
        date: gc.redeemed_at,
        type: 'gift_code_redeemed',
        giftCode: gc.gift_code,
        from: gc.gifter_name || gc.gifter_email
      });
    });

    // Sort timeline by date
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      player: {
        playerId: player.player_id,
        name: player.name,
        email: player.email,
        displayName: player.display_name,
        membershipTier: player.membership_tier,
        isSubscribed: player.is_subscribed,
        createdAt: player.created_at
      },
      subscription: {
        status: player.subscription_status,
        tier: player.subscription_tier,
        billingCycle: player.subscription_billing_cycle,
        startedAt: player.subscription_started_at,
        currentPeriodStart: player.subscription_current_period_start,
        currentPeriodEnd: player.subscription_current_period_end,
        cancelAtPeriodEnd: player.subscription_cancel_at_period_end,
        zapriteCustomerId: player.zaprite_customer_id,
        zapriteSubscriptionId: player.zaprite_subscription_id,
        paymentMethod: player.zaprite_payment_method
      },
      orders: ordersResult.rows.map(order => ({
        eventId: order.event_id,
        orderId: order.zaprite_order_id,
        type: order.event_type,
        amount: order.payment_amount,
        currency: order.payment_currency,
        paymentMethod: order.payment_method,
        processed: order.processed,
        error: order.processing_error,
        createdAt: order.created_at,
        processedAt: order.processed_at
      })),
      giftCodes: {
        owned: ownedGiftCodesResult.rows.map(gc => ({
          id: gc.id,
          code: gc.gift_code,
          bundleId: gc.bundle_id,
          isRedeemed: gc.is_redeemed,
          redeemedBy: gc.redeemed_by_user_id,
          redeemedAt: gc.redeemed_at,
          createdAt: gc.created_at
        })),
        redeemed: redeemedGiftCodesResult.rows.map(gc => ({
          id: gc.id,
          code: gc.gift_code,
          bundleId: gc.bundle_id,
          from: {
            playerId: gc.owner_user_id,
            name: gc.gifter_name,
            email: gc.gifter_email
          },
          redeemedAt: gc.redeemed_at,
          createdAt: gc.created_at
        }))
      },
      summary: {
        totalOrders: ordersResult.rows.length,
        totalSpent: ordersResult.rows
          .filter(o => o.processed)
          .reduce((sum, o) => sum + parseFloat(o.payment_amount || 0), 0),
        giftCodesOwned: ownedGiftCodesResult.rows.length,
        giftCodesRedeemed: ownedGiftCodesResult.rows.filter(gc => gc.is_redeemed).length,
        giftCodesReceived: redeemedGiftCodesResult.rows.length
      },
      timeline
    });

  } catch (error) {
    console.error('Admin user history fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user subscription history',
      error: error.message
    });
  }
}
