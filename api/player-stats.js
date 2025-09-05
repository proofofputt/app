import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { player_id } = req.query;

  if (!player_id) {
    return res.status(400).json({ success: false, message: 'Player ID is required' });
  }

  try {
    // Get player stats from the player_stats table
    const statsQuery = await pool.query(
      'SELECT * FROM player_stats WHERE player_id = $1',
      [player_id]
    );

    if (statsQuery.rows.length === 0) {
      // Return default stats if none exist
      return res.status(200).json({
        success: true,
        stats: {
          player_id: parseInt(player_id),
          total_sessions: 0,
          total_putts: 0,
          total_makes: 0,
          total_misses: 0,
          make_percentage: 0,
          best_streak: 0,
          last_session_at: null
        }
      });
    }

    const stats = statsQuery.rows[0];
    
    res.status(200).json({
      success: true,
      stats: {
        player_id: stats.player_id,
        total_sessions: stats.total_sessions,
        total_putts: stats.total_putts,
        total_makes: stats.total_makes,
        total_misses: stats.total_misses,
        make_percentage: parseFloat(stats.make_percentage),
        best_streak: stats.best_streak,
        last_session_at: stats.last_session_at
      }
    });

  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch player stats',
      error: error.message
    });
  }
}