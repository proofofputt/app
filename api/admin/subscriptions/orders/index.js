/**
 * Admin API: Get all subscription orders
 * GET /api/admin/subscriptions/orders
 *
 * Query params:
 * - status: filter by order status (all, paid, pending, failed)
 * - type: filter by type (all, subscription, bundle)
 * - search: search by player name, email, or order ID
 * - limit: pagination limit (default 50)
 * - offset: pagination offset (default 0)
 * - sortBy: sort field (created_at, amount, status)
 * - sortOrder: asc or desc
 */

import { Pool } from 'pg';
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

  try {
    const {
      status = 'all',
      type = 'all',
      search = '',
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Status filter
    if (status !== 'all') {
      paramCount++;
      conditions.push(`ze.event_type = $${paramCount}`);
      params.push(status === 'paid' ? 'order.paid' : status);
    }

    // Type filter (bundle vs subscription)
    if (type !== 'all') {
      paramCount++;
      if (type === 'bundle') {
        conditions.push(`(ze.event_data->>'metadata')::jsonb->>'type' = $${paramCount}`);
        params.push('bundle');
      } else if (type === 'subscription') {
        conditions.push(`(
          (ze.event_data->>'metadata')::jsonb->>'type' IS NULL OR
          (ze.event_data->>'metadata')::jsonb->>'type' != $${paramCount}
        )`);
        params.push('bundle');
      }
    }

    // Search filter
    if (search) {
      paramCount++;
      conditions.push(`(
        p.name ILIKE $${paramCount} OR
        p.email ILIKE $${paramCount} OR
        ze.zaprite_order_id ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort fields
    const validSortFields = ['created_at', 'payment_amount', 'event_type'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Main query
    const query = `
      SELECT
        ze.event_id,
        ze.zaprite_event_id,
        ze.zaprite_order_id,
        ze.event_type,
        ze.player_id,
        p.name as player_name,
        p.email as player_email,
        ze.payment_amount,
        ze.payment_currency,
        ze.payment_method,
        ze.processed,
        ze.processing_error,
        ze.created_at,
        ze.processed_at,
        ze.event_data,
        -- Extract bundle info if available
        (ze.event_data->>'metadata')::jsonb->>'type' as order_type,
        (ze.event_data->>'metadata')::jsonb->>'bundleId' as bundle_id,
        (ze.event_data->>'metadata')::jsonb->>'bundleQuantity' as bundle_quantity,
        -- Count gift codes generated for this order
        (
          SELECT COUNT(*)
          FROM user_gift_subscriptions ugs
          WHERE ugs.owner_player_id = ze.player_id
            AND ugs.created_at >= ze.created_at
            AND ugs.created_at <= ze.created_at + INTERVAL '5 minutes'
        ) as gift_codes_generated
      FROM zaprite_events ze
      LEFT JOIN players p ON ze.player_id = p.player_id
      ${whereClause}
      ORDER BY ze.${sortField} ${sortDirection}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(parseInt(limit), parseInt(offset));

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM zaprite_events ze
      LEFT JOIN players p ON ze.player_id = p.player_id
      ${whereClause}
    `;

    const countParams = params.slice(0, paramCount);

    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const orders = ordersResult.rows.map(row => ({
      eventId: row.event_id,
      orderId: row.zaprite_order_id,
      eventType: row.event_type,
      playerId: row.player_id,
      playerName: row.player_name,
      playerEmail: row.player_email,
      amount: row.payment_amount,
      currency: row.payment_currency,
      paymentMethod: row.payment_method,
      processed: row.processed,
      error: row.processing_error,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      orderType: row.order_type || 'subscription',
      bundleId: row.bundle_id,
      bundleQuantity: row.bundle_quantity,
      giftCodesGenerated: parseInt(row.gift_codes_generated) || 0
    }));

    const total = parseInt(countResult.rows[0].total);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });

  } catch (error) {
    console.error('Admin orders fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
}
