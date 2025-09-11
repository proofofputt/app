import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

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

  const { playerId } = req.query;

  if (!playerId) {
    return res.status(400).json({ 
      success: false, 
      message: 'playerId is required' 
    });
  }

  // Verify user can access this player's invitations
  if (parseInt(playerId) !== user.playerId) {
    return res.status(403).json({ 
      success: false, 
      message: 'You can only view your own league invitations' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get pending league invitations for the player
    const invitationsResult = await client.query(`
      SELECT 
        li.invitation_id,
        li.league_id,
        li.league_inviter_id,
        li.league_invited_player_id,
        li.invitation_status,
        li.invitation_message,
        li.invited_at,
        li.expires_at,
        l.name as league_name,
        l.description as league_description,
        l.status as league_status,
        l.rules as league_rules,
        inviter.name as inviter_name,
        (SELECT COUNT(*) FROM league_memberships WHERE league_id = l.league_id) as member_count
      FROM league_invitations li
      JOIN leagues l ON li.league_id = l.league_id
      JOIN players inviter ON li.league_inviter_id = inviter.player_id
      WHERE li.league_invited_player_id = $1
      AND li.invitation_status IN ('pending')
      AND li.expires_at > NOW()
      ORDER BY li.invited_at DESC
    `, [playerId]);

    const invitations = invitationsResult.rows.map(invite => ({
      invitation_id: invite.invitation_id,
      league_id: invite.league_id,
      league_name: invite.league_name,
      league_description: invite.league_description,
      league_status: invite.league_status,
      league_rules: invite.league_rules,
      member_count: invite.member_count,
      inviter_id: invite.league_inviter_id,
      inviter_name: invite.inviter_name,
      invited_player_id: invite.league_invited_player_id,
      invitation_status: invite.invitation_status,
      invitation_message: invite.invitation_message,
      invited_at: invite.invited_at,
      expires_at: invite.expires_at
    }));

    // Also get invitation history (accepted/declined/expired) for reference
    const historyResult = await client.query(`
      SELECT 
        li.invitation_id,
        li.league_id,
        li.invitation_status,
        li.invited_at,
        li.responded_at,
        l.name as league_name,
        inviter.name as inviter_name
      FROM league_invitations li
      JOIN leagues l ON li.league_id = l.league_id
      JOIN players inviter ON li.league_inviter_id = inviter.player_id
      WHERE li.league_invited_player_id = $1
      AND li.invitation_status IN ('accepted', 'declined', 'expired')
      ORDER BY li.responded_at DESC
      LIMIT 10
    `, [playerId]);

    return res.status(200).json({
      success: true,
      pending_invitations: invitations,
      invitation_history: historyResult.rows,
      total_pending: invitations.length
    });

  } catch (error) {
    console.error('League invitations fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch league invitations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}