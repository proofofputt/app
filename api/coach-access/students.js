import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Verify JWT and extract player_id
function getPlayerIdFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.playerId;
  } catch (error) {
    console.error('[Coach Access Students] Token verification error:', error.message);
    return null;
  }
}

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    // Verify authentication
    const coachPlayerId = getPlayerIdFromToken(req);
    if (!coachPlayerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { status = 'active' } = req.query;

    client = await pool.connect();

    // Build query to get students with session statistics
    let query = `
      SELECT
        cag.grant_id,
        cag.student_player_id,
        cag.access_level,
        cag.granted_at,
        cag.revoked_at,
        cag.status,
        cag.notes,
        p.display_name as student_name,
        p.email as student_email,
        p.name as student_full_name,
        p.referred_by_player_id,

        -- Session statistics
        COUNT(DISTINCT s.session_id) as total_sessions,
        MAX(s.created_at) as last_session_date,
        MIN(s.created_at) as first_session_date,

        -- Check if student was referred by coach
        CASE
          WHEN p.referred_by_player_id = $1 THEN true
          ELSE false
        END as is_referral

      FROM coach_access_grants cag
      INNER JOIN players p ON cag.student_player_id = p.player_id
      LEFT JOIN sessions s ON p.player_id = s.player_id
      WHERE cag.coach_player_id = $1
    `;

    const params = [coachPlayerId];

    if (status && status !== 'all') {
      query += ' AND cag.status = $2';
      params.push(status);
    }

    query += `
      GROUP BY
        cag.grant_id,
        cag.student_player_id,
        cag.access_level,
        cag.granted_at,
        cag.revoked_at,
        cag.status,
        cag.notes,
        p.display_name,
        p.email,
        p.name,
        p.referred_by_player_id
      ORDER BY cag.granted_at DESC
    `;

    const result = await client.query(query, params);

    const students = result.rows.map(row => ({
      grant_id: row.grant_id,
      student_player_id: row.student_player_id,
      student_name: row.student_name || row.student_full_name || row.student_email,
      student_email: row.student_email,
      access_level: row.access_level,
      granted_at: row.granted_at,
      revoked_at: row.revoked_at,
      status: row.status,
      notes: row.notes,
      total_sessions: parseInt(row.total_sessions) || 0,
      last_session_date: row.last_session_date,
      first_session_date: row.first_session_date,
      referral_relationship: row.is_referral ? 'direct_referral' : null
    }));

    return res.status(200).json({
      success: true,
      students
    });

  } catch (error) {
    console.error('[Coach Access Students] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
