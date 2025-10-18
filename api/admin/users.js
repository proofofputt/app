import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import { requireAdmin } from '../../utils/adminAuth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      return await handleGetAllUsers(req, res, client);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Admin users API error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// GET: Retrieve all users with filters and search (admin only)
async function handleGetAllUsers(req, res, client) {
  const {
    search = '',
    membership_tier,
    sort_by = 'created_at',
    sort_order = 'desc',
    limit = 50,
    offset = 0
  } = req.query;

  // Build the main query
  let query = `
    SELECT
      p.player_id,
      p.email,
      p.first_name,
      p.last_name,
      p.display_name,
      p.name,
      p.phone,
      p.membership_tier,
      p.created_at,
      p.timezone,
      p.referral_code,
      p.is_subscriber,
      p.referred_by_player_id,
      p.hubspot_contact_id,
      p.hubspot_last_sync_at,
      p.hubspot_sync_status,
      referrer.display_name as referred_by_display_name,
      COUNT(DISTINCT s.session_id) as total_sessions,
      MAX(s.created_at) as last_session_date
    FROM players p
    LEFT JOIN players referrer ON p.referred_by_player_id = referrer.player_id
    LEFT JOIN sessions s ON p.player_id = s.player_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  // Search filter (email, name, display_name, player_id)
  if (search && search.trim() !== '') {
    paramCount++;
    query += ` AND (
      p.email ILIKE $${paramCount}
      OR p.display_name ILIKE $${paramCount}
      OR p.name ILIKE $${paramCount}
      OR p.first_name ILIKE $${paramCount}
      OR p.last_name ILIKE $${paramCount}
      OR CAST(p.player_id AS TEXT) = $${paramCount + 1}
    )`;
    params.push(`%${search.trim()}%`, search.trim());
    paramCount++; // Account for the second parameter
  }

  // Membership tier filter
  if (membership_tier) {
    paramCount++;
    query += ` AND p.membership_tier = $${paramCount}`;
    params.push(membership_tier);
  }

  query += ` GROUP BY p.player_id, referrer.display_name`;

  // Sorting
  const validSortColumns = {
    'created_at': 'p.created_at',
    'email': 'p.email',
    'name': 'p.name',
    'display_name': 'p.display_name',
    'membership_tier': 'p.membership_tier',
    'referred_by_display_name': 'referrer.display_name',
    'last_session_date': 'MAX(s.created_at)',
    'total_sessions': 'COUNT(DISTINCT s.session_id)'
  };

  const sortColumn = validSortColumns[sort_by] || 'p.created_at';
  const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortColumn} ${sortDirection} NULLS LAST`;

  // Pagination
  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  console.log('[Admin Users] Executing query with params:', { search, membership_tier, sort_by, sort_order, limit, offset });

  const usersResult = await client.query(query, params);

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) FROM players p WHERE 1=1`;
  const countParams = [];
  let countParamCount = 0;

  if (search && search.trim() !== '') {
    countParamCount++;
    countQuery += ` AND (
      p.email ILIKE $${countParamCount}
      OR p.display_name ILIKE $${countParamCount}
      OR p.name ILIKE $${countParamCount}
      OR p.first_name ILIKE $${countParamCount}
      OR p.last_name ILIKE $${countParamCount}
      OR CAST(p.player_id AS TEXT) = $${countParamCount + 1}
    )`;
    countParams.push(`%${search.trim()}%`, search.trim());
    countParamCount++;
  }

  if (membership_tier) {
    countParamCount++;
    countQuery += ` AND p.membership_tier = $${countParamCount}`;
    countParams.push(membership_tier);
  }

  const countResult = await client.query(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count);

  return res.status(200).json({
    success: true,
    users: usersResult.rows,
    pagination: {
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
    }
  });
}

// Export with admin protection
export default requireAdmin(handler);
