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
    console.error('[Toggle Coach Access] Token verification error:', error.message);
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

    const { friend_id, enable, access_level = 'full_sessions', notes = null } = req.body;

    if (!friend_id) {
      return res.status(400).json({
        success: false,
        message: 'friend_id is required'
      });
    }

    client = await pool.connect();

    // Verify friendship exists
    const friendshipCheck = await client.query(
      'SELECT friendship_id FROM friendships WHERE player_id = $1 AND friend_id = $2 AND status = $3',
      [studentPlayerId, friend_id, 'accepted']
    );

    if (friendshipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found. You must be friends to grant coach access.'
      });
    }

    if (enable) {
      // Grant or update coach access
      const grantResult = await client.query(
        `INSERT INTO coach_access_grants
         (student_player_id, coach_player_id, access_level, notes, status, granted_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())
         ON CONFLICT (student_player_id, coach_player_id)
         DO UPDATE SET
           status = 'active',
           access_level = EXCLUDED.access_level,
           notes = EXCLUDED.notes,
           granted_at = NOW(),
           revoked_at = NULL
         RETURNING grant_id, access_level, granted_at`,
        [studentPlayerId, friend_id, access_level, notes]
      );

      const grant = grantResult.rows[0];

      console.log(`[Toggle Coach Access] Granted access: Student ${studentPlayerId} → Coach ${friend_id}`);

      return res.status(200).json({
        success: true,
        message: 'Coach access granted',
        enabled: true,
        grant: {
          grant_id: grant.grant_id,
          access_level: grant.access_level,
          granted_at: grant.granted_at
        }
      });

    } else {
      // Revoke coach access
      const revokeResult = await client.query(
        `UPDATE coach_access_grants
         SET status = 'revoked', revoked_at = NOW()
         WHERE student_player_id = $1 AND coach_player_id = $2 AND status = 'active'
         RETURNING grant_id`,
        [studentPlayerId, friend_id]
      );

      if (revokeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active coach access grant found to revoke'
        });
      }

      console.log(`[Toggle Coach Access] Revoked access: Student ${studentPlayerId} → Coach ${friend_id}`);

      return res.status(200).json({
        success: true,
        message: 'Coach access revoked',
        enabled: false
      });
    }

  } catch (error) {
    console.error('[Toggle Coach Access] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle coach access',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
