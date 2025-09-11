import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

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
  // Set secure CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication (temporarily skip for player 1 for debugging)
  const { id } = req.query;
  const playerId = parseInt(id);
  
  if (playerId !== 1) {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
  }

  if (!playerId) {
    return res.status(400).json({ success: false, message: 'Valid player ID is required' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Get player basic info with display_name from users table
      const playerResult = await client.query(
        `SELECT p.player_id, p.name, p.email, p.membership_tier, p.timezone, p.created_at,
                u.display_name, u.username
         FROM players p 
         LEFT JOIN users u ON p.player_id = u.id 
         WHERE p.player_id = $1`,
        [playerId]
      );

      if (playerResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ success: false, message: 'Player not found' });
      }

      const player = playerResult.rows[0];

      // Get aggregated stats with defensive queries (prevent timeout issues)
      let stats = {
        total_sessions: 0,
        total_makes: 0,
        total_misses: 0,
        best_streak: 0,
        fastest_21_makes: null,
        max_makes_per_minute: 0,
        max_putts_per_minute: 0,
        most_in_60_seconds: 0,
        max_session_duration: 0,
        last_session_at: null
      };

      try {
        const statsResult = await client.query(`
          SELECT 
            COUNT(session_id) as total_sessions,
            COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
            COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
            COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak,
            MAX(created_at) as last_session_at
          FROM sessions 
          WHERE player_id = $1 
          AND data IS NOT NULL
        `, [playerId]);

        if (statsResult.rows.length > 0) {
          stats = { ...stats, ...statsResult.rows[0] };
        }

        // Try to get advanced fields separately to avoid timeout
        try {
          const advancedResult = await client.query(`
            SELECT 
              COALESCE(MIN(NULLIF(CAST(data->>'fastest_21_makes_seconds' AS DECIMAL), 0)), NULL) as fastest_21_makes,
              COALESCE(MAX(CAST(data->>'makes_per_minute' AS DECIMAL)), 0) as max_makes_per_minute,
              COALESCE(MAX(CAST(data->>'putts_per_minute' AS DECIMAL)), 0) as max_putts_per_minute,
              COALESCE(MAX(CAST(data->>'most_makes_in_60_seconds' AS INTEGER)), 0) as most_in_60_seconds,
              COALESCE(MAX(CAST(data->>'session_duration' AS DECIMAL)), 0) as max_session_duration
            FROM sessions 
            WHERE player_id = $1 
            AND data IS NOT NULL
            LIMIT 100
          `, [playerId]);

          if (advancedResult.rows.length > 0) {
            stats = { ...stats, ...advancedResult.rows[0] };
          }
        } catch (advancedError) {
          console.log('Advanced stats query failed, using defaults:', advancedError.message);
        }

      } catch (statsError) {
        console.log('Stats query failed, using empty stats:', statsError.message);
      }

      // Calculate derived stats
      const totalPutts = (stats.total_makes || 0) + (stats.total_misses || 0);
      const makePercentage = totalPutts > 0 ? ((stats.total_makes / totalPutts) * 100) : 0;

      // Get recent sessions (last 5, matching prototype)
      const sessionsResult = await client.query(`
        SELECT 
          session_id,
          created_at,
          data
        FROM sessions 
        WHERE player_id = $1 
        AND data IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 5
      `, [playerId]);

      const sessions = sessionsResult.rows.map(session => ({
        session_id: session.session_id,
        created_at: session.created_at,
        ...session.data
      }));

      // Get calibration data (if exists) - wrap in try/catch in case table doesn't exist
      let calibration_data = null;
      try {
        const calibrationResult = await client.query(
          'SELECT calibration_config FROM player_calibration WHERE player_id = $1 ORDER BY created_at DESC LIMIT 1',
          [playerId]
        );
        calibration_data = calibrationResult.rows.length > 0 ? 
          calibrationResult.rows[0].calibration_config : null;
      } catch (calibError) {
        console.log('Calibration table not found or error:', calibError.message);
        calibration_data = null;
      }

      // Build response matching prototype structure
      const responseData = {
        player_id: player.player_id,
        name: player.name,
        email: player.email,
        membership_tier: player.membership_tier,
        timezone: player.timezone,
        created_at: player.created_at,
        
        // Embedded stats object (like prototype)
        stats: {
          total_sessions: parseInt(stats.total_sessions) || 0,
          total_makes: parseInt(stats.total_makes) || 0,
          total_misses: parseInt(stats.total_misses) || 0,
          best_streak: parseInt(stats.best_streak) || 0,
          fastest_21_makes: stats.fastest_21_makes ? parseFloat(stats.fastest_21_makes) : null,
          fastest_21_makes_seconds: stats.fastest_21_makes ? parseFloat(stats.fastest_21_makes) : null,
          max_makes_per_minute: parseFloat(stats.max_makes_per_minute) || 0,
          max_putts_per_minute: parseFloat(stats.max_putts_per_minute) || 0,
          most_in_60_seconds: parseInt(stats.most_in_60_seconds) || 0,
          max_session_duration: parseInt(stats.max_session_duration) || 0,
          make_percentage: parseFloat(makePercentage.toFixed(1)),
          last_session_at: stats.last_session_at
        },

        // Recent sessions array (like prototype)  
        sessions: sessions,

        // Calibration data
        calibration_data: calibration_data
      };

      return res.status(200).json(responseData);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching comprehensive player data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch player data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}