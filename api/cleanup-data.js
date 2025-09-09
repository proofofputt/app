import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed - Use POST' });
  }

  // Security check - require confirmation
  const { confirm } = req.body;
  if (confirm !== 'DELETE_ALL_DATA_FOR_TESTING') {
    return res.status(400).json({ 
      success: false, 
      message: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA_FOR_TESTING" } to proceed.' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('🧹 Starting comprehensive data cleanup via API...');
    
    // Start transaction for safety
    await client.query('BEGIN');
    
    const results = {
      duels: 0,
      duel_sessions: 0,
      leagues: 0,
      league_rounds: 0,
      league_memberships: 0,
      league_round_sessions: 0,
      sessions: 0,
      notifications: 0,
      players_reset: 0
    };
    
    // ====================================================================
    // 1. CLEAN UP DUEL-RELATED DATA
    // ====================================================================
    console.log('🥊 Cleaning up duel-related data...');
    
    // Delete duel session submissions
    const duelSessionsResult = await client.query('DELETE FROM duel_sessions');
    results.duel_sessions = duelSessionsResult.rowCount;
    
    // Delete all duels
    const duelsResult = await client.query('DELETE FROM duels');
    results.duels = duelsResult.rowCount;
    
    // ====================================================================
    // 2. CLEAN UP LEAGUE-RELATED DATA
    // ====================================================================
    console.log('🏆 Cleaning up league-related data...');
    
    // Delete league round sessions
    const leagueRoundSessionsResult = await client.query('DELETE FROM league_round_sessions');
    results.league_round_sessions = leagueRoundSessionsResult.rowCount;
    
    // Delete league rounds
    const leagueRoundsResult = await client.query('DELETE FROM league_rounds');
    results.league_rounds = leagueRoundsResult.rowCount;
    
    // Delete league memberships
    const membershipsResult = await client.query('DELETE FROM league_memberships');
    results.league_memberships = membershipsResult.rowCount;
    
    // Delete all leagues
    const leaguesResult = await client.query('DELETE FROM leagues');
    results.leagues = leaguesResult.rowCount;
    
    // ====================================================================
    // 3. CLEAN UP SESSION HISTORY
    // ====================================================================
    console.log('📊 Cleaning up session history...');
    
    // Delete all sessions
    const sessionsResult = await client.query('DELETE FROM sessions');
    results.sessions = sessionsResult.rowCount;
    
    // ====================================================================
    // 4. CLEAN UP NOTIFICATIONS
    // ====================================================================
    console.log('🔔 Cleaning up notifications...');
    
    // Delete competition/session related notifications
    const notificationsResult = await client.query(`
      DELETE FROM notifications 
      WHERE type IN ('duel_invitation', 'duel_completed', 'league_invitation', 'league_round_started', 'session_uploaded')
    `);
    results.notifications = notificationsResult.rowCount;
    
    // ====================================================================
    // 5. RESET PLAYER STATS
    // ====================================================================
    console.log('👤 Resetting player statistics...');
    
    // Reset player stats to zero (but keep player accounts)
    const playersResult = await client.query(`
      UPDATE players SET 
        total_sessions = 0,
        total_putts = 0, 
        total_makes = 0,
        best_streak = 0,
        make_percentage = 0.0,
        updated_at = CURRENT_TIMESTAMP
      WHERE player_id IS NOT NULL
    `);
    results.players_reset = playersResult.rowCount;
    
    // ====================================================================
    // 6. VERIFICATION QUERIES
    // ====================================================================
    const verification = {};
    const verificationQueries = [
      { key: 'sessions_remaining', query: 'SELECT COUNT(*) FROM sessions' },
      { key: 'duels_remaining', query: 'SELECT COUNT(*) FROM duels' },
      { key: 'leagues_remaining', query: 'SELECT COUNT(*) FROM leagues' },
      { key: 'active_players', query: 'SELECT COUNT(*) FROM players WHERE player_id IS NOT NULL' },
    ];
    
    for (const { key, query } of verificationQueries) {
      const result = await client.query(query);
      verification[key] = parseInt(result.rows[0].count);
    }
    
    // Commit all changes
    await client.query('COMMIT');
    console.log('✅ Data cleanup completed successfully via API');
    
    return res.status(200).json({
      success: true,
      message: 'All data cleanup completed successfully',
      deleted: results,
      verification,
      instructions: {
        next_steps: [
          'Career Stats should show 0 for all metrics',
          'Session History should be completely empty',
          'Duels Page should show "No duels in this category"',
          'Leagues Page should show no active leagues',
          'Dashboard should show fresh/clean state'
        ],
        test_verification: [
          'Create a new practice session via desktop app',
          'Career stats should show only that session\'s data',
          'All-time Stats should match Session History sum exactly'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Error during API cleanup:', error);
    
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'Cleanup failed - all changes rolled back',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    if (client) client.release();
  }
}