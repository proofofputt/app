import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
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

export default async function handler(req, res) {
  // Set CORS headers for desktop app access
  setCORSHeaders(req, res);

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

    // Get active duels where player needs to submit OR waiting for opponent
    const duelsQuery = `
      SELECT
        d.duel_id,
        d.status,
        d.settings,
        d.rules,
        d.competition_mode,
        d.expires_at,
        d.created_at,
        d.duel_creator_session_id,
        d.duel_invited_player_session_id,
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
        END as needs_session,
        CASE
          WHEN d.duel_creator_id = $1 THEN d.duel_invited_player_session_id IS NULL
          ELSE d.duel_creator_session_id IS NULL
        END as waiting_for_opponent,
        -- Get session data for scores
        creator_session.data as creator_session_data,
        invited_session.data as invited_session_data
      FROM duels d
      LEFT JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      LEFT JOIN sessions creator_session ON d.duel_creator_session_id = creator_session.session_id
      LEFT JOIN sessions invited_session ON d.duel_invited_player_session_id = invited_session.session_id
      WHERE
        (d.duel_creator_id = $1 OR d.duel_invited_player_id = $1)
        AND d.status IN ('pending', 'accepted', 'in_progress', 'active')  -- Only truly active statuses
        AND (d.expires_at IS NULL OR d.expires_at > NOW())      -- Not expired
        AND (
          -- Player hasn't submitted session yet OR player submitted but opponent hasn't
          CASE
            WHEN d.duel_creator_id = $1 THEN
              d.duel_creator_session_id IS NULL OR d.duel_invited_player_session_id IS NULL
            ELSE
              d.duel_invited_player_session_id IS NULL OR d.duel_creator_session_id IS NULL
          END
        )
        AND NOT (d.duel_creator_session_id IS NOT NULL AND d.duel_invited_player_session_id IS NOT NULL) -- Exclude completed duels
      ORDER BY d.expires_at ASC NULLS LAST
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
        l.status as league_status,
        l.rules,
        lm.player_id as member_player_id,
        lm.is_active as membership_active,
        -- Check if player has already submitted for this round
        lrs.session_id as submitted_session_id
      FROM league_rounds lr
      JOIN leagues l ON lr.league_id = l.league_id
      JOIN league_memberships lm ON l.league_id = lm.league_id
      LEFT JOIN league_round_sessions lrs ON lr.round_id = lrs.round_id AND lrs.player_id = $1
      WHERE 
        lm.player_id = $1 
        AND lm.is_active = true                         -- Player is active member
        AND l.status IN ('active', 'in_progress')       -- League is active
        AND lr.start_time <= NOW()                      -- Round has started
        AND lr.end_time > NOW()                         -- Round hasn't ended
        AND lrs.session_id IS NULL                      -- Player hasn't submitted yet
      ORDER BY lr.end_time ASC
    `;

    // Get active duels and leagues with proper filtering
    console.log('🔍 Querying ACTIVE duels for player_id:', player_id);
    const duelsResult = await client.query(duelsQuery, [player_id]);
    console.log(`✅ Found ${duelsResult.rows.length} active duels:`, duelsResult.rows.map(d => ({ id: d.duel_id, status: d.status, opponent: d.opponent_name, expires: d.expires_at })));
    
    console.log('🔍 Querying ACTIVE league rounds for player_id:', player_id);
    const leaguesResult = await client.query(leaguesQuery, [player_id]);
    console.log(`✅ Found ${leaguesResult.rows.length} active league rounds:`, leaguesResult.rows.map(l => ({ id: l.round_id, league: l.league_name, round: l.round_number, status: l.league_status })));

    // Format duels for desktop UI
    const activeDuels = duelsResult.rows.map(duel => {
      const settings = typeof duel.settings === 'string' ? JSON.parse(duel.settings) : duel.settings;
      const rules = typeof duel.rules === 'string' ? JSON.parse(duel.rules) : duel.rules;
      const competitionMode = duel.competition_mode || 'time_limit';

      let timeLimit = null;
      let numberOfAttempts = null;

      if (competitionMode === 'shoot_out') {
        // For shoot-out mode, get the max attempts
        numberOfAttempts = rules?.max_attempts || settings?.max_attempts || 21;
      } else {
        // For time limit mode
        timeLimit = rules?.session_duration_limit_minutes ? rules.session_duration_limit_minutes * 60 : null; // Convert minutes to seconds
      }

      const scoring = settings?.scoring || 'total_makes';

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

      // Extract scores based on scoring method
      const getScore = (sessionData, scoringMethod) => {
        if (!sessionData) return null;

        switch (scoringMethod) {
          case 'total_makes':
            return sessionData.total_makes || 0;
          case 'make_percentage':
            return sessionData.make_percentage || 0;
          case 'best_streak':
            return sessionData.best_streak || 0;
          case 'fastest_21':
            return sessionData.fastest_21_makes || null;
          default:
            return sessionData.total_makes || 0;
        }
      };

      // Determine player and opponent scores
      const isCreator = duel.player_role === 'creator';
      const playerScore = isCreator
        ? getScore(duel.creator_session_data, scoring)
        : getScore(duel.invited_session_data, scoring);
      const opponentScore = isCreator
        ? getScore(duel.invited_session_data, scoring)
        : getScore(duel.creator_session_data, scoring);

      return {
        type: 'duel',
        id: duel.duel_id,
        opponent: duel.opponent_name,
        timeLimit: timeLimit,
        numberOfAttempts: numberOfAttempts,
        scoring: scoring,
        expiresAt: expiresAt,
        createdAt: duel.created_at,
        playerRole: duel.player_role,
        needsSession: duel.needs_session,
        waitingForOpponent: duel.waiting_for_opponent,
        playerScore: playerScore,
        opponentScore: opponentScore,
        sessionData: {
          duelId: duel.duel_id,
          timeLimit: timeLimit,
          numberOfAttempts: numberOfAttempts,
          scoring: scoring,
          autoUpload: true
        }
      };
    });

    // Format league rounds for desktop UI  
    const activeLeagueRounds = leaguesResult.rows.map(league => {
      const rules = typeof league.rules === 'string' ? JSON.parse(league.rules) : league.rules;
      const competitionMode = rules?.competition_mode || 'time_limit';

      let timeLimit = null;
      let numberOfAttempts = null;

      if (competitionMode === 'shoot_out') {
        // For shoot-out mode in leagues, get the max attempts
        numberOfAttempts = rules?.max_attempts || 21;
      } else {
        // For time limit mode
        timeLimit = rules?.time_limit_minutes ? rules.time_limit_minutes * 60 : null; // Convert minutes to seconds
      }
      
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
