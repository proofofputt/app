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
    
    // Get sessions for the player with competition context
    const sessionsResult = await client.query(`
      SELECT
        s.session_id,
        s.player_id,
        s.data,
        s.stats_summary,
        s.created_at,
        s.updated_at,
        -- Duel context
        d.duel_id,
        d.status as duel_status,
        CASE
          WHEN d.duel_creator_id = s.player_id THEN d.duel_invited_player_id
          WHEN d.duel_invited_player_id = s.player_id THEN d.duel_creator_id
          ELSE NULL
        END as duel_opponent_id,
        CASE
          WHEN d.duel_creator_id = s.player_id THEN invited_player.name
          WHEN d.duel_invited_player_id = s.player_id THEN creator.name
          ELSE NULL
        END as duel_opponent_name,
        -- League context
        lrs.league_id,
        lrs.round_id as league_round_id,
        l.name as league_name,
        lr.round_number
      FROM sessions s
      -- LEFT JOIN for duel sessions
      LEFT JOIN duels d ON (s.session_id = d.duel_creator_session_id OR s.session_id = d.duel_invited_player_session_id)
      LEFT JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      -- LEFT JOIN for league sessions
      LEFT JOIN league_round_sessions lrs ON s.session_id = lrs.session_id
      LEFT JOIN leagues l ON lrs.league_id = l.league_id
      LEFT JOIN league_rounds lr ON lrs.round_id = lr.round_id
      WHERE s.player_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2
    `, [parseInt(player_id), limit]);

    const sessions = sessionsResult.rows.map(session => {
      const sessionData = session.data || {};
      const statsData = session.stats_summary || {};

      // Determine competition context
      let competitionContext = null;
      if (session.duel_id) {
        competitionContext = {
          type: 'duel',
          duel_id: session.duel_id,
          opponent_id: session.duel_opponent_id,
          opponent_name: session.duel_opponent_name,
          status: session.duel_status
        };
      } else if (session.league_id) {
        competitionContext = {
          type: 'league',
          league_id: session.league_id,
          league_round_id: session.league_round_id,
          league_name: session.league_name,
          round_number: session.round_number
        };
      }

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
        make_percentage: sessionData.make_percentage || 0,
        // Competition context
        competition: competitionContext
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