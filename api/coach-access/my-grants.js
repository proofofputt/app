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
    console.error('[Coach Access My Grants] Token verification error:', error.message);
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
    const studentPlayerId = getPlayerIdFromToken(req);
    if (!studentPlayerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { status = 'active' } = req.query;

    client = await pool.connect();

    // Build query based on status filter
    let query = `
      SELECT
        cag.grant_id,
        cag.coach_player_id,
        cag.access_level,
        cag.granted_at,
        cag.revoked_at,
        cag.status,
        cag.notes,
        p.display_name as coach_name,
        p.email as coach_email,
        p.name as coach_full_name
      FROM coach_access_grants cag
      INNER JOIN players p ON cag.coach_player_id = p.player_id
      WHERE cag.student_player_id = $1
    `;

    const params = [studentPlayerId];

    if (status && status !== 'all') {
      query += ' AND cag.status = $2';
      params.push(status);
    }

    query += ' ORDER BY cag.granted_at DESC';

    const result = await client.query(query, params);

    const grants = result.rows.map(row => ({
      grant_id: row.grant_id,
      coach_player_id: row.coach_player_id,
      coach_name: row.coach_name || row.coach_full_name || row.coach_email,
      coach_email: row.coach_email,
      access_level: row.access_level,
      granted_at: row.granted_at,
      revoked_at: row.revoked_at,
      status: row.status,
      notes: row.notes
    }));

    return res.status(200).json({
      success: true,
      grants
    });

  } catch (error) {
    console.error('[Coach Access My Grants] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve coach access grants',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
