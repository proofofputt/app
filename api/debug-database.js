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
    const diagnostics = {};

    // 1. Check database connection
    diagnostics.connection = "✅ Connected successfully";

    // 2. List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    diagnostics.tables = tablesResult.rows.map(row => row.table_name);

    // 3. Check players table
    const playersResult = await client.query('SELECT COUNT(*) as count FROM players');
    diagnostics.players_count = parseInt(playersResult.rows[0].count);

    // 4. Check if player 1 exists
    const player1Result = await client.query('SELECT player_id, name, email FROM players WHERE player_id = 1');
    diagnostics.player_1 = player1Result.rows.length > 0 ? player1Result.rows[0] : "❌ Not found";

    // 5. Check sessions table structure and data
    const sessionsCountResult = await client.query('SELECT COUNT(*) as count FROM sessions');
    diagnostics.sessions_count = parseInt(sessionsCountResult.rows[0].count);

    // 6. Check sessions for player 1
    const player1SessionsResult = await client.query('SELECT COUNT(*) as count FROM sessions WHERE player_id = 1');
    diagnostics.player_1_sessions = parseInt(player1SessionsResult.rows[0].count);

    // 7. Check a sample session data structure
    const sampleSessionResult = await client.query(`
      SELECT session_id, data, created_at 
      FROM sessions 
      WHERE player_id = 1 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (sampleSessionResult.rows.length > 0) {
      const sampleSession = sampleSessionResult.rows[0];
      diagnostics.sample_session = {
        session_id: sampleSession.session_id,
        data_keys: sampleSession.data ? Object.keys(sampleSession.data) : "❌ No data",
        created_at: sampleSession.created_at
      };
    } else {
      diagnostics.sample_session = "❌ No sessions found for player 1";
    }

    // 8. Check if player_calibration table exists
    try {
      const calibrationCountResult = await client.query('SELECT COUNT(*) as count FROM player_calibration');
      diagnostics.player_calibration_table = `✅ Exists with ${calibrationCountResult.rows[0].count} records`;
    } catch (error) {
      diagnostics.player_calibration_table = `❌ Missing or error: ${error.message}`;
    }

    // 9. Check if player_stats table exists
    try {
      const statsCountResult = await client.query('SELECT COUNT(*) as count FROM player_stats');
      diagnostics.player_stats_table = `✅ Exists with ${statsCountResult.rows[0].count} records`;
    } catch (error) {
      diagnostics.player_stats_table = `❌ Missing or error: ${error.message}`;
    }

    // 10. Check duels table
    try {
      const duelsCountResult = await client.query('SELECT COUNT(*) as count FROM duels');
      diagnostics.duels_table = `✅ Exists with ${duelsCountResult.rows[0].count} records`;
    } catch (error) {
      diagnostics.duels_table = `❌ Missing or error: ${error.message}`;
    }

    // 11. Check leagues tables
    try {
      const leaguesCountResult = await client.query('SELECT COUNT(*) as count FROM leagues');
      diagnostics.leagues_table = `✅ Exists with ${leaguesCountResult.rows[0].count} records`;
    } catch (error) {
      diagnostics.leagues_table = `❌ Missing or error: ${error.message}`;
    }

    // 12. Test the exact query from player data API
    try {
      const testQuery = await client.query(`
        SELECT 
          COUNT(session_id) as total_sessions,
          COALESCE(SUM(CAST(data->>'total_makes' AS INTEGER)), 0) as total_makes,
          COALESCE(SUM(CAST(data->>'total_misses' AS INTEGER)), 0) as total_misses,
          COALESCE(MAX(CAST(data->>'best_streak' AS INTEGER)), 0) as best_streak,
          COALESCE(MIN(NULLIF(CAST(data->>'fastest_21_makes_seconds' AS DECIMAL), 0)), NULL) as fastest_21_makes,
          COALESCE(MAX(CAST(data->>'makes_per_minute' AS DECIMAL)), 0) as max_makes_per_minute,
          COALESCE(MAX(CAST(data->>'putts_per_minute' AS DECIMAL)), 0) as max_putts_per_minute,
          COALESCE(MAX(CAST(data->>'most_makes_in_60_seconds' AS INTEGER)), 0) as most_in_60_seconds,
          COALESCE(MAX(CAST(data->>'session_duration' AS DECIMAL)), 0) as max_session_duration,
          MAX(created_at) as last_session_at
        FROM sessions 
        WHERE player_id = $1 
        AND data IS NOT NULL
      `, [1]);
      
      diagnostics.player_stats_query = `✅ Success: ${JSON.stringify(testQuery.rows[0])}`;
    } catch (error) {
      diagnostics.player_stats_query = `❌ Failed: ${error.message}`;
    }

    client.release();
    
    return res.status(200).json({
      status: "Database Diagnostics Complete",
      timestamp: new Date().toISOString(),
      diagnostics: diagnostics
    });

  } catch (error) {
    if (client) client.release();
    return res.status(500).json({
      status: "Database Diagnostics Failed",
      error: error.message,
      stack: error.stack
    });
  }
}