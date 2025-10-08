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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { inviteId } = req.query;
  const { player_id, action } = req.body;

  if (!inviteId || !player_id || !action) {
    return res.status(400).json({ 
      success: false, 
      message: 'inviteId, player_id, and action are required' 
    });
  }

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Action must be either "accept" or "decline"' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get the invitation and verify the player is the invited player
    const invitationResult = await client.query(`
      SELECT
        li.invitation_id,
        li.league_id,
        li.inviting_user_id,
        li.invited_user_id,
        li.status,
        li.expires_at,
        l.name as league_name,
        l.status as league_status,
        inviter.name as inviter_name,
        invited.name as invited_player_name
      FROM league_invitations li
      JOIN leagues l ON li.league_id = l.league_id
      JOIN players inviter ON li.inviting_user_id = inviter.player_id
      JOIN players invited ON li.invited_user_id = invited.player_id
      WHERE li.invitation_id = $1
    `, [inviteId]);

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'League invitation not found' 
      });
    }

    const invitation = invitationResult.rows[0];

    // Verify the player is the invited player
    if (parseInt(player_id) !== invitation.invited_user_id) {
      return res.status(403).json({
        success: false,
        message: 'Only the invited player can respond to this invitation'
      });
    }

    // Verify the invitation is pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot respond to invitation with status: ${invitation.status}`
      });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update invitation to expired
      await client.query(`
        UPDATE league_invitations
        SET status = 'expired', responded_at = NOW()
        WHERE invitation_id = $1
      `, [inviteId]);

      return res.status(400).json({ 
        success: false, 
        message: 'This invitation has expired' 
      });
    }

    // Update the invitation status
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await client.query(`
      UPDATE league_invitations
      SET
        status = $1,
        responded_at = NOW()
      WHERE invitation_id = $2
    `, [newStatus, inviteId]);

    let responseMessage = `League invitation ${action}ed`;

    // If accepted, add player to league
    if (action === 'accept') {
      // Check if league still accepting members
      if (!['setup', 'registering', 'active'].includes(invitation.league_status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot join league with status: ${invitation.league_status}` 
        });
      }

      // Add player to league membership
      await client.query(`
        INSERT INTO league_memberships (
          league_id,
          player_id,
          league_member_id,
          league_inviter_id,
          member_role,
          is_active,
          joined_at
        )
        VALUES ($1, $2, $2, $3, 'member', true, NOW())
        ON CONFLICT (league_id, player_id) DO NOTHING
      `, [invitation.league_id, invitation.invited_user_id, invitation.inviting_user_id]);

      responseMessage = `Successfully joined ${invitation.league_name}`;
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
      invitation: {
        invitation_id: invitation.invitation_id,
        league_id: invitation.league_id,
        league_name: invitation.league_name,
        inviter_name: invitation.inviter_name,
        invited_player_name: invitation.invited_player_name,
        invitation_status: newStatus,
        action_taken: action
      }
    });

  } catch (error) {
    console.error('League invitation respond error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to respond to league invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}