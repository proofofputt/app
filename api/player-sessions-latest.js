import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  const limit = parseInt(req.query.limit) || 5;

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'Player ID is required' });
  }

  try {
    // Get latest sessions for the player
    const sessionsQuery = await pool.query(`
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
    `, [player_id, limit]);

    const sessions = sessionsQuery.rows.map(session => {
      const sessionData = session.data || {};
      const statsData = session.stats_summary || {};
      
      return {
        session_id: session.session_id,
        player_id: session.player_id,
        session_date: session.created_at,
        created_at: session.created_at,
        updated_at: session.updated_at,
        // Include session statistics in correct order for dashboard table
        total_putts: statsData.total_putts || sessionData.total_putts || 0,
        makes: statsData.total_makes || sessionData.total_makes || 0,
        misses: statsData.total_misses || sessionData.total_misses || 0,
        best_streak: statsData.best_streak || sessionData.best_streak || 0,
        duration: formatDuration(statsData.session_duration || sessionData.session_duration || sessionData.session_duration_seconds || 0),
        ppm: sessionData.putts_per_minute || 0, // Putts Per Minute
        mpm: sessionData.makes_per_minute || 0, // Makes Per Minute  
        most_in_60s: sessionData.most_makes_in_60_seconds || 0,
        fastest_21: sessionData.fastest_21_makes || null
      };
    });

    res.status(200).json({
      success: true,
      sessions: sessions,
      total: sessions.length
    });

  } catch (error) {
    console.error('Error fetching latest sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest sessions',
      error: error.message
    });
  }
}