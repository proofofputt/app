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
 * Admin Endpoint: View Admin Activity Log
 *
 * GET /api/admin/activity-log?page=1&limit=50&adminId=123&actionType=grant_subscription
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - adminId: Filter by specific admin (optional)
 * - actionType: Filter by action type (optional)
 * - targetPlayerId: Filter by target user (optional)
 * - days: Filter by last N days (default: 30)
 */
async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId, req.admin.player_id);

  if (req.method !== 'GET') {
    logApiResponse('/api/admin/activity-log', 'GET', 405, { requestId });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  logApiRequest('/api/admin/activity-log', 'GET', { requestId, adminId: req.admin.player_id });

  const {
    page = 1,
    limit = 50,
    adminId,
    actionType,
    targetPlayerId,
    days = 30
  } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offset = (pageNum - 1) * limitNum;
  const daysNum = parseInt(days) || 30;

  try {
    // Build query
    let query = `
      SELECT
        aal.activity_id,
        aal.admin_player_id,
        aal.admin_role,
        aal.action_type,
        aal.target_player_id,
        aal.target_email,
        aal.action_data,
        aal.reason,
        aal.notes,
        aal.ip_address,
        aal.status,
        aal.error_message,
        aal.created_at,
        admin.email as admin_email,
        admin.display_name as admin_display_name,
        target.email as target_user_email,
        target.display_name as target_user_display_name
      FROM admin_activity_log aal
      LEFT JOIN players admin ON admin.player_id = aal.admin_player_id
      LEFT JOIN players target ON target.player_id = aal.target_player_id
      WHERE aal.created_at > NOW() - INTERVAL '${daysNum} days'
    `;

    const params = [];
    let paramIndex = 1;

    // Admin filter
    if (adminId) {
      query += ` AND aal.admin_player_id = $${paramIndex}`;
      params.push(parseInt(adminId));
      paramIndex++;
    }

    // Action type filter
    if (actionType) {
      query += ` AND aal.action_type = $${paramIndex}`;
      params.push(actionType);
      paramIndex++;
    }

    // Target player filter
    if (targetPlayerId) {
      query += ` AND aal.target_player_id = $${paramIndex}`;
      params.push(parseInt(targetPlayerId));
      paramIndex++;
    }

    // Order and pagination
    query += ` ORDER BY aal.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    // Execute query
    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM admin_activity_log
      WHERE created_at > NOW() - INTERVAL '${daysNum} days'
    `;

    const countParams = [];
    let countParamIndex = 1;

    if (adminId) {
      countQuery += ` AND admin_player_id = $${countParamIndex}`;
      countParams.push(parseInt(adminId));
      countParamIndex++;
    }

    if (actionType) {
      countQuery += ` AND action_type = $${countParamIndex}`;
      countParams.push(actionType);
      countParamIndex++;
    }

    if (targetPlayerId) {
      countQuery += ` AND target_player_id = $${countParamIndex}`;
      countParams.push(parseInt(targetPlayerId));
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalActivities = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalActivities / limitNum);

    // Get summary statistics
    const summaryResult = await pool.query(
      `SELECT
        action_type,
        COUNT(*)::INTEGER as count,
        MAX(created_at) as most_recent
      FROM admin_activity_log
      WHERE created_at > NOW() - INTERVAL '${daysNum} days'
      ${adminId ? `AND admin_player_id = $1` : ''}
      GROUP BY action_type
      ORDER BY count DESC`,
      adminId ? [parseInt(adminId)] : []
    );

    logger.info('Activity log fetched', {
      count: result.rows.length,
      page: pageNum,
      totalActivities
    });

    logApiResponse('/api/admin/activity-log', 'GET', 200, {
      requestId,
      adminId: req.admin.player_id,
      count: result.rows.length
    });

    return res.status(200).json({
      success: true,
      activities: result.rows,
      summary: summaryResult.rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalActivities,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrevious: pageNum > 1
      },
      filters: {
        adminId: adminId ? parseInt(adminId) : null,
        actionType: actionType || null,
        targetPlayerId: targetPlayerId ? parseInt(targetPlayerId) : null,
        days: daysNum
      }
    });

  } catch (error) {
    logger.error('Error fetching activity log', error);

    logApiResponse('/api/admin/activity-log', 'GET', 500, {
      requestId,
      reason: 'internal_error',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch activity log'
    });
  }
}

// Apply middleware
export default function(req, res) {
  requireAdmin(req, res, () => {
    requirePermission(PERMISSIONS.VIEW_ACTIVITY_LOG)(req, res, () => {
      handler(req, res);
    });
  });
}
