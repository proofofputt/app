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
    
    // Test the exact same query as player data API but with better error handling
    const statsResult = await client.query(`
      SELECT 
        COUNT(session_id) as total_sessions,
        COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
        COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
        COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak
      FROM sessions 
      WHERE player_id = 1 
      AND data IS NOT NULL
    `);

    const stats = statsResult.rows[0];
    client.release();

    return res.status(200).json({
      success: true,
      simple_query: stats,
      message: "Basic query working"
    });

  } catch (error) {
    console.error('Debug query error:', error);
    return res.status(500).json({
      success: false,
      message: 'Debug query failed',
      error: error.message,
      detail: error.detail || 'No additional detail'
    });
  } finally {
    if (client) client.release();
  }
}