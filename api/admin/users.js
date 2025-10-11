import pg from 'pg';
import crypto from 'crypto';
import { requireAdmin, requirePermission, PERMISSIONS } from '../../utils/admin-middleware.js';
import { logApiRequest, logApiResponse, createRequestLogger } from '../../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Admin Endpoint: View Users and Subscriptions
 *
 * GET /api/admin/users?search=email&page=1&limit=50
 *
 * Query Parameters:
 * - search: Email or player_id to search for (optional)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - subscriptionStatus: Filter by status (active|canceled|expired)
 * - adminRole: Filter by admin role (main_admin|customer_support)
 */
async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId, req.admin.player_id);

  if (req.method !== 'GET') {
    logApiResponse('/api/admin/users', 'GET', 405, { requestId });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  logApiRequest('/api/admin/users', 'GET', { requestId, adminId: req.admin.player_id });

  const {
    search,
    page = 1,
    limit = 50,
    subscriptionStatus,
    adminRole
  } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Build query
    let query = `
      SELECT
        player_id,
        email,
        display_name,
        name,
        subscription_status,
        subscription_tier,
        is_subscribed,
        subscription_started_at,
        subscription_current_period_end,
        admin_role,
        admin_granted_at,
        created_at,
        updated_at,
        (
          SELECT COUNT(*)
          FROM user_gift_subscriptions
          WHERE owner_user_id = players.player_id AND is_redeemed = FALSE
        ) as available_gift_codes,
        (
          SELECT COUNT(*)
          FROM admin_granted_subscriptions
          WHERE granted_to_player_id = players.player_id AND is_active = TRUE
        ) as admin_granted_count
      FROM players
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Search filter
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      // Check if it's a player_id (numeric) or email
      if (/^\d+$/.test(searchTerm)) {
        query += ` AND player_id = $${paramIndex}`;
        params.push(parseInt(searchTerm));
        paramIndex++;
      } else {
        query += ` AND (email ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }
    }

    // Subscription status filter
    if (subscriptionStatus) {
      query += ` AND subscription_status = $${paramIndex}`;
      params.push(subscriptionStatus);
      paramIndex++;
    }

    // Admin role filter
    if (adminRole) {
      query += ` AND admin_role = $${paramIndex}`;
      params.push(adminRole);
      paramIndex++;
    }

    // Order and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    // Execute query
    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM players WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      if (/^\d+$/.test(searchTerm)) {
        countQuery += ` AND player_id = $${countParamIndex}`;
        countParams.push(parseInt(searchTerm));
        countParamIndex++;
      } else {
        countQuery += ` AND (email ILIKE $${countParamIndex} OR display_name ILIKE $${countParamIndex})`;
        countParams.push(`%${searchTerm}%`);
        countParamIndex++;
      }
    }

    if (subscriptionStatus) {
      countQuery += ` AND subscription_status = $${countParamIndex}`;
      countParams.push(subscriptionStatus);
      countParamIndex++;
    }

    if (adminRole) {
      countQuery += ` AND admin_role = $${countParamIndex}`;
      countParams.push(adminRole);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalUsers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalUsers / limitNum);

    logger.info('Users fetched', {
      count: result.rows.length,
      page: pageNum,
      totalUsers
    });

    logApiResponse('/api/admin/users', 'GET', 200, {
      requestId,
      adminId: req.admin.player_id,
      count: result.rows.length
    });

    return res.status(200).json({
      success: true,
      users: result.rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrevious: pageNum > 1
      },
      filters: {
        search: search || null,
        subscriptionStatus: subscriptionStatus || null,
        adminRole: adminRole || null
      }
    });

  } catch (error) {
    logger.error('Error fetching users', error);

    logApiResponse('/api/admin/users', 'GET', 500, {
      requestId,
      reason: 'internal_error',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
}

// Apply middleware
export default function(req, res) {
  requireAdmin(req, res, () => {
    requirePermission(PERMISSIONS.VIEW_USERS)(req, res, () => {
      handler(req, res);
    });
  });
}
