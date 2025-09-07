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
  console.log('[start-session] Handler called with method:', req.method);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('[start-session] Method not allowed:', req.method);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  console.log('[start-session] Verifying token...');
  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    console.log('[start-session] Authentication failed');
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  console.log('[start-session] User authenticated:', user);

  const { player_id, duel_id, league_round_id } = req.body;
  console.log('[start-session] Request body:', { player_id, duel_id, league_round_id });

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'player_id is required' });
  }

  try {
    const client = await pool.connect();

    try {
      let sessionType = 'practice';
      let timeLimit = null;
      let sessionMetadata = {};

      // Handle different session types
      if (duel_id) {
        sessionType = 'duel';
        
        // Get duel details for time limit and validation
        const duelResult = await client.query(
          'SELECT * FROM duels WHERE duel_id = $1 AND (duel_creator_id = $2 OR duel_invited_player_id = $2)',
          [duel_id, player_id]
        );

        if (duelResult.rows.length === 0) {
          client.release();
          return res.status(404).json({ success: false, message: 'Duel not found or access denied' });
        }

        const duel = duelResult.rows[0];
        timeLimit = duel.time_limit_minutes;
        sessionMetadata.duel_id = duel_id;
      } 
      else if (league_round_id) {
        sessionType = 'league';
        
        // Get league round details for time limit and validation
        const roundResult = await client.query(`
          SELECT lr.*, l.settings->>'time_limit_minutes' as league_time_limit
          FROM league_rounds lr
          JOIN leagues l ON lr.league_id = l.league_id
          WHERE lr.round_id = $1
        `, [league_round_id]);

        if (roundResult.rows.length === 0) {
          client.release();
          return res.status(404).json({ success: false, message: 'League round not found' });
        }

        const round = roundResult.rows[0];

        // Check if round is active
        const now = new Date();
        const startTime = new Date(round.start_time);
        const endTime = new Date(round.end_time);

        if (now < startTime) {
          client.release();
          return res.status(400).json({ 
            success: false, 
            message: `Round has not started yet. Starts at ${startTime.toLocaleString()}` 
          });
        }

        if (now > endTime) {
          client.release();
          return res.status(400).json({ 
            success: false, 
            message: 'Round has already ended' 
          });
        }

        // Verify player is a league member
        const memberResult = await client.query(
          'SELECT * FROM league_members WHERE league_id = $1 AND player_id = $2',
          [round.league_id, player_id]
        );

        if (memberResult.rows.length === 0) {
          client.release();
          return res.status(403).json({ success: false, message: 'You are not a member of this league' });
        }

        timeLimit = round.league_time_limit ? parseInt(round.league_time_limit) : null;
        sessionMetadata.league_round_id = league_round_id;
        sessionMetadata.league_id = round.league_id;
      }

      // Create session record
      console.log('[start-session] Creating session with:', {
        player_id,
        status: 'active',
        metadata: sessionMetadata,
        sessionType,
        timeLimit
      });
      
      const sessionResult = await client.query(
        'INSERT INTO sessions (player_id, status, metadata, created_at) VALUES ($1, $2, $3, $4) RETURNING session_id',
        [player_id, 'active', JSON.stringify(sessionMetadata), new Date()]
      );
      
      console.log('[start-session] Session created successfully:', sessionResult.rows[0]);

      const sessionId = sessionResult.rows[0].session_id;

      // Generate deep link URL with appropriate parameters
      let deepLinkUrl = `proofofputt://start-session?type=${sessionType}&id=${sessionId}&player_id=${player_id}`;
      
      if (timeLimit) {
        deepLinkUrl += `&timeLimit=${timeLimit}`;
      }

      if (duel_id) {
        deepLinkUrl += `&duel_id=${duel_id}`;
      }

      if (league_round_id) {
        deepLinkUrl += `&league_round_id=${league_round_id}`;
      }

      client.release();

      console.log(`Session ${sessionId} started for player ${player_id}, type: ${sessionType}`);
      console.log(`Deep link URL: ${deepLinkUrl}`);

      return res.status(200).json({
        success: true,
        message: `${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} session started successfully`,
        session_id: sessionId,
        deep_link_url: deepLinkUrl,
        session_type: sessionType,
        time_limit_minutes: timeLimit,
        metadata: sessionMetadata
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[start-session] Error starting session:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to start session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        detail: error.detail
      } : undefined
    });
  }
}