import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  const { leagueId } = req.query;
  const { inviter_id, invitee_id, league_invited_player_id, invitation_message } = req.body;

  // Support both naming conventions for transition period
  const inviterId = inviter_id || user.playerId;
  const inviteeId = invitee_id || league_invited_player_id;

  if (!leagueId || !inviteeId) {
    return res.status(400).json({ 
      success: false, 
      message: 'leagueId and invitee player ID are required' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get the league and verify permissions
    const leagueResult = await client.query(`
      SELECT 
        l.league_id,
        l.name,
        l.league_creator_id,
        l.status,
        l.rules,
        lm.member_role
      FROM leagues l
      LEFT JOIN league_memberships lm ON l.league_id = lm.league_id AND lm.player_id = $2
      WHERE l.league_id = $1
    `, [leagueId, inviterId]);

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'League not found' 
      });
    }

    const league = leagueResult.rows[0];

    // Check if user has permission to invite (creator, admin, or if league allows member invites)
    const canInvite = (
      league.league_creator_id === parseInt(inviterId) ||
      league.member_role === 'admin' ||
      (league.member_role === 'member' && league.rules?.allow_player_invites)
    );

    if (!canInvite) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to invite players to this league' 
      });
    }

    // Check if league is accepting new members
    if (!['setup', 'registering', 'active'].includes(league.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot invite players to league with status: ${league.status}` 
      });
    }

    // Check if invitee exists
    const inviteeResult = await client.query(`
      SELECT player_id, name, email FROM players WHERE player_id = $1
    `, [inviteeId]);

    if (inviteeResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invited player not found' 
      });
    }

    const invitee = inviteeResult.rows[0];

    // Check if player is already a member
    const membershipResult = await client.query(`
      SELECT membership_id FROM league_memberships 
      WHERE league_id = $1 AND player_id = $2
    `, [leagueId, inviteeId]);

    if (membershipResult.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Player is already a member of this league' 
      });
    }

    // Check for existing pending invitation
    const existingInviteResult = await client.query(`
      SELECT invitation_id FROM league_invitations 
      WHERE league_id = $1 AND league_invited_player_id = $2 AND invitation_status = 'pending'
    `, [leagueId, inviteeId]);

    if (existingInviteResult.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Player already has a pending invitation to this league' 
      });
    }

    // Create the invitation
    const invitationResult = await client.query(`
      INSERT INTO league_invitations (
        league_id, 
        league_inviter_id, 
        league_invited_player_id,
        invitation_status,
        invitation_message,
        invited_at,
        expires_at
      )
      VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW() + INTERVAL '7 days')
      RETURNING 
        invitation_id, 
        league_id,
        league_inviter_id,
        league_invited_player_id,
        invitation_status,
        invited_at,
        expires_at
    `, [leagueId, inviterId, inviteeId, invitation_message || null]);

    const invitation = invitationResult.rows[0];

    // Get inviter name for response
    const inviterResult = await client.query(`
      SELECT name FROM players WHERE player_id = $1
    `, [inviterId]);

    return res.status(201).json({
      success: true,
      message: `League invitation sent to ${invitee.name}`,
      invitation: {
        invitation_id: invitation.invitation_id,
        league_id: invitation.league_id,
        league_name: league.name,
        inviter_id: invitation.league_inviter_id,
        inviter_name: inviterResult.rows[0]?.name,
        invited_player_id: invitation.league_invited_player_id,
        invited_player_name: invitee.name,
        invitation_status: invitation.invitation_status,
        invited_at: invitation.invited_at,
        expires_at: invitation.expires_at
      }
    });

  } catch (error) {
    console.error('League invite error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send league invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}