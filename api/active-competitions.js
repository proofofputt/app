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
  // Set CORS headers for desktop app access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  return handleGetActiveCompetitions(req, res);
}

async function handleGetActiveCompetitions(req, res) {
  let client;
  try {
    client = await pool.connect();
    
    const { player_id } = req.query;
    if (!player_id) {
      return res.status(400).json({ success: false, message: 'player_id is required' });
    }

    // Get active duels where player needs to submit a session
    const duelsQuery = `
      SELECT 
        d.duel_id,
        d.settings,
        d.rules,
        d.expires_at,
        d.created_at,
        CASE 
          WHEN d.challenger_id = $1 THEN challengee.name
          ELSE challenger.name
        END as opponent_name,
        CASE 
          WHEN d.challenger_id = $1 THEN 'creator'
          ELSE 'invited'
        END as player_role,
        CASE 
          WHEN d.challenger_id = $1 THEN d.challenger_session_id IS NULL
          ELSE d.challengee_session_id IS NULL
        END as needs_session
      FROM duels d
      LEFT JOIN players challenger ON d.challenger_id = challenger.player_id
      LEFT JOIN players challengee ON d.challengee_id = challengee.player_id
      WHERE 
        (d.challenger_id = $1 OR d.challengee_id = $1)
      ORDER BY d.expires_at ASC
    `;

    // Get active league rounds where player needs to submit a session
    const leaguesQuery = `
      SELECT 
        lr.round_id,
        lr.round_number,
        lr.start_time,
        lr.end_time,
        l.league_id,
        l.name as league_name,
        l.rules,
        lm.player_id as member_player_id,
        -- Check if player has already submitted for this round
        lrs.session_id as submitted_session_id
      FROM league_rounds lr
      JOIN leagues l ON lr.league_id = l.league_id
      JOIN league_memberships lm ON l.league_id = lm.league_id
      LEFT JOIN league_round_sessions lrs ON lr.round_id = lrs.round_id AND lrs.player_id = $1
      WHERE 
        lm.player_id = $1 
        AND lm.is_active = true
        AND lr.start_time <= NOW()
        AND lr.end_time > NOW()
        AND lrs.session_id IS NULL  -- Player hasn't submitted yet
      ORDER BY lr.end_time ASC
    `;

    // Get active duels and leagues
    console.log('🔍 Querying duels for player_id:', player_id);
    const duelsResult = await client.query(duelsQuery, [player_id]);
    console.log('🔍 Raw duels result:', duelsResult.rows);
    
    console.log('🔍 Querying leagues for player_id:', player_id);
    const leaguesResult = await client.query(leaguesQuery, [player_id]);
    console.log('🔍 Raw leagues result:', leaguesResult.rows);

    // Format duels for desktop UI
    const activeDuels = duelsResult.rows.map(duel => {
      const settings = typeof duel.settings === 'string' ? JSON.parse(duel.settings) : duel.settings;
      const rules = typeof duel.rules === 'string' ? JSON.parse(duel.rules) : duel.rules;
      const timeLimit = rules?.session_duration_limit_minutes ? rules.session_duration_limit_minutes * 60 : null; // Convert minutes to seconds
      
      const numberOfAttempts = rules?.number_of_attempts || settings?.number_of_attempts || null;
      
      // Calculate expiration date from invitation_expiry_minutes if expires_at is null
      let expiresAt = duel.expires_at;
      
      if (!expiresAt) {
        // Try to get expiry from settings or rules
        const expiryMinutes = settings?.invitation_expiry_minutes || 
                             rules?.invitation_expiry_minutes ||
                             4320; // Default 3 days
        
        const createdAt = new Date(duel.created_at);
        expiresAt = new Date(createdAt.getTime() + (expiryMinutes * 60 * 1000)).toISOString();
      }
      
      return {
        type: 'duel',
        id: duel.duel_id,
        opponent: duel.opponent_name,
        timeLimit: timeLimit,
        numberOfAttempts: numberOfAttempts,
        scoring: settings?.scoring || 'total_makes',
        expiresAt: expiresAt,
        createdAt: duel.created_at,
        playerRole: duel.player_role,
        sessionData: {
          duelId: duel.duel_id,
          timeLimit: timeLimit,
          numberOfAttempts: numberOfAttempts,
          scoring: settings?.scoring || 'total_makes',
          autoUpload: true
        }
      };
    });

    // Format league rounds for desktop UI  
    const activeLeagueRounds = leaguesResult.rows.map(league => {
      const rules = typeof league.rules === 'string' ? JSON.parse(league.rules) : league.rules;
      const timeLimit = rules?.time_limit_minutes ? rules.time_limit_minutes * 60 : null; // Convert minutes to seconds
      const numberOfAttempts = rules?.num_rounds || rules?.number_of_attempts || null;
      
      return {
        type: 'league',
        id: league.round_id,
        leagueName: league.league_name,
        roundNumber: league.round_number,
        timeLimit: timeLimit,
        numberOfAttempts: numberOfAttempts,
        endTime: league.end_time,
        startTime: league.start_time,
        sessionData: {
          leagueRoundId: league.round_id,
          league: league.league_name,
          timeLimit: timeLimit,
          numberOfAttempts: numberOfAttempts,
          autoUpload: true,
          roundNumber: league.round_number
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        duels: activeDuels,
        leagues: activeLeagueRounds,
        totalActive: activeDuels.length + activeLeagueRounds.length
      }
    });

  } catch (error) {
    console.error('Active competitions API error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
}