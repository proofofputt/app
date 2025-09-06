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
      
      return res.status(200).json({
        success: true,
        simple_stats: simpleStats.rows[0],
        complex_stats: complexStats.rows[0]
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