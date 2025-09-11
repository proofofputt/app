import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { player_id } = req.query;
  const limit = parseInt(req.query.limit) || 20; // Default to 20 for session selection

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'Player ID is required' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get sessions for the player
    const sessionsResult = await client.query(`
      SELECT 
        session_id,
        player_id,
        data,
        stats_summary,
        created_at,
        updated_at
      FROM sessions 
      WHERE player_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [parseInt(player_id), limit]);

    const sessions = sessionsResult.rows.map(session => {
      const sessionData = session.data || {};
      const statsData = session.stats_summary || {};
      
      return {
        session_id: session.session_id,
        player_id: session.player_id,
        start_time: session.created_at, // For compatibility with SessionSelectModal
        created_at: session.created_at,
        updated_at: session.updated_at,
        // Session statistics
        total_putts: statsData.total_putts || sessionData.total_putts || 0,
        total_makes: statsData.total_makes || sessionData.total_makes || 0,
        makes: statsData.total_makes || sessionData.total_makes || 0,
        misses: statsData.total_misses || sessionData.total_misses || 0,
        best_streak: statsData.best_streak || sessionData.best_streak || 0,
        duration: formatDuration(statsData.session_duration || sessionData.session_duration || sessionData.session_duration_seconds || 0),
        session_duration_seconds: statsData.session_duration || sessionData.session_duration || sessionData.session_duration_seconds || 0,
        putts_per_minute: sessionData.putts_per_minute || 0,
        makes_per_minute: sessionData.makes_per_minute || 0,
        most_makes_in_60_seconds: sessionData.most_makes_in_60_seconds || 0,
        fastest_21_makes: sessionData.fastest_21_makes || null,
        make_percentage: sessionData.make_percentage || 0
      };
    });

    res.status(200).json(sessions);

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}