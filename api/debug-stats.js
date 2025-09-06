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
    
    // Test simple aggregation first
    const simpleStats = await client.query(`
      SELECT 
        COUNT(session_id) as session_count,
        COUNT(CASE WHEN data IS NOT NULL THEN 1 END) as sessions_with_data
      FROM sessions 
      WHERE player_id = 1
    `);
    
    // Test our complex query
    try {
      const complexStats = await client.query(`
        SELECT 
          COUNT(session_id) as total_sessions,
          COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as flat_makes,
          COALESCE(SUM(CAST(data->'analytic_stats'->>'total_makes' AS INTEGER)), 0) as nested_makes
        FROM sessions 
        WHERE player_id = 1 
        AND data IS NOT NULL
      `);
      
      // Get proper aggregated stats for dashboard
      const fullStatsResult = await client.query(`
        SELECT 
          COUNT(session_id) as total_sessions,
          COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
          COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
          COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak,
          MIN(CASE WHEN CAST(data->>'fastest_21_makes' AS DECIMAL) > 0 
              THEN CAST(data->>'fastest_21_makes' AS DECIMAL) END) as fastest_21_makes,
          COALESCE(MAX(CAST(data->>'makes_per_minute' AS DECIMAL)), 0) as max_makes_per_minute,
          COALESCE(MAX(CAST(data->>'putts_per_minute' AS DECIMAL)), 0) as max_putts_per_minute,
          COALESCE(MAX(CAST(data->>'most_makes_in_60_seconds' AS INTEGER)), 0) as most_in_60_seconds
        FROM sessions 
        WHERE player_id = 1 
        AND data IS NOT NULL
      `);

      const fullStats = fullStatsResult.rows[0];
      const totalPutts = (fullStats.total_makes || 0) + (fullStats.total_misses || 0);
      const makePercentage = totalPutts > 0 ? ((fullStats.total_makes / totalPutts) * 100) : 0;

      // Dashboard-compatible response format with real data
      const dashboardStats = {
        player_id: 1,
        name: "Debug User",
        email: "debug@example.com",
        stats: {
          total_sessions: parseInt(fullStats.total_sessions) || 0,
          total_makes: parseInt(fullStats.total_makes) || 0,
          total_misses: parseInt(fullStats.total_misses) || 0,
          best_streak: parseInt(fullStats.best_streak) || 0,
          fastest_21_makes_seconds: fullStats.fastest_21_makes ? parseFloat(fullStats.fastest_21_makes) : null,
          max_makes_per_minute: parseFloat(fullStats.max_makes_per_minute) || 0,
          max_putts_per_minute: parseFloat(fullStats.max_putts_per_minute) || 0,
          most_in_60_seconds: parseInt(fullStats.most_in_60_seconds) || 0,
          make_percentage: parseFloat(makePercentage.toFixed(1)),
          last_session_at: null
        },
        sessions: []
      };

      return res.status(200).json({
        success: true,
        simple_stats: simpleStats.rows[0],
        complex_stats: complexStats.rows[0],
        dashboard_data: dashboardStats
      });
      
    } catch (complexError) {
      return res.status(200).json({
        success: false,
        simple_stats: simpleStats.rows[0],
        complex_error: complexError.message
      });
    }
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}