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
    const results = {};
    
    // 1. List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    results.tables = tablesResult.rows.map(row => row.table_name);

    // 2. Check sessions table and get a sample
    const sessionsCountResult = await client.query('SELECT COUNT(*) as count FROM sessions WHERE player_id = 1');
    results.sessions_for_player_1 = parseInt(sessionsCountResult.rows[0].count);

    if (results.sessions_for_player_1 > 0) {
      const sampleResult = await client.query(`
        SELECT session_id, data, created_at 
        FROM sessions 
        WHERE player_id = 1 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      const sample = sampleResult.rows[0];
      results.latest_session = {
        session_id: sample.session_id,
        created_at: sample.created_at,
        data_keys: sample.data ? Object.keys(sample.data) : null,
        has_total_makes: sample.data && 'total_makes' in sample.data,
        has_fastest_21_makes_seconds: sample.data && 'fastest_21_makes_seconds' in sample.data,
        data_sample: sample.data ? {
          total_makes: sample.data.total_makes,
          total_misses: sample.data.total_misses,
          best_streak: sample.data.best_streak,
          fastest_21_makes_seconds: sample.data.fastest_21_makes_seconds
        } : null
      };
    }

    // 3. Check if player_stats table exists
    try {
      const statsResult = await client.query('SELECT COUNT(*) as count FROM player_stats');
      results.player_stats_table = `exists (${statsResult.rows[0].count} records)`;
    } catch (error) {
      results.player_stats_table = `missing: ${error.message}`;
    }

    // 4. Check if player_calibration exists
    try {
      const calibResult = await client.query('SELECT COUNT(*) as count FROM player_calibration');
      results.player_calibration_table = `exists (${calibResult.rows[0].count} records)`;
    } catch (error) {
      results.player_calibration_table = `missing: ${error.message}`;
    }

    client.release();
    
    return res.status(200).json({
      success: true,
      results: results
    });

  } catch (error) {
    if (client) client.release();
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}