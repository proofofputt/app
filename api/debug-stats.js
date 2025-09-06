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
      
      // Create dashboard-compatible response format
      const totalMakes = parseInt(complexStats.rows[0].flat_makes) || 0;
      const totalSessions = parseInt(complexStats.rows[0].total_sessions) || 0;
      
      // Mock additional stats for dashboard testing
      const dashboardStats = {
        player_id: 1,
        name: "Debug User",
        email: "debug@example.com",
        stats: {
          total_sessions: totalSessions,
          total_makes: totalMakes,
          total_misses: 0, // Would need separate query to calculate
          best_streak: 0,
          fastest_21_makes_seconds: null,
          max_makes_per_minute: 0,
          max_putts_per_minute: 0,
          most_in_60_seconds: totalMakes > 0 ? totalMakes : 0, // Simple approximation
          max_session_duration: 0,
          make_percentage: 0,
          last_session_at: null
        },
        sessions: [] // Would need separate query to get session list
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