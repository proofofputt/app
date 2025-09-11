import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { sendDuelInviteEmail } from '../utils/emailService.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    // Get duels where player is involved (as challenger or challengee)
    const duelsResult = await client.query(`
      SELECT 
        d.duel_id,
        d.challenger_id,
        d.challengee_id,
        d.status,
        d.settings,
        d.rules,
        d.created_at,
        d.expires_at,
        d.winner_id,
        challenger.name as challenger_name,
        challengee.name as challengee_name,
        d.challenger_session_id,
        d.challengee_session_id,
        d.challenger_session_data,
        d.challengee_session_data,
        d.challenger_score,
        d.challengee_score
      FROM duels d
      JOIN players challenger ON d.challenger_id = challenger.player_id
      JOIN players challengee ON d.challengee_id = challengee.player_id
      WHERE d.challenger_id = $1 OR d.challengee_id = $1
      ORDER BY d.created_at DESC
    `, [player_id]);

    const duels = duelsResult.rows.map(duel => {
      // Parse settings and rules to extract time limit
      const settings = duel.settings || {};
      const rules = duel.rules || {};
      
      // Extract time limit from multiple possible fields, converting hours to minutes if needed
      let timeLimit = null;
      
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
      
      // Calculate expiration date from invitation_expiry_minutes if expires_at is null
      let expiresAt = duel.expires_at;
      if (!expiresAt && (settings.invitation_expiry_minutes || rules.invitation_expiry_minutes)) {
        const expiryMinutes = settings.invitation_expiry_minutes || rules.invitation_expiry_minutes;
        const createdAt = new Date(duel.created_at);
        expiresAt = new Date(createdAt.getTime() + (expiryMinutes * 60 * 1000)).toISOString();
      }
      
      
      return {
        duel_id: duel.duel_id,
        creator_id: duel.challenger_id,
        invited_player_id: duel.challengee_id,
        creator_name: duel.challenger_name,
        invited_player_name: duel.challengee_name,
        status: duel.status,
        settings: duel.settings,
        rules: duel.rules,
        created_at: duel.created_at,
        expires_at: expiresAt,
        winner_id: duel.winner_id,
        time_limit_minutes: timeLimit, // Extract time limit for frontend
        creator_score: duel.challenger_score,
        invited_player_score: duel.challengee_score,
        creator_submitted_session_id: duel.challenger_session_id,
        invited_player_submitted_session_id: duel.challengee_session_id,
        creator_session: duel.challenger_session_id ? {
          session_id: duel.challenger_session_id,
          ...duel.challenger_session_data
        } : null,
        invited_player_session: duel.challengee_session_id ? {
          session_id: duel.challengee_session_id,
          ...duel.challengee_session_data
        } : null,
        is_creator: parseInt(player_id) === duel.challenger_id,
        is_invited_player: parseInt(player_id) === duel.challengee_id
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
      // Create a new player invitation record
      const newPlayerInviteResult = await client.query(`
        INSERT INTO player_invitations (
          inviter_id, 
          contact_type, 
          contact_value, 
          invitation_type, 
          created_at, 
          expires_at,
          status
        ) VALUES ($1, $2, $3, 'duel', NOW(), NOW() + INTERVAL '${duelRules.invitation_expiry_minutes || 4320} minutes', 'pending')
        RETURNING invitation_id
      `, [creator_id, new_player_contact.type, new_player_contact.value]);
      
      newPlayerInviteId = newPlayerInviteResult.rows[0].invitation_id;

      // Calculate expires_at for new player duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      
      // Create duel with invitation reference
      duelResult = await client.query(`
        INSERT INTO duels (challenger_id, challengee_id, status, rules, created_at, expires_at)
        VALUES ($1, NULL, 'pending_new_player', $2, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, challenger_id, challengee_id, status, rules, created_at, expires_at
      `, [creator_id, duelRules]);
      
      // Link the invitation to the duel
      await client.query(`
        UPDATE player_invitations 
        SET duel_id = $1 
        WHERE invitation_id = $2
      `, [duelResult.rows[0].duel_id, newPlayerInviteId]);

    } else {
      // Calculate expires_at for regular duels
      const expiryMinutes = duelRules.invitation_expiry_minutes || 4320; // Default 3 days
      
      // Regular duel with existing player
      duelResult = await client.query(`
        INSERT INTO duels (challenger_id, challengee_id, status, rules, created_at, expires_at)
        VALUES ($1, $2, 'pending', $3, NOW(), NOW() + INTERVAL '${expiryMinutes} minutes')
        RETURNING duel_id, challenger_id, challengee_id, status, rules, created_at, expires_at
      `, [creator_id, invited_player_id, duelRules]);
    }

    const duel = duelResult.rows[0];

    // Get player names for response
    const playerIds = [creator_id];
    if (duel.challengee_id) {
      playerIds.push(duel.challengee_id);
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
        creator_id: duel.challenger_id,
        invited_player_id: duel.challengee_id,
        creator_name: players[creator_id],
        invited_player_name: duel.challengee_id ? players[duel.challengee_id] : null
      }
    };

    // Add new player invitation details if applicable
    if (invite_new_player && newPlayerInviteId) {
      responseData.duel.new_player_invitation = {
        invitation_id: newPlayerInviteId,
        contact_type: new_player_contact.type,
        contact_value: new_player_contact.value,
        status: 'pending'
      };
    }

    return res.status(201).json(responseData);

  } catch (error) {
    console.error('Create duel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create duel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}