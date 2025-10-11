import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { type = 'received' } = req.query; // 'sent' or 'received'
  const playerId = user.playerId;

  let client;
  try {
    client = await pool.connect();

    let query;
    let params;

    if (type === 'sent') {
      // Invitations sent by this player
      query = `
        SELECT
          li.invitation_id,
          li.league_id,
          l.name as league_name,
          l.status as league_status,
          li.inviting_player_id,
          inviter.name as inviter_name,
          li.invited_player_id,
          invited.name as invited_player_name,
          invited.email as invited_player_email,
          li.status,
          li.message,
          li.invitation_method,
          li.created_at,
          li.expires_at,
          li.responded_at
        FROM league_invitations li
        JOIN leagues l ON li.league_id = l.league_id
        JOIN players inviter ON li.inviting_player_id = inviter.player_id
        LEFT JOIN players invited ON li.invited_player_id = invited.player_id
        WHERE li.inviting_player_id = $1
        ORDER BY li.created_at DESC
      `;
      params = [playerId];
    } else {
      // Invitations received by this player
      query = `
        SELECT
          li.invitation_id,
          li.league_id,
          l.name as league_name,
          l.description as league_description,
          l.status as league_status,
          l.settings as league_settings,
          li.inviting_player_id,
          inviter.name as inviter_name,
          li.invited_player_id,
          li.status,
          li.message,
          li.invitation_method,
          li.created_at,
          li.expires_at,
          li.responded_at
        FROM league_invitations li
        JOIN leagues l ON li.league_id = l.league_id
        JOIN players inviter ON li.inviting_player_id = inviter.player_id
        WHERE li.invited_player_id = $1
        ORDER BY li.created_at DESC
      `;
      params = [playerId];
    }

    const result = await client.query(query, params);

    return res.status(200).json({
      success: true,
      invitations: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invitations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}
