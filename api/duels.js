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

    // Get duels where player is involved (as creator or invited player)
    const duelsResult = await client.query(`
      SELECT 
        d.duel_id,
        d.duel_creator_id,
        d.duel_invited_player_id,
        d.status,
        d.settings,
        d.rules,
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
        d.duel_invited_player_score
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      WHERE d.duel_creator_id = $1 OR d.duel_invited_player_id = $1
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
        creator_id: duel.duel_creator_id,
        invited_player_id: duel.duel_invited_player_id,
        creator_name: duel.creator_name,
        invited_player_name: duel.invited_player_name,
        status: duel.status,
        settings: duel.settings,
        rules: duel.rules,
        created_at: duel.created_at,
        expires_at: expiresAt,
        winner_id: duel.winner_id,
        time_limit_minutes: timeLimit, // Extract time limit for frontend
        creator_score: duel.duel_creator_score,
        invited_player_score: duel.duel_invited_player_score,
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
        is_invited_player: parseInt(player_id) === duel.duel_invited_player_id
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

  const { creator_id, invited_player_id, settings, rules } = req.body;

  if (!creator_id || !invited_player_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'creator_id and invited_player_id are required' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Use settings or rules for the duel configuration
    const duelRules = settings || rules || {};

    // Insert new duel
    const duelResult = await client.query(`
      INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, created_at)
      VALUES ($1, $2, 'pending', $3, NOW())
      RETURNING duel_id, duel_creator_id, duel_invited_player_id, status, rules, created_at
    `, [creator_id, invited_player_id, duelRules]);

    const duel = duelResult.rows[0];

    // Get creator and invited player names
    const playersResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id IN ($1, $2)
    `, [creator_id, invited_player_id]);

    const players = {};
    playersResult.rows.forEach(p => {
      players[p.player_id] = p.name;
    });

    return res.status(201).json({
      success: true,
      duel: {
        ...duel,
        creator_id: duel.duel_creator_id,
        invited_player_id: duel.duel_invited_player_id,
        creator_name: players[creator_id],
        invited_player_name: players[invited_player_id]
      }
    });

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