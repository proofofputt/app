import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Test the exact query from player data API that's failing
    console.log('Testing player stats query...');
    
    const statsResult = await client.query(`
      SELECT 
        COUNT(session_id) as total_sessions,
        COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
        COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
        COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak
      FROM sessions 
      WHERE player_id = $1 
      AND data IS NOT NULL
    `, [1]);

    console.log('Basic query successful, testing advanced fields...');
    
    // Test if the problematic fields exist
    const advancedResult = await client.query(`
      SELECT 
        data->>'fastest_21_makes_seconds' as fastest_21_field,
        data->>'makes_per_minute' as makes_per_minute_field,
        data->>'session_duration' as session_duration_field
      FROM sessions 
      WHERE player_id = 1 
      AND data IS NOT NULL
      LIMIT 1
    `);

    client.release();
    
    return res.status(200).json({
      success: true,
      basic_stats: statsResult.rows[0],
      sample_fields: advancedResult.rows[0] || null,
      message: "Query test completed successfully"
    });

  } catch (error) {
    if (client) client.release();
    console.error('Query test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      query_step: "Failed during query execution"
    });
  }
}