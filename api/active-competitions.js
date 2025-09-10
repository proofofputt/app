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
        d.status,
        d.settings,
        d.rules,
        d.expires_at,
        d.created_at,
        CASE 
          WHEN d.duel_creator_id = $1 THEN invited_player.name
          ELSE creator.name
        END as opponent_name,
        CASE 
          WHEN d.duel_creator_id = $1 THEN 'creator'
          ELSE 'invited'
        END as player_role,
        CASE 
          WHEN d.duel_creator_id = $1 THEN d.duel_creator_session_id IS NULL
          ELSE d.duel_invited_player_session_id IS NULL
        END as needs_session
      FROM duels d
      LEFT JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      WHERE 
        (d.duel_creator_id = $1 OR d.duel_invited_player_id = $1)
        AND d.status IN ('active', 'pending')
      ORDER BY d.expires_at ASC
    `;

    // Get active duels and leagues (leagues disabled until tables exist)
    const duelsResult = await client.query(duelsQuery, [player_id]);
    const leaguesResult = { rows: [] };

    // Format duels for desktop UI
    const activeDuels = duelsResult.rows.map(duel => {
      const settings = typeof duel.settings === 'string' ? JSON.parse(duel.settings) : duel.settings;
      const rules = typeof duel.rules === 'string' ? JSON.parse(duel.rules) : duel.rules;
      const timeLimit = rules?.session_duration_limit_minutes ? rules.session_duration_limit_minutes * 60 : null; // Convert minutes to seconds
      
      const numberOfAttempts = rules?.number_of_attempts || settings?.number_of_attempts || null;
      
      return {
        type: 'duel',
        id: duel.duel_id,
        opponent: duel.opponent_name,
        timeLimit: timeLimit,
        numberOfAttempts: numberOfAttempts,
        scoring: settings?.scoring || 'total_makes',
        expiresAt: duel.expires_at,
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
      return {
        type: 'league',
        id: league.round_id,
        leagueName: league.league_name,
        roundNumber: league.round_number,
        timeLimit: null, // No settings available, use default
        numberOfAttempts: null, // No settings available, use default
        endTime: league.end_time,
        startTime: league.start_time,
        sessionData: {
          leagueRoundId: league.round_id,
          league: league.league_name,
          timeLimit: null,
          numberOfAttempts: null,
          autoUpload: true
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