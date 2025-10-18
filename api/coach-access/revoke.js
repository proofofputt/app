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
    console.error('[Coach Access Revoke] Token verification error:', error.message);
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

    const { grant_id, coach_player_id } = req.body;

    // Require either grant_id or coach_player_id
    if (!grant_id && !coach_player_id) {
      return res.status(400).json({
        success: false,
        message: 'Either grant_id or coach_player_id is required'
      });
    }

    client = await pool.connect();

    let result;

    if (grant_id) {
      // Revoke by grant_id (verify it belongs to the current user)
      result = await client.query(
        `UPDATE coach_access_grants
         SET status = 'revoked',
             revoked_at = NOW()
         WHERE grant_id = $1 AND student_player_id = $2 AND status = 'active'
         RETURNING grant_id, coach_player_id`,
        [grant_id, studentPlayerId]
      );
    } else {
      // Revoke by coach_player_id
      result = await client.query(
        `UPDATE coach_access_grants
         SET status = 'revoked',
             revoked_at = NOW()
         WHERE student_player_id = $1 AND coach_player_id = $2 AND status = 'active'
         RETURNING grant_id, coach_player_id`,
        [studentPlayerId, coach_player_id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active grant found to revoke'
      });
    }

    const revokedGrant = result.rows[0];

    console.log(`[Coach Access] Revoked grant ${revokedGrant.grant_id} for student ${studentPlayerId} → coach ${revokedGrant.coach_player_id}`);

    return res.status(200).json({
      success: true,
      message: 'Coach access revoked successfully',
      grant_id: revokedGrant.grant_id,
      coach_player_id: revokedGrant.coach_player_id
    });

  } catch (error) {
    console.error('[Coach Access Revoke] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke coach access',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
