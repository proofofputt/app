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
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { id } = req.query;
  const playerId = parseInt(id);

  if (!playerId) {
    return res.status(400).json({ success: false, message: 'Valid player ID is required' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Get player basic info
      const playerResult = await client.query(
        'SELECT player_id, name, email, membership_tier, timezone, created_at, referral_code FROM players WHERE player_id = $1',
        [playerId]
      );

      if (playerResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ success: false, message: 'Player not found' });
      }

      const player = playerResult.rows[0];

      // Simple stats aggregation - try different approaches
      let statsResult;
      
      try {
        // Try simple aggregation first
        statsResult = await client.query(`
          SELECT 
            COUNT(session_id) as total_sessions,
            COALESCE(SUM(CAST(COALESCE(data->>'total_makes', data->'analytic_stats'->>'total_makes', '0') AS INTEGER)), 0) as total_makes,
            COALESCE(SUM(CAST(COALESCE(data->>'total_misses', data->'analytic_stats'->>'total_misses', '0') AS INTEGER)), 0) as total_misses,
            COALESCE(MAX(CAST(COALESCE(data->>'best_streak', data->'consecutive_stats'->>'max_consecutive', '0') AS INTEGER)), 0) as best_streak,
            MAX(created_at) as last_session_at
          FROM sessions 
          WHERE player_id = $1 
          AND data IS NOT NULL
        `, [playerId]);
      } catch (complexError) {
        // Fallback to very simple query
        console.log('Complex query failed, using simple fallback:', complexError.message);
        statsResult = await client.query(`
          SELECT 
            COUNT(session_id) as total_sessions,
            0 as total_makes,
            0 as total_misses,
            0 as best_streak,
            MAX(created_at) as last_session_at
          FROM sessions 
          WHERE player_id = $1
        `, [playerId]);
      }

      const stats = statsResult.rows[0];
      
      // Calculate derived stats
      const totalPutts = (stats.total_makes || 0) + (stats.total_misses || 0);
      const makePercentage = totalPutts > 0 ? ((stats.total_makes / totalPutts) * 100) : 0;

      // Get recent sessions (simple version)
      const sessionsResult = await client.query(`
        SELECT 
          session_id,
          created_at,
          data
        FROM sessions 
        WHERE player_id = $1 
        ORDER BY created_at DESC 
        LIMIT 5
      `, [playerId]);

      const sessions = sessionsResult.rows.map(session => ({
        session_id: session.session_id,
        created_at: session.created_at,
        ...(session.data || {})
      }));

      client.release();

      // Build simple response
      const responseData = {
        player_id: player.player_id,
        name: player.name,
        email: player.email,
        membership_tier: player.membership_tier,
        timezone: player.timezone,
        created_at: player.created_at,
        referral_code: player.referral_code,
        
        // Simple stats object
        stats: {
          total_sessions: parseInt(stats.total_sessions) || 0,
          total_makes: parseInt(stats.total_makes) || 0,
          total_misses: parseInt(stats.total_misses) || 0,
          best_streak: parseInt(stats.best_streak) || 0,
          fastest_21_makes_seconds: null,
          max_makes_per_minute: 0,
          max_putts_per_minute: 0,
          most_in_60_seconds: 0,
          max_session_duration: 0,
          make_percentage: parseFloat(makePercentage.toFixed(1)),
          last_session_at: stats.last_session_at
        },

        // Recent sessions array
        sessions: sessions,
        
        // Calibration data removed - now handled by desktop app
      };

      return res.status(200).json(responseData);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching simple player data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch player data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}