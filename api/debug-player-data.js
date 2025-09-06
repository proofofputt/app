import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get player basic info
    const playerResult = await client.query(
      'SELECT player_id, name, email, membership_tier, timezone, created_at FROM players WHERE player_id = 1'
    );

    if (playerResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get aggregated stats using flat structure (matching debug-stats logic)
    const statsResult = await client.query(`
      SELECT 
        COUNT(session_id) as total_sessions,
        COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
        COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
        COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak,
        MIN(CASE WHEN CAST(data->>'fastest_21_makes_seconds' AS DECIMAL) > 0 
            THEN CAST(data->>'fastest_21_makes_seconds' AS DECIMAL) END) as fastest_21_makes,
        COALESCE(MAX(CAST(data->>'makes_per_minute' AS DECIMAL)), 0) as max_makes_per_minute,
        COALESCE(MAX(CAST(data->>'putts_per_minute' AS DECIMAL)), 0) as max_putts_per_minute,
        COALESCE(MAX(CAST(data->>'most_makes_in_60_seconds' AS INTEGER)), 0) as most_in_60_seconds,
        COALESCE(MAX(CAST(data->>'session_duration_seconds' AS DECIMAL)), 0) as max_session_duration,
        MAX(created_at) as last_session_at
      FROM sessions 
      WHERE player_id = 1 
      AND data IS NOT NULL
    `);

    const stats = statsResult.rows[0];
    
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
      WHERE player_id = 1 
      AND data IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    const sessions = sessionsResult.rows.map(session => ({
      session_id: session.session_id,
      created_at: session.created_at,
      ...session.data
    }));

    client.release();

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
      sessions: sessions
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching debug player data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch player data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}