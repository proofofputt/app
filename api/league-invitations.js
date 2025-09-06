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

/**
 * Get invitation details by token (for external invitations)
 */
async function getInvitationByToken(client, token) {
  const result = await client.query(`
    SELECT 
      li.*,
      l.name as league_name,
      l.description as league_description,
      l.league_type,
      l.max_members,
      l.rules as league_rules,
      l.privacy_level,
      l.start_date,
      l.end_date,
      inviter.display_name as inviter_name,
      inviter.username as inviter_username,
      (SELECT COUNT(*) FROM league_memberships lm WHERE lm.league_id = li.league_id AND lm.is_active = true) as current_members
    FROM league_invitations li
    JOIN leagues l ON li.league_id = l.league_id
    LEFT JOIN users inviter ON li.inviting_user_id = inviter.id
    WHERE li.invitation_token = $1
  `, [token]);
  
  return result.rows[0] || null;
}

/**
 * Create new user account from league invitation
 */
async function createUserFromInvitation(client, invitation, registrationData) {
  const { username, email, phone, display_name } = registrationData;
  
  // Validate required fields
  if (!username || (!email && !phone)) {
    throw new Error('Username and either email or phone number are required');
  }

  // Check if username/email/phone already exist
  const existingUser = await client.query(`
    SELECT id FROM users 
    WHERE username = $1 OR email = $2 OR phone_number = $3
  `, [username, email, phone]);
  
  if (existingUser.rows.length > 0) {
    throw new Error('User with this username, email, or phone already exists');
  }

  // Create new user
  const userResult = await client.query(`
    INSERT INTO users (username, email, phone_number, display_name, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id
  `, [username, email, phone, display_name || username]);
  
  const userId = userResult.rows[0].id;
  
  // Create default privacy settings
  await client.query(`
    INSERT INTO user_privacy_settings (user_id, created_at, updated_at)
    VALUES ($1, NOW(), NOW())
  `, [userId]);
  
  // Initialize player stats
  await client.query(`
    INSERT INTO player_stats (player_id, created_at, updated_at)
    VALUES ($1, NOW(), NOW())
  `, [userId]);
  
  return userId;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      // Get invitation details (for displaying invitation page)
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invitation token is required' 
        });
      }

      const invitation = await getInvitationByToken(client, token);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found or expired'
        });
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Invitation has already been ${invitation.status}`,
          invitation_status: invitation.status
        });
      }

      if (new Date() > new Date(invitation.expires_at)) {
        // Mark as expired
        await client.query(
          'UPDATE league_invitations SET status = $1, updated_at = NOW() WHERE invitation_id = $2',
          ['expired', invitation.invitation_id]
        );
        
        return res.status(400).json({
          success: false,
          message: 'Invitation has expired',
          invitation_status: 'expired'
        });
      }

      // Check if league is full
      if (invitation.current_members >= invitation.max_members) {
        return res.status(400).json({
          success: false,
          message: 'League is now full',
          invitation_status: 'league_full'
        });
      }

      // Return invitation details (without sensitive info)
      return res.status(200).json({
        success: true,
        invitation: {
          invitation_id: invitation.invitation_id,
          league_id: invitation.league_id,
          league_name: invitation.league_name,
          league_description: invitation.league_description,
          league_type: invitation.league_type,
          league_rules: invitation.league_rules,
          privacy_level: invitation.privacy_level,
          inviter_name: invitation.inviter_name || invitation.inviter_username || 'Unknown Player',
          personal_message: invitation.message,
          invitation_method: invitation.invitation_method,
          expires_at: invitation.expires_at,
          needs_registration: !invitation.invited_user_id,
          current_members: invitation.current_members,
          max_members: invitation.max_members,
          spaces_remaining: invitation.max_members - invitation.current_members,
          league_schedule: {
            start_date: invitation.start_date,
            end_date: invitation.end_date,
            has_started: invitation.start_date ? new Date() >= new Date(invitation.start_date) : false
          }
        }
      });
    }

    if (req.method === 'POST') {
      // Accept or decline invitation
      const { token, action, registration_data } = req.body;
      
      if (!token || !action) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token and action are required' 
        });
      }

      const invitation = await getInvitationByToken(client, token);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found'
        });
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Invitation has already been ${invitation.status}`
        });
      }

      if (new Date() > new Date(invitation.expires_at)) {
        await client.query(
          'UPDATE league_invitations SET status = $1, updated_at = NOW() WHERE invitation_id = $2',
          ['expired', invitation.invitation_id]
        );
        
        return res.status(400).json({
          success: false,
          message: 'Invitation has expired'
        });
      }

      if (action === 'decline') {
        // Decline invitation
        await client.query(
          'UPDATE league_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE invitation_id = $2',
          ['declined', invitation.invitation_id]
        );
        
        return res.status(200).json({
          success: true,
          message: 'Invitation declined',
          action: 'declined'
        });
      }

      if (action === 'accept') {
        let acceptingUserId = invitation.invited_user_id;
        
        // Check if league is full
        if (invitation.current_members >= invitation.max_members) {
          return res.status(400).json({
            success: false,
            message: 'League is now full'
          });
        }
        
        // If no invited_user_id, this is an external invitation - need to create account
        if (!acceptingUserId) {
          if (!registration_data) {
            return res.status(400).json({
              success: false,
              message: 'Registration data required for new users'
            });
          }

          try {
            acceptingUserId = await createUserFromInvitation(client, invitation, registration_data);
          } catch (registrationError) {
            return res.status(400).json({
              success: false,
              message: `Registration failed: ${registrationError.message}`
            });
          }
        } else {
          // Existing user - verify they're authenticated
          const user = await verifyToken(req);
          if (!user || parseInt(user.playerId) !== acceptingUserId) {
            return res.status(401).json({ 
              success: false, 
              message: 'Authentication required to accept invitation' 
            });
          }
        }

        // Check if user is already a member
        const existingMember = await client.query(
          'SELECT * FROM league_memberships WHERE league_id = $1 AND player_id = $2',
          [invitation.league_id, acceptingUserId]
        );

        if (existingMember.rows.length > 0) {
          if (existingMember.rows[0].is_active) {
            return res.status(400).json({
              success: false,
              message: 'User is already a member of this league'
            });
          } else {
            // Reactivate membership
            await client.query(
              'UPDATE league_memberships SET is_active = true, joined_at = NOW() WHERE league_id = $1 AND player_id = $2',
              [invitation.league_id, acceptingUserId]
            );
          }
        } else {
          // Create new membership
          await client.query(
            'INSERT INTO league_memberships (league_id, player_id, member_role, joined_at, is_active) VALUES ($1, $2, $3, NOW(), true)',
            [invitation.league_id, acceptingUserId, 'member']
          );
        }

        // Accept the invitation
        await client.query(
          'UPDATE league_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE invitation_id = $2',
          ['accepted', invitation.invitation_id]
        );
        
        // Create welcome notification for new users
        if (!invitation.invited_user_id) {
          await client.query(`
            INSERT INTO league_notifications (league_id, user_id, notification_type, title, message, data, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            invitation.league_id,
            acceptingUserId,
            'welcome',
            `Welcome to ${invitation.league_name}!`,
            'Your account has been created and you\'ve joined the league. Start submitting sessions to compete!',
            JSON.stringify({ 
              league_id: invitation.league_id, 
              from_invitation: true,
              inviter_id: invitation.inviting_user_id
            }),
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          ]);
        }

        // Notify league admins of new member
        const adminNotificationResult = await client.query(`
          INSERT INTO league_notifications (league_id, user_id, notification_type, title, message, data)
          SELECT $1, lm.player_id, $2, $3, $4, $5
          FROM league_memberships lm 
          WHERE lm.league_id = $1 AND lm.member_role IN ('owner', 'admin') AND lm.is_active = true
        `, [
          invitation.league_id,
          'member_joined',
          'New Member Joined',
          `${registration_data?.display_name || 'A new player'} has joined the league`,
          JSON.stringify({
            new_member_id: acceptingUserId,
            league_id: invitation.league_id,
            joined_via: 'invitation'
          })
        ]);

        return res.status(200).json({
          success: true,
          message: invitation.invited_user_id 
            ? 'League invitation accepted - welcome to the league!' 
            : 'Account created and league joined!',
          action: 'accepted',
          league: {
            league_id: invitation.league_id,
            league_name: invitation.league_name,
            league_type: invitation.league_type,
            current_members: invitation.current_members + 1
          },
          user_created: !invitation.invited_user_id,
          user_id: acceptingUserId,
          next_steps: [
            'Check the league schedule and current round',
            'Submit practice sessions to earn points',
            'View leaderboard to track your progress'
          ]
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "accept" or "decline"'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[league-invitations] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process league invitation',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}