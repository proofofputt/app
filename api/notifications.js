import emailService from './services/email.js';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  const method = req.method;
  const { action } = req.query;

  try {
    switch (`${method}:${action}`) {
      case 'POST:send-duel-invitation':
        return await sendDuelInvitationNotification(req, res);
      
      case 'POST:send-friend-request':
        return await sendFriendRequestNotification(req, res);
      
      case 'POST:send-league-invitation':
        return await sendLeagueInvitationNotification(req, res);
      
      case 'POST:send-session-reminder':
        return await sendSessionReminderNotification(req, res);
      
      case 'GET:test':
        return await testEmailService(req, res);
      
      default:
        return res.status(404).json({ error: 'Notification action not found' });
    }
  } catch (error) {
    console.error('Notification API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function sendDuelInvitationNotification(req, res) {
  const { duelId, inviteeEmail, inviterPlayerId } = req.body;

  if (!duelId || !inviteeEmail || !inviterPlayerId) {
    return res.status(400).json({ error: 'Missing required fields: duelId, inviteeEmail, inviterPlayerId' });
  }

  const client = await pool.connect();
  try {
    // Get duel and inviter details
    const duelQuery = `
      SELECT d.*, p.username as inviter_username, p.email as inviter_email,
             COALESCE(target_p.username, d.invitee_email) as invitee_username
      FROM duels d
      LEFT JOIN players p ON p.id = $2
      LEFT JOIN players target_p ON target_p.email = d.invitee_email
      WHERE d.id = $1
    `;
    
    const duelResult = await client.query(duelQuery, [duelId, inviterPlayerId]);
    if (duelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Duel not found' });
    }

    const duel = duelResult.rows[0];

    // Send notification email
    const emailResult = await emailService.sendDuelInvitation({
      toEmail: inviteeEmail,
      toUsername: duel.invitee_username || 'Golfer',
      fromUsername: duel.inviter_username || 'A fellow golfer',
      duelId: duelId,
      expiresAt: duel.expires_at
    });

    // Log notification attempt
    await client.query(`
      INSERT INTO notification_log (type, recipient_email, sender_id, related_id, success, error_message)
      VALUES ('duel_invitation', $1, $2, $3, $4, $5)
    `, [inviteeEmail, inviterPlayerId, duelId, emailResult.success, emailResult.error || null]);

    return res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Duel invitation sent successfully' : 'Failed to send invitation',
      error: emailResult.error
    });

  } finally {
    client.release();
  }
}

async function sendFriendRequestNotification(req, res) {
  const { requestId, recipientEmail, senderPlayerId } = req.body;

  if (!requestId || !recipientEmail || !senderPlayerId) {
    return res.status(400).json({ error: 'Missing required fields: requestId, recipientEmail, senderPlayerId' });
  }

  const client = await pool.connect();
  try {
    // Get sender details and recipient username if they exist
    const friendQuery = `
      SELECT p.username as sender_username,
             COALESCE(target_p.username, $2) as recipient_username
      FROM players p
      LEFT JOIN players target_p ON target_p.email = $2
      WHERE p.id = $1
    `;
    
    const friendResult = await client.query(friendQuery, [senderPlayerId, recipientEmail]);
    if (friendResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const friend = friendResult.rows[0];

    // Send notification email
    const emailResult = await emailService.sendFriendRequest({
      toEmail: recipientEmail,
      toUsername: friend.recipient_username || 'Golfer',
      fromUsername: friend.sender_username || 'A fellow golfer',
      requestId: requestId
    });

    // Log notification attempt
    await client.query(`
      INSERT INTO notification_log (type, recipient_email, sender_id, related_id, success, error_message)
      VALUES ('friend_request', $1, $2, $3, $4, $5)
    `, [recipientEmail, senderPlayerId, requestId, emailResult.success, emailResult.error || null]);

    return res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Friend request notification sent successfully' : 'Failed to send notification',
      error: emailResult.error
    });

  } finally {
    client.release();
  }
}

async function sendLeagueInvitationNotification(req, res) {
  const { leagueId, inviteeEmail, inviterPlayerId } = req.body;

  if (!leagueId || !inviteeEmail || !inviterPlayerId) {
    return res.status(400).json({ error: 'Missing required fields: leagueId, inviteeEmail, inviterPlayerId' });
  }

  const client = await pool.connect();
  try {
    // Get league and inviter details
    const leagueQuery = `
      SELECT l.name as league_name, l.next_round_start_date,
             p.username as inviter_username,
             COALESCE(target_p.username, $2) as invitee_username
      FROM leagues l
      CROSS JOIN players p
      LEFT JOIN players target_p ON target_p.email = $2
      WHERE l.id = $1 AND p.id = $3
    `;
    
    const leagueResult = await client.query(leagueQuery, [leagueId, inviteeEmail, inviterPlayerId]);
    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ error: 'League or inviter not found' });
    }

    const league = leagueResult.rows[0];

    // Send notification email
    const emailResult = await emailService.sendLeagueInvitation({
      toEmail: inviteeEmail,
      toUsername: league.invitee_username || 'Golfer',
      fromUsername: league.inviter_username || 'A fellow golfer',
      leagueName: league.league_name,
      leagueId: leagueId,
      roundStartDate: league.next_round_start_date
    });

    // Log notification attempt
    await client.query(`
      INSERT INTO notification_log (type, recipient_email, sender_id, related_id, success, error_message)
      VALUES ('league_invitation', $1, $2, $3, $4, $5)
    `, [inviteeEmail, inviterPlayerId, leagueId, emailResult.success, emailResult.error || null]);

    return res.json({
      success: emailResult.success,
      message: emailResult.success ? 'League invitation sent successfully' : 'Failed to send invitation',
      error: emailResult.error
    });

  } finally {
    client.release();
  }
}

async function sendSessionReminderNotification(req, res) {
  const { playerId, activityType, activityId, dueDate } = req.body;

  if (!playerId || !activityType || !activityId || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields: playerId, activityType, activityId, dueDate' });
  }

  const client = await pool.connect();
  try {
    // Get player details
    const playerQuery = 'SELECT username, email FROM players WHERE id = $1';
    const playerResult = await client.query(playerQuery, [playerId]);
    
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Send notification email
    const emailResult = await emailService.sendSessionReminder({
      toEmail: player.email,
      toUsername: player.username || 'Golfer',
      activityType: activityType,
      dueDate: dueDate,
      activityId: activityId
    });

    // Log notification attempt
    await client.query(`
      INSERT INTO notification_log (type, recipient_email, sender_id, related_id, success, error_message)
      VALUES ('session_reminder', $1, $2, $3, $4, $5)
    `, [player.email, playerId, activityId, emailResult.success, emailResult.error || null]);

    return res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Session reminder sent successfully' : 'Failed to send reminder',
      error: emailResult.error
    });

  } finally {
    client.release();
  }
}

async function testEmailService(req, res) {
  const { testEmail = 'test@example.com' } = req.query;

  try {
    const emailResult = await emailService.sendEmail({
      to: testEmail,
      subject: 'Proof of Putt - Email Service Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B4332;">🏌️ Email Service Test</h2>
          <p>This is a test email from the Proof of Putt notification system.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p style="color: #40916C;">✅ If you received this, SendGrid is configured correctly!</p>
        </div>
      `,
      text: `
        🏌️ Email Service Test
        
        This is a test email from the Proof of Putt notification system.
        
        Timestamp: ${new Date().toISOString()}
        
        ✅ If you received this, SendGrid is configured correctly!
      `
    });

    return res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Test email sent successfully' : 'Failed to send test email',
      error: emailResult.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
}