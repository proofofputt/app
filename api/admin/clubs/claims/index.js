/**
 * Admin Club Claim Requests API
 * ============================================================================
 * GET /api/admin/clubs/claims - List all club claim requests with filtering
 *
 * Admin only endpoint for viewing and managing club claim requests
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../utils/cors.js';
import { verifyToken } from '../../../../utils/auth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  const user = await verifyToken(req);

  if (!user || !user.playerId) {
    return { authorized: false, message: 'Authentication required' };
  }

  const result = await pool.query(
    'SELECT player_id, is_admin FROM players WHERE player_id = $1 AND is_admin = TRUE',
    [user.playerId]
  );

  if (result.rows.length === 0) {
    return { authorized: false, message: 'Admin access required' };
  }

  return { authorized: true, playerId: user.playerId };
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  // Verify admin access
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.authorized) {
    return res.status(403).json({
      success: false,
      message: adminCheck.message,
    });
  }

  try {
    const {
      status = 'pending',
      club_id = '',
      limit = 50,
      offset = 0,
      sort_by = 'requested_at',
      sort_order = 'desc',
    } = req.query;

    let query = `
      SELECT
        ccr.claim_id,
        ccr.club_id,
        ccr.player_id,
        ccr.position,
        ccr.work_email,
        ccr.work_phone,
        ccr.verification_notes,
        ccr.message,
        ccr.status,
        ccr.requested_at,
        ccr.reviewed_at,
        ccr.admin_notes,
        c.name as club_name,
        c.address_city,
        c.address_state,
        p.name as player_name,
        p.email as player_email,
        u.username,
        u.display_name,
        admin.name as reviewed_by_name
      FROM club_claim_requests ccr
      JOIN clubs c ON ccr.club_id = c.club_id
      JOIN players p ON ccr.player_id = p.player_id
      LEFT JOIN users u ON p.player_id = u.id
      LEFT JOIN players admin ON ccr.reviewed_by_admin_id = admin.player_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Status filter
    if (status && status !== 'all') {
      paramCount++;
      query += ` AND ccr.status = $${paramCount}`;
      params.push(status);
    }

    // Club filter
    if (club_id) {
      paramCount++;
      query += ` AND ccr.club_id = $${paramCount}`;
      params.push(parseInt(club_id));
    }

    // Sort
    const validSortFields = ['requested_at', 'reviewed_at', 'club_name', 'player_name'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'requested_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Map sort fields to actual column names
    let sortColumn = sortField;
    if (sortField === 'requested_at') sortColumn = 'ccr.requested_at';
    if (sortField === 'reviewed_at') sortColumn = 'ccr.reviewed_at';
    if (sortField === 'club_name') sortColumn = 'c.name';
    if (sortField === 'player_name') sortColumn = 'p.name';

    query += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // Pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*)
      FROM club_claim_requests ccr
      WHERE 1=1
    `;

    const countParams = [];
    let countParamCount = 0;

    if (status && status !== 'all') {
      countParamCount++;
      countQuery += ` AND ccr.status = $${countParamCount}`;
      countParams.push(status);
    }

    if (club_id) {
      countParamCount++;
      countQuery += ` AND ccr.club_id = $${countParamCount}`;
      countParams.push(parseInt(club_id));
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get status summary
    const summaryResult = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM club_claim_requests
      GROUP BY status
    `);

    const statusSummary = {};
    summaryResult.rows.forEach(row => {
      statusSummary[row.status] = parseInt(row.count);
    });

    return res.status(200).json({
      success: true,
      claims: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount,
      },
      statusSummary,
    });
  } catch (error) {
    console.error('Error fetching club claims:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch club claims',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
