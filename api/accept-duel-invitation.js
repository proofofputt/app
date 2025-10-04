import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import notificationService from './services/notification.js';
import { setCORSHeaders } from '../utils/cors.js';

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
      di.*,
      d.rules as duel_rules,
      d.status as duel_status,
      challenger.display_name as challenger_name,
      challenger.username as challenger_username
    FROM duel_invitations di
    JOIN duels d ON di.duel_id = d.duel_id
    LEFT JOIN users challenger ON di.inviting_user_id = challenger.id
    WHERE di.invitation_token = $1
  `, [token]);
  
  return result.rows[0] || null;
}

/**
 * Create new user account from invitation
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
  setCORSHeaders(req, res);

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
          'UPDATE duel_invitations SET status = $1, updated_at = NOW() WHERE invitation_id = $2',
          ['expired', invitation.invitation_id]
        );
        
        return res.status(400).json({
          success: false,
          message: 'Invitation has expired',
          invitation_status: 'expired'
        });
      }

      // Return invitation details (without sensitive info)
      return res.status(200).json({
        success: true,
        invitation: {
          invitation_id: invitation.invitation_id,
          duel_id: invitation.duel_id,
          challenger_name: invitation.challenger_name || invitation.challenger_username || 'Unknown Player',
          duel_config: invitation.duel_rules,
          personal_message: invitation.message,
          invitation_method: invitation.invitation_method,
          expires_at: invitation.expires_at,
          needs_registration: !invitation.invited_user_id
        }
      });
    }

    if (req.method === 'POST') {
      // Accept invitation
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
          'UPDATE duel_invitations SET status = $1, updated_at = NOW() WHERE invitation_id = $2',
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
          'UPDATE duel_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE invitation_id = $2',
          ['declined', invitation.invitation_id]
        );
        
        // Cancel the associated duel
        await client.query(
          'UPDATE duels SET status = $1, updated_at = NOW() WHERE duel_id = $2',
          ['cancelled', invitation.duel_id]
        );
        
        return res.status(200).json({
          success: true,
          message: 'Invitation declined',
          action: 'declined'
        });
      }

      if (action === 'accept') {
        let acceptingUserId = invitation.invited_user_id;
        
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

        // Accept the invitation
        await client.query(
          'UPDATE duel_invitations SET status = $1, responded_at = NOW(), updated_at = NOW() WHERE invitation_id = $2',
          ['accepted', invitation.invitation_id]
        );
        
        // Update the duel with the challenged player and activate it
        await client.query(`
          UPDATE duels 
          SET challenged_id = $1, status = $2, started_at = NOW(), updated_at = NOW()
          WHERE duel_id = $3
        `, [acceptingUserId, 'active', invitation.duel_id]);
        
        // Create welcome notification for new users
        if (!invitation.invited_user_id) {
          try {
            await notificationService.createSystemNotification({
              playerId: acceptingUserId,
              title: 'Welcome to Proof of Putt!',
              message: 'Your account has been created and your duel is ready. Start by completing a putting session!',
              linkPath: `/duels/${invitation.duel_id}`,
              data: {
                duel_id: invitation.duel_id,
                from_invitation: true,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              }
            });
            console.log(`[accept-duel-invitation] Welcome notification sent to user ${acceptingUserId}`);
          } catch (notifError) {
            console.error('[accept-duel-invitation] Failed to send welcome notification:', notifError);
            // Non-blocking: continue even if notification fails
          }
        }

        return res.status(200).json({
          success: true,
          message: invitation.invited_user_id 
            ? 'Invitation accepted - duel is now active!' 
            : 'Account created and duel accepted!',
          action: 'accepted',
          duel: {
            duel_id: invitation.duel_id,
            status: 'active',
            challenger_name: invitation.challenger_name || invitation.challenger_username
          },
          user_created: !invitation.invited_user_id,
          user_id: acceptingUserId,
          next_step: 'Complete a putting session to participate in the duel'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "accept" or "decline"'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[accept-duel-invitation] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process invitation',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}