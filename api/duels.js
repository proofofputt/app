import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { sendSingleInvitation } from '../utils/invitationService.js';
import { checkInvitationLimits, recordInvitationsSent } from '../utils/invitationLimiter.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    console.log('[verifyToken] Auth header:', authHeader ? 'present' : 'missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[verifyToken] Invalid or missing Bearer token');
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    console.log('[verifyToken] Token extracted, length:', token ? token.length : 0);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('[verifyToken] JWT verification failed:', err.message);
        return resolve(null);
      }
      console.log('[verifyToken] JWT verification successful for user:', decoded.player_id);
      resolve(decoded);
    });
  });
}

import { setCORSHeaders } from '../utils/cors.js';

export default async function handler(req, res) {
  // Set secure CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGetDuels(req, res);
  } else if (req.method === 'POST') {
    return handleCreateDuel(req, res);
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

}

async function handleGetDuels(req, res) {
  let client;
  try {
    client = await pool.connect();
    console.log('Duels API: Database connected successfully');

    const { player_id } = req.query;

    if (!player_id) {
      return res.status(400).json({ success: false, message: 'player_id is required' });
    }

    // Get duels where player is involved (as challenger or challengee) with session data
    const duelsResult = await client.query(`
      SELECT
        d.duel_id,
        d.duel_creator_id,
        d.duel_invited_player_id,
        d.status,
        d.settings,
        d.rules,
        d.competition_mode,
        d.created_at,
        d.expires_at,
        d.winner_id,
        creator.name as creator_name,
        invited_player.name as invited_player_name,
        d.duel_creator_session_id,
        d.duel_invited_player_session_id,
        d.duel_creator_session_data,
        d.duel_invited_player_session_data,
        d.duel_creator_score,
        d.duel_invited_player_score,
        cs.data as creator_session_data,
        ips.data as invited_player_session_data
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      LEFT JOIN sessions cs ON d.duel_creator_session_id = cs.session_id
      LEFT JOIN sessions ips ON d.duel_invited_player_session_id = ips.session_id
      WHERE d.duel_creator_id = $1 OR d.duel_invited_player_id = $1
      ORDER BY d.created_at DESC
    `, [player_id]);

    const duels = duelsResult.rows.map(duel => {
      // Parse settings and rules to extract time limit
      const settings = duel.settings || {};
      const rules = duel.rules || {};
      const competitionMode = duel.competition_mode || 'time_limit';

      // Extract time limit or max attempts based on competition mode
      let timeLimit = null;
      let maxAttempts = null;

      if (competitionMode === 'shoot_out') {
        // For shoot-out mode, get max attempts
        maxAttempts = rules.max_attempts || settings.max_attempts || 21;
      } else {
        // For time limit mode, extract time limit from multiple possible fields
        if (settings.session_duration_limit_minutes) {
          timeLimit = settings.session_duration_limit_minutes;
        } else if (rules.session_duration_limit_minutes) {
          timeLimit = rules.session_duration_limit_minutes;
        } else if (settings.time_limit_minutes) {
          timeLimit = settings.time_limit_minutes;
        } else if (rules.time_limit_minutes) {
          timeLimit = rules.time_limit_minutes;
        } else if (rules.time_limit_hours) {
          timeLimit = rules.time_limit_hours * 60; // Convert hours to minutes
        } else if (settings.time_limit) {
          timeLimit = settings.time_limit;
        } else if (rules.time_limit) {
          timeLimit = rules.time_limit;
        }
      }

      // Extract putting distance, default to 7.0 feet if not specified
      let puttingDistance = 7.0;
      if (settings.putting_distance_feet) {
        puttingDistance = parseFloat(settings.putting_distance_feet);
      } else if (rules.putting_distance_feet) {
        puttingDistance = parseFloat(rules.putting_distance_feet);
      }
      
      // Calculate expiration date from invitation_expiry_minutes if expires_at is null
      let expiresAt = duel.expires_at;
      if (!expiresAt && (settings.invitation_expiry_minutes || rules.invitation_expiry_minutes)) {
        const expiryMinutes = settings.invitation_expiry_minutes || rules.invitation_expiry_minutes;
        const createdAt = new Date(duel.created_at);
        expiresAt = new Date(createdAt.getTime() + (expiryMinutes * 60 * 1000)).toISOString();
      }
      
      
      // Check if this is a new player invite with contact info
      const originalContact = duel.rules?.original_invite_contact;
      let displayInvitedPlayerName = duel.invited_player_name;
      
      // If this is a new player invite, format the display name nicely
      if (originalContact) {
        if (originalContact.type === 'email') {
          displayInvitedPlayerName = originalContact.value; // Show email directly
        } else if (originalContact.type === 'phone') {
          displayInvitedPlayerName = originalContact.value; // Show phone directly
        }
      }

      // Calculate individual scores from session data if available (for all duel statuses)
      let calculatedCreatorScore = duel.duel_creator_score;
      let calculatedInvitedScore = duel.duel_invited_player_score;

      // Always calculate from session data when available, prioritizing stored scores but falling back to session data
      // This ensures scores are displayed for both active and completed duels
      if (duel.creator_session_data) {
        // Use stored score if available and not null/0, otherwise calculate from session data
        if (calculatedCreatorScore === null || calculatedCreatorScore === 0) {
          calculatedCreatorScore = duel.creator_session_data.total_makes || 0;
        }
      }
      if (duel.invited_player_session_data) {
        // Use stored score if available and not null/0, otherwise calculate from session data
        if (calculatedInvitedScore === null || calculatedInvitedScore === 0) {
          calculatedInvitedScore = duel.invited_player_session_data.total_makes || 0;
        }
      }
      
      return {
        duel_id: duel.duel_id,
        creator_id: duel.duel_creator_id,
        invited_player_id: duel.duel_invited_player_id,
        creator_name: duel.creator_name,
        invited_player_name: displayInvitedPlayerName,
        status: duel.status,
        settings: duel.settings,
        rules: duel.rules,
        created_at: duel.created_at,
        expires_at: expiresAt,
        winner_id: duel.winner_id,
        competition_mode: competitionMode, // Competition format
        time_limit_minutes: timeLimit, // Extract time limit for frontend (null for shoot-out)
        max_attempts: maxAttempts, // Max attempts for shoot-out mode
        putting_distance_feet: puttingDistance, // Extract putting distance for frontend
        creator_score: calculatedCreatorScore,
        invited_player_score: calculatedInvitedScore,
        creator_submitted_session_id: duel.duel_creator_session_id,
        invited_player_submitted_session_id: duel.duel_invited_player_session_id,
        creator_session: duel.duel_creator_session_id ? {
          session_id: duel.duel_creator_session_id,
          ...duel.duel_creator_session_data
        } : null,
        invited_player_session: duel.duel_invited_player_session_id ? {
          session_id: duel.duel_invited_player_session_id,
          ...duel.duel_invited_player_session_data
        } : null,
        is_creator: parseInt(player_id) === duel.duel_creator_id,
        is_invited_player: parseInt(player_id) === duel.duel_invited_player_id,
        // Add invite info for new player invites
        invite_type: originalContact ? 'new_player' : 'existing_player',
        contact_info: originalContact || null
      };
    });

    return res.status(200).json({
      success: true,
      duels: duels
    });

  } catch (error) {
    console.error('Duels API error:', error);
    
    // Always return expected structure for GET requests
    return res.status(200).json({
      success: false,
      message: 'Failed to load duels',
      duels: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}

async function handleCreateDuel(req, res) {
  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { creator_id, invited_player_id, settings, rules, invite_new_player, new_player_contact } = req.body;

  // Use settings or rules for the duel configuration
  const duelRules = settings || rules || {};

  // Determine competition mode (default to time_limit for backwards compatibility)
  const competitionMode = duelRules.competition_mode || 'time_limit';

  // Validate competition mode
  if (!['time_limit', 'shoot_out'].includes(competitionMode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid competition mode. Must be "time_limit" or "shoot_out"'
    });
  }

  // Validate shoot-out specific settings
  if (competitionMode === 'shoot_out') {
    // Valid shoot-out attempt options
    const validAttempts = [5, 10, 21, 50, 77, 100, 210, 420, 777, 1000, 2100];
    const maxAttempts = duelRules.max_attempts || 21; // Default to 21

    if (!validAttempts.includes(maxAttempts)) {
      return res.status(400).json({
        success: false,
        message: `Invalid max_attempts for shoot-out mode. Must be one of: ${validAttempts.join(', ')}`
      });
    }

    // Store max_attempts in rules
    duelRules.max_attempts = maxAttempts;
    // Clear time limit for shoot-out mode
    delete duelRules.session_duration_limit_minutes;
  }

  // Ensure putting distance is set, default to 7.0 feet
  if (!duelRules.putting_distance_feet) {
    duelRules.putting_distance_feet = 7.0;
  }

  // Validate putting distance range (3.0 - 10.0 feet)
  if (duelRules.putting_distance_feet < 3.0 || duelRules.putting_distance_feet > 10.0) {
    return res.status(400).json({
      success: false,
      message: 'Putting distance must be between 3.0 and 10.0 feet'
    });
  }
  
  if (!creator_id || (!invited_player_id && !invite_new_player)) {
    return res.status(400).json({ 
      success: false, 
      message: 'creator_id and either invited_player_id or new_player_contact are required' 
    });
  }

  // Validate new player contact information if provided
  if (invite_new_player && (!new_player_contact || !new_player_contact.type || !new_player_contact.value)) {
    return res.status(400).json({
      success: false,
      message: 'new_player_contact with type and value are required for new player invites'
    });
  }

  let client;
  try {
    client = await pool.connect();

    let duelResult;
    let newPlayerInviteId = null;

    if (invite_new_player && new_player_contact) {
      // Create a temporary player for the invited contact
      // Create temporary player with contact info as display name
      const displayName = new_player_contact.value; // Use the actual email or phone as the display name
      const tempPlayerResult = await client.query(`
        INSERT INTO players (name, email, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING player_id
      `, [
        displayName,
        new_player_contact.type === 'email' ? new_player_contact.value : `temp_${Date.now()}@phone.local`,
        'temp_password_hash_for_invited_player' // Temporary hash for invited players who haven't registered yet
      ]);
      
      const tempPlayerId = tempPlayerResult.rows[0].player_id;

      // Calculate expires_at for new player duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      
      // Store original contact info in the duel rules for future reference
      const enhancedRules = {
        ...duelRules,
        original_invite_contact: {
          type: new_player_contact.type,
          value: new_player_contact.value
        }
      };
      
      // Create duel with temporary player reference
      duelResult = await client.query(`
        INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, competition_mode, created_at, expires_at)
        VALUES ($1, $2, 'pending_new_player', $3, $4, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, duel_creator_id, duel_invited_player_id, status, rules, competition_mode, created_at, expires_at
      `, [creator_id, tempPlayerId, enhancedRules, competitionMode]);

    } else {
      // Calculate expires_at for regular duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      
      // Regular duel with existing player
      duelResult = await client.query(`
        INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, competition_mode, created_at, expires_at)
        VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, duel_creator_id, duel_invited_player_id, status, rules, competition_mode, created_at, expires_at
      `, [creator_id, invited_player_id, duelRules, competitionMode]);
    }

    const duel = duelResult.rows[0];

    // Get player names for response
    const playerIds = [creator_id];
    if (duel.duel_invited_player_id) {
      playerIds.push(duel.duel_invited_player_id);
    }
    
    const playersResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id = ANY($1)
    `, [playerIds]);

    const players = {};
    playersResult.rows.forEach(p => {
      players[p.player_id] = p.name;
    });

    const responseData = {
      success: true,
      duel: {
        ...duel,
        creator_id: duel.duel_creator_id,
        invited_player_id: duel.duel_invited_player_id,
        creator_name: players[creator_id],
        invited_player_name: duel.duel_invited_player_id ? players[duel.duel_invited_player_id] : null
      }
    };

    // Send invitation and update rate limits if applicable
    if (invite_new_player && new_player_contact) {
      // Check rate limits before sending
      const limitCheck = await checkInvitationLimits(client, creator_id, new_player_contact.type, 1);
      
      if (limitCheck.allowed) {
        // Get creator details for invitation
        const creatorResult = await client.query(`
          SELECT player_id, name, email 
          FROM players 
          WHERE player_id = $1
        `, [creator_id]);
        
        const creator = creatorResult.rows[0];
        
        // Send the invitation
        const invitationResult = await sendSingleInvitation(
          new_player_contact,
          creator.name, // inviter name
          {
            timeLimit: duelRules.session_duration_limit_minutes,
            scoring: duelRules.scoring || 'total_makes',
            puttingDistance: duelRules.putting_distance_feet || 7.0,
            expiresAt: duel.expires_at,
            creatorInfo: {
              id: creator.player_id,
              name: creator.name,
              email: creator.email,
              contactType: new_player_contact.type // email or phone
            }
          },
          'duel'
        );
        
        if (invitationResult.success) {
          // Record successful invitation
          await recordInvitationsSent(client, creator_id, 1);
          console.log(`✅ Sent ${new_player_contact.type} invitation to ${new_player_contact.value}`);
        } else {
          console.warn(`⚠️  Failed to send invitation: ${invitationResult.error}`);
        }
        
        // Add invitation result to response
        responseData.duel.invitation_sent = invitationResult.success;
        responseData.duel.invitation_error = invitationResult.success ? null : invitationResult.error;
      } else {
        console.warn(`⚠️  Rate limit exceeded for ${new_player_contact.type} invitation: ${limitCheck.error}`);
        responseData.duel.invitation_sent = false;
        responseData.duel.invitation_error = limitCheck.error;
      }
      
      // Add contact details to response
      responseData.duel.new_player_contact = {
        contact_type: new_player_contact.type,
        contact_value: new_player_contact.value,
        status: 'pending_new_player'
      };
    }

    return res.status(201).json(responseData);

  } catch (error) {
    console.error('Create duel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create duel',
      error: error.message, // Always show error for debugging
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) client.release();
  }
}