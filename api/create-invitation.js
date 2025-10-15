import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { 
    identifier, 
    identifier_type, 
    invitation_type, 
    invitation_data = {}, 
    message = null 
  } = req.body;

  if (!identifier || !identifier_type || !invitation_type) {
    return res.status(400).json({ 
      error: 'identifier, identifier_type, and invitation_type are required' 
    });
  }

  // Validate identifier_type
  const validIdentifierTypes = ['email', 'phone', 'telegram', 'username', 'other'];
  if (!validIdentifierTypes.includes(identifier_type)) {
    return res.status(400).json({ 
      error: `Invalid identifier_type. Must be one of: ${validIdentifierTypes.join(', ')}` 
    });
  }

  // Validate invitation_type
  const validInvitationTypes = ['duel', 'league', 'friend'];
  if (!validInvitationTypes.includes(invitation_type)) {
    return res.status(400).json({ 
      error: `Invalid invitation_type. Must be one of: ${validInvitationTypes.join(', ')}` 
    });
  }

  const client = await pool.connect();
  
  try {
    // Check if a registered player already exists with this identifier
    let existingPlayerQuery = '';
    if (identifier_type === 'email') {
      existingPlayerQuery = 'SELECT player_id, name, is_hidden FROM players WHERE LOWER(email) = LOWER($1)';
    } else if (identifier_type === 'username') {
      existingPlayerQuery = 'SELECT player_id, name, is_hidden FROM players WHERE LOWER(name) = LOWER($1)';
    } else {
      existingPlayerQuery = 'SELECT player_id, name, is_hidden FROM players WHERE invitation_identifier = $1 AND identifier_type = $2';
    }
    
    let existingPlayerResult;
    if (identifier_type === 'email' || identifier_type === 'username') {
      existingPlayerResult = await client.query(existingPlayerQuery, [identifier]);
    } else {
      existingPlayerResult = await client.query(existingPlayerQuery, [identifier, identifier_type]);
    }

    let targetPlayerId;
    let isHiddenProfile = false;

    if (existingPlayerResult.rows.length > 0) {
      // Player exists - use existing player
      const existingPlayer = existingPlayerResult.rows[0];
      targetPlayerId = existingPlayer.player_id;
      isHiddenProfile = existingPlayer.is_hidden;
      
      console.log(`Found existing player: ${existingPlayer.name} (ID: ${targetPlayerId}, hidden: ${isHiddenProfile})`);
    } else {
      // Create hidden player profile
      console.log(`Creating hidden profile for ${identifier} (${identifier_type})`);
      
      // Get next player ID starting from 1000
      const maxIdQuery = await client.query('SELECT COALESCE(MAX(player_id), 999) as max_id FROM players');
      const nextPlayerId = Math.max(maxIdQuery.rows[0].max_id + 1, 1000);
      
      const hiddenPlayerResult = await client.query(`
        INSERT INTO players (
          player_id,
          name,
          email,
          password_hash,
          is_hidden,
          invitation_identifier,
          identifier_type,
          invited_by,
          invited_at,
          membership_tier,
          subscription_status,
          timezone,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, true, $5, $6, $7, NOW(), 'basic', 'inactive', 'America/New_York', NOW(), NOW())
        RETURNING player_id, name
      `, [
        nextPlayerId,
        `Invited User ${nextPlayerId}`, // Temporary name
        identifier_type === 'email' ? identifier : `${identifier}@temp.proofofputt.com`, // Temp email if not email invite
        'HIDDEN_PROFILE_NO_PASSWORD', // Placeholder password hash
        identifier,
        identifier_type,
        user.playerId
      ]);

      targetPlayerId = hiddenPlayerResult.rows[0].player_id;
      isHiddenProfile = true;

      // Initialize player stats for the hidden profile
      await client.query(`
        INSERT INTO player_stats (
          player_id,
          total_sessions,
          total_putts,
          total_makes,
          total_misses,
          make_percentage,
          best_streak,
          created_at,
          updated_at
        )
        VALUES ($1, 0, 0, 0, 0, 0.0, 0, NOW(), NOW())
        ON CONFLICT (player_id) DO NOTHING
      `, [targetPlayerId]);

      console.log(`Created hidden profile with ID: ${targetPlayerId}`);
    }

    // Check for existing invitation to prevent duplicates
    const existingInvitationResult = await client.query(`
      SELECT invitation_id, status 
      FROM invitations 
      WHERE inviter_id = $1 
        AND identifier = $2 
        AND identifier_type = $3 
        AND invitation_type = $4
        AND invitation_data = $5
        AND status IN ('pending', 'accepted')
    `, [user.playerId, identifier, identifier_type, invitation_type, JSON.stringify(invitation_data)]);

    if (existingInvitationResult.rows.length > 0) {
      const existingInvitation = existingInvitationResult.rows[0];
      return res.status(409).json({ 
        error: `Invitation already exists with status: ${existingInvitation.status}`,
        invitation_id: existingInvitation.invitation_id
      });
    }

    // Create the invitation record
    const invitationResult = await client.query(`
      INSERT INTO invitations (
        inviter_id,
        hidden_player_id,
        invitation_type,
        invitation_data,
        identifier,
        identifier_type,
        message,
        status,
        expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW() + INTERVAL '30 days', NOW(), NOW())
      RETURNING invitation_id, expires_at, created_at
    `, [
      user.playerId,
      targetPlayerId,
      invitation_type,
      JSON.stringify(invitation_data),
      identifier,
      identifier_type,
      message
    ]);

    const invitation = invitationResult.rows[0];

    // Get inviter details
    const inviterResult = await client.query(`
      SELECT name, email FROM players WHERE player_id = $1
    `, [user.playerId]);
    const inviter = inviterResult.rows[0];

    return res.status(201).json({
      success: true,
      invitation: {
        invitation_id: invitation.invitation_id,
        inviter_name: inviter.name,
        inviter_email: inviter.email,
        target_player_id: targetPlayerId,
        is_hidden_profile: isHiddenProfile,
        invitation_type,
        invitation_data,
        identifier,
        identifier_type,
        message,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Create invitation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create invitation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}