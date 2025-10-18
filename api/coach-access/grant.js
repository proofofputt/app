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
    console.error('[Coach Access Grant] Token verification error:', error.message);
    return null;
  }
}

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

    const { coach_player_id, access_level = 'full_sessions', notes = null } = req.body;

    // Validation
    if (!coach_player_id) {
      return res.status(400).json({
        success: false,
        message: 'coach_player_id is required'
      });
    }

    // Validate access level
    const validAccessLevels = ['full_sessions', 'stats_only', 'current_month'];
    if (!validAccessLevels.includes(access_level)) {
      return res.status(400).json({
        success: false,
        message: `Invalid access_level. Must be one of: ${validAccessLevels.join(', ')}`
      });
    }

    // Prevent self-granting
    if (studentPlayerId === coach_player_id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot grant coach access to yourself'
      });
    }

    client = await pool.connect();

    // Verify coach exists
    const coachCheck = await client.query(
      'SELECT player_id, display_name, email FROM players WHERE player_id = $1',
      [coach_player_id]
    );

    if (coachCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    const coach = coachCheck.rows[0];

    // Check if grant already exists
    const existingGrant = await client.query(
      `SELECT grant_id, status FROM coach_access_grants
       WHERE student_player_id = $1 AND coach_player_id = $2`,
      [studentPlayerId, coach_player_id]
    );

    let grant;

    if (existingGrant.rows.length > 0) {
      // Update existing grant (reactivate if revoked)
      const result = await client.query(
        `UPDATE coach_access_grants
         SET status = 'active',
             access_level = $1,
             notes = $2,
             granted_at = NOW(),
             revoked_at = NULL
         WHERE student_player_id = $3 AND coach_player_id = $4
         RETURNING grant_id, granted_at, access_level, notes`,
        [access_level, notes, studentPlayerId, coach_player_id]
      );
      grant = result.rows[0];
      console.log(`[Coach Access] Reactivated grant ${grant.grant_id} for student ${studentPlayerId} → coach ${coach_player_id}`);
    } else {
      // Create new grant
      const result = await client.query(
        `INSERT INTO coach_access_grants
         (student_player_id, coach_player_id, access_level, notes, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING grant_id, granted_at, access_level, notes`,
        [studentPlayerId, coach_player_id, access_level, notes]
      );
      grant = result.rows[0];
      console.log(`[Coach Access] Created new grant ${grant.grant_id} for student ${studentPlayerId} → coach ${coach_player_id}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Coach access granted successfully',
      grant: {
        grant_id: grant.grant_id,
        coach_player_id: coach_player_id,
        coach_name: coach.display_name || coach.email,
        coach_email: coach.email,
        granted_at: grant.granted_at,
        access_level: grant.access_level,
        notes: grant.notes
      }
    });

  } catch (error) {
    console.error('[Coach Access Grant] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to grant coach access',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
