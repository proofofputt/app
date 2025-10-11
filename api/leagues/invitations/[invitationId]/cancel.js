import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../../utils/cors.js';

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

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { invitationId } = req.query;
  const playerId = user.playerId;

  if (!invitationId) {
    return res.status(400).json({
      success: false,
      message: 'invitationId is required'
    });
  }

  let client;
  try {
    client = await pool.connect();

    // Get invitation details and verify user is the inviter
    const invitationResult = await client.query(`
      SELECT
        invitation_id,
        league_id,
        inviting_player_id,
        invited_player_id,
        status
      FROM league_invitations
      WHERE invitation_id = $1
    `, [invitationId]);

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    const invitation = invitationResult.rows[0];

    // Verify the user is the one who sent the invitation
    if (invitation.inviting_player_id !== playerId) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel invitations that you sent'
      });
    }

    // Can only cancel pending invitations
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel invitation with status: ${invitation.status}`
      });
    }

    // Update invitation status to cancelled
    await client.query(`
      UPDATE league_invitations
      SET
        status = 'cancelled',
        responded_at = NOW()
      WHERE invitation_id = $1
    `, [invitationId]);

    return res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}
