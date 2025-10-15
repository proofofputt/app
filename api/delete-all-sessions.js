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
  if (confirm !== 'DELETE_ALL_SESSIONS_NOW') {
    return res.status(400).json({ 
      success: false, 
      message: 'Confirmation required. Send { "confirm": "DELETE_ALL_SESSIONS_NOW" } to proceed.' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('🗑️ Starting sessions deletion via API...');
    
    // Get session counts before deletion (by player)
    const beforeResult = await client.query(`
      SELECT 
        player_id, 
        COUNT(*) as session_count,
        COALESCE(SUM(CAST(jsonb_extract_path_text(data, 'total_makes') AS INTEGER)), 0) as total_makes
      FROM sessions 
      WHERE data IS NOT NULL 
      GROUP BY player_id 
      ORDER BY player_id
    `);
    
    // Get total count
    const totalBeforeResult = await client.query('SELECT COUNT(*) FROM sessions');
    const totalSessionsBefore = parseInt(totalBeforeResult.rows[0].count);
    
    // Delete all sessions - simple and direct
    const deleteResult = await client.query('DELETE FROM sessions');
    const sessionsDeleted = deleteResult.rowCount;
    
    // Verify deletion
    const afterResult = await client.query('SELECT COUNT(*) FROM sessions');
    const totalSessionsAfter = parseInt(afterResult.rows[0].count);
    
    console.log(`✅ Sessions deletion completed: ${sessionsDeleted} sessions deleted`);
    
    return res.status(200).json({
      success: true,
      message: 'All sessions deleted successfully',
      results: {
        sessions_before: totalSessionsBefore,
        sessions_deleted: sessionsDeleted,
        sessions_remaining: totalSessionsAfter,
        deletion_successful: totalSessionsAfter === 0
      },
      player_breakdown_before: beforeResult.rows.reduce((acc, row) => {
        acc[`player_${row.player_id}`] = {
          sessions: parseInt(row.session_count),
          total_makes: parseInt(row.total_makes)
        };
        return acc;
      }, {}),
      instructions: [
        '✅ All session history deleted from database',
        '🔍 Check All-time Stats - should show 0 if calculation works correctly', 
        '🚨 If All-time Stats still show old values, there is a bug in career-stats.js',
        '🧪 Create a new session to test if stats now calculate correctly'
      ]
    });
    
  } catch (error) {
    console.error('❌ Error during sessions deletion:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Sessions deletion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database error occurred'
    });
  } finally {
    if (client) client.release();
  }
}