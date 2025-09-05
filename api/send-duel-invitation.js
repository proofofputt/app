import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import emailService from './services/email.js';

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
 * Generate secure invitation token for external invitations
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Send email invitation using SendGrid
 */
async function sendEmailInvitation(invitation, challengerName) {
  const { external_contact, invitation_token, message, duel_config, duel_id } = invitation;
  
  // Calculate expiration time
  const expiresAt = new Date(Date.now() + (duel_config.time_limit_hours || 48) * 60 * 60 * 1000);
  
  try {
    const emailResult = await emailService.sendDuelInvitation({
      toEmail: external_contact,
      toUsername: 'Golfer', // We don't have their username yet since they're external
      fromUsername: challengerName,
      duelId: duel_id,
      expiresAt: expiresAt
    });

    console.log(`[EMAIL] SendGrid result for ${external_contact}:`, emailResult);
    return emailResult;
    
  } catch (error) {
    console.error(`[EMAIL] SendGrid failed for ${external_contact}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send SMS invitation (placeholder - integrate with your SMS service)
 */
async function sendSMSInvitation(invitation, challengerName) {
  const { external_contact, invitation_token, duel_config } = invitation;
  
  // SMS template (must be under 160 characters for single SMS)
  const smsText = `🏌️ ${challengerName} challenged you to a putting duel on Proof of Putt! ` +
    `${duel_config.duel_type || 'Standard'} duel, ${duel_config.time_limit_hours || 48}hr limit. ` +
    `Accept: https://app.proofofputt.com/i/${invitation_token} ` +
    `Stop: https://app.proofofputt.com/stop/${invitation_token}`;

  // TODO: Replace with your actual SMS service (Twilio, AWS SNS, etc.)
  console.log(`[SMS] Sending invitation to ${external_contact}`);
  console.log(`[SMS] Message: ${smsText}`);
  console.log(`[SMS] Length: ${smsText.length} characters`);
  
  // For testing, we'll simulate successful send
  return { success: true, messageId: `sms-${Date.now()}` };
}

/**
 * Create in-app notification for existing users
 */
async function createInAppNotification(client, userId, invitation, challengerName) {
  const { duel_config, message } = invitation;
  
  await client.query(`
    INSERT INTO user_notifications (user_id, notification_type, title, message, data, action_url, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    userId,
    'duel_invitation',
    `Duel challenge from ${challengerName}`,
    message || `${challengerName} challenged you to a ${duel_config.duel_type || 'standard'} duel!`,
    JSON.stringify({
      invitation_id: invitation.invitation_id,
      challenger_name: challengerName,
      duel_config: duel_config
    }),
    `/duels/invitation/${invitation.invitation_id}`,
    new Date(Date.now() + (duel_config.time_limit_hours || 48) * 60 * 60 * 1000)
  ]);
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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authentication required
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const client = await pool.connect();
  
  try {
    const { 
      invitation_method, // 'username', 'email', 'phone'
      recipient_identifier, // username, email, or phone number
      duel_config = {},
      personal_message = ''
    } = req.body;

    const invitingUserId = parseInt(user.playerId);

    // Validate input
    if (!invitation_method || !recipient_identifier) {
      return res.status(400).json({ 
        success: false, 
        message: 'invitation_method and recipient_identifier are required' 
      });
    }

    if (!['username', 'email', 'phone'].includes(invitation_method)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid invitation_method. Must be username, email, or phone' 
      });
    }

    // Get challenger's name
    const challengerResult = await client.query(
      'SELECT display_name, username FROM users WHERE id = $1', 
      [invitingUserId]
    );
    const challengerName = challengerResult.rows[0]?.display_name || 
                          challengerResult.rows[0]?.username || 
                          `Player ${invitingUserId}`;

    // Set default duel configuration
    const finalDuelConfig = {
      duel_type: 'standard',
      time_limit_hours: 48,
      target_putts: 50,
      scoring_method: 'total_makes',
      handicap_enabled: false,
      ...duel_config
    };

    // First, create the duel record
    const duelResult = await client.query(`
      INSERT INTO duels (challenger_id, challenged_id, status, rules, created_at, updated_at)
      VALUES ($1, NULL, $2, $3, NOW(), NOW())
      RETURNING duel_id
    `, [invitingUserId, 'pending', JSON.stringify(finalDuelConfig)]);

    const duelId = duelResult.rows[0].duel_id;

    // Check if recipient is an existing user
    let existingUser = null;
    if (invitation_method === 'username') {
      const userResult = await client.query('SELECT * FROM users WHERE username = $1', [recipient_identifier]);
      existingUser = userResult.rows[0] || null;
    } else if (invitation_method === 'email') {
      const userResult = await client.query('SELECT * FROM users WHERE email = $1', [recipient_identifier.toLowerCase()]);
      existingUser = userResult.rows[0] || null;
    } else if (invitation_method === 'phone') {
      const normalizedPhone = recipient_identifier.replace(/[\s\-\(\)]/g, '');
      const userResult = await client.query('SELECT * FROM users WHERE phone_number = $1', [normalizedPhone]);
      existingUser = userResult.rows[0] || null;
    }

    // Generate invitation token for external invitations
    const invitationToken = generateInvitationToken();
    const expiresAt = new Date(Date.now() + finalDuelConfig.time_limit_hours * 60 * 60 * 1000);

    // Create invitation record
    const invitationResult = await client.query(`
      INSERT INTO duel_invitations (
        duel_id, inviting_user_id, invited_user_id, invitation_method, 
        external_contact, invitation_token, message, expires_at, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING invitation_id
    `, [
      duelId,
      invitingUserId,
      existingUser ? existingUser.id : null,
      invitation_method,
      existingUser ? null : recipient_identifier,
      invitationToken,
      personal_message,
      expiresAt,
      'pending'
    ]);

    const invitationId = invitationResult.rows[0].invitation_id;

    const invitation = {
      invitation_id: invitationId,
      duel_id: duelId,
      invitation_token: invitationToken,
      external_contact: recipient_identifier,
      message: personal_message,
      duel_config: finalDuelConfig
    };

    let deliveryResults = {};

    // Send notifications based on method and user status
    if (existingUser) {
      // User exists - send in-app notification
      await createInAppNotification(client, existingUser.id, invitation, challengerName);
      deliveryResults.in_app = { success: true };

      // Update duel with challenged_id
      await client.query('UPDATE duels SET challenged_id = $1 WHERE duel_id = $2', [existingUser.id, duelId]);
    }

    // Always send external invitation for email/phone (even if user exists)
    if (invitation_method === 'email') {
      try {
        const emailResult = await sendEmailInvitation(invitation, challengerName);
        deliveryResults.email = emailResult;
      } catch (error) {
        console.error('[send-duel-invitation] Email send failed:', error);
        deliveryResults.email = { success: false, error: error.message };
      }
    } else if (invitation_method === 'phone') {
      try {
        const smsResult = await sendSMSInvitation(invitation, challengerName);
        deliveryResults.sms = smsResult;
      } catch (error) {
        console.error('[send-duel-invitation] SMS send failed:', error);
        deliveryResults.sms = { success: false, error: error.message };
      }
    }

    // Determine overall success
    const hasSuccessfulDelivery = Object.values(deliveryResults).some(result => result.success);

    if (!hasSuccessfulDelivery) {
      // Cancel the duel if no delivery methods succeeded
      await client.query('UPDATE duels SET status = $1 WHERE duel_id = $2', ['cancelled', duelId]);
      await client.query('UPDATE duel_invitations SET status = $1 WHERE invitation_id = $2', ['cancelled', invitationId]);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to deliver invitation',
        delivery_results: deliveryResults
      });
    }

    return res.status(201).json({
      success: true,
      message: existingUser 
        ? 'Duel invitation sent to existing user'
        : 'Duel invitation sent to new user',
      invitation: {
        invitation_id: invitationId,
        duel_id: duelId,
        recipient_is_user: !!existingUser,
        invitation_method: invitation_method,
        expires_at: expiresAt,
        invitation_url: existingUser 
          ? `/duels/invitation/${invitationId}`
          : `https://app.proofofputt.com/duel-invitation/${invitationToken}`
      },
      delivery_results: deliveryResults
    });

  } catch (error) {
    console.error('[send-duel-invitation] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send invitation',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}