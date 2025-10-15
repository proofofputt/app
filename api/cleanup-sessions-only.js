import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed - Use POST' });
  }

  // Security check - require confirmation
  const { confirm } = req.body;
  if (confirm !== 'DELETE_SESSIONS_FOR_TESTING') {
    return res.status(400).json({ 
      success: false, 
      message: 'Confirmation required. Send { "confirm": "DELETE_SESSIONS_FOR_TESTING" } to proceed.' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('🧹 Starting sessions cleanup via API...');
    
    // Start transaction for safety
    await client.query('BEGIN');
    
    // Get session counts before deletion
    const beforeCountResult = await client.query('SELECT COUNT(*) FROM sessions');
    const sessionsBefore = parseInt(beforeCountResult.rows[0].count);
    
    // Get session count by player before deletion
    const playerSessionsResult = await client.query(`
      SELECT player_id, COUNT(*) as count 
      FROM sessions 
      GROUP BY player_id 
      ORDER BY player_id
    `);
    
    // Delete all sessions
    const sessionsResult = await client.query('DELETE FROM sessions');
    const sessionsDeleted = sessionsResult.rowCount;
    
    // Reset player stats to zero (if table exists)
    let playersReset = 0;
    try {
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
      playersReset = playersResult.rowCount;
    } catch (playerError) {
      console.log('Player stats reset skipped:', playerError.message);
    }
    
    // Verification
    const afterCountResult = await client.query('SELECT COUNT(*) FROM sessions');
    const sessionsAfter = parseInt(afterCountResult.rows[0].count);
    
    const playersCountResult = await client.query('SELECT COUNT(*) FROM players WHERE player_id IS NOT NULL');
    const activePlayers = parseInt(playersCountResult.rows[0].count);
    
    // Commit all changes
    await client.query('COMMIT');
    console.log('✅ Sessions cleanup completed successfully via API');
    
    return res.status(200).json({
      success: true,
      message: 'Sessions cleanup completed successfully',
      results: {
        sessions_before: sessionsBefore,
        sessions_deleted: sessionsDeleted,
        sessions_remaining: sessionsAfter,
        players_stats_reset: playersReset,
        active_players: activePlayers
      },
      player_breakdown_before: playerSessionsResult.rows.reduce((acc, row) => {
        acc[`player_${row.player_id}`] = parseInt(row.count);
        return acc;
      }, {}),
      instructions: [
        'All session history has been cleared',
        'Player accounts remain intact',
        'All-time Stats should now show 0 for all metrics',
        'Create a new session to test if stats calculate correctly'
      ]
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
      message: 'Sessions cleanup failed - all changes rolled back',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    if (client) client.release();
  }
}