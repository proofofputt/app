import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { player_id } = req.query;

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'player_id is required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Simple career stats query
    const statsResult = await client.query(`
      SELECT 
        COUNT(session_id) as total_sessions,
        COALESCE(SUM(CAST(COALESCE(data->>'total_makes', data->'analytic_stats'->>'total_makes', '0') AS INTEGER)), 0) as total_makes,
        COALESCE(SUM(CAST(COALESCE(data->>'total_misses', data->'analytic_stats'->>'total_misses', '0') AS INTEGER)), 0) as total_misses,
        COALESCE(MAX(CAST(COALESCE(data->>'best_streak', data->'consecutive_stats'->>'max_consecutive', '0') AS INTEGER)), 0) as best_streak
      FROM sessions 
      WHERE player_id = $1 
      AND data IS NOT NULL
    `, [player_id]);

    const stats = statsResult.rows[0];
    const totalPutts = (stats.total_makes || 0) + (stats.total_misses || 0);
    const makePercentage = totalPutts > 0 ? ((stats.total_makes / totalPutts) * 100) : 0;

    return res.status(200).json({
      success: true,
      career_stats: {
        total_sessions: parseInt(stats.total_sessions) || 0,
        total_makes: parseInt(stats.total_makes) || 0,
        total_misses: parseInt(stats.total_misses) || 0,
        total_putts: totalPutts,
        make_percentage: parseFloat(makePercentage.toFixed(1)),
        best_streak: parseInt(stats.best_streak) || 0,
        makes_by_category: {
          CENTER: 0,
          LEFT: 0,
          RIGHT: 0
        },
        misses_by_category: {
          CATCH: 0,
          TIMEOUT: 0,
          RETURN: 0
        }
      }
    });

  } catch (error) {
    console.error('Career stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load career stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}