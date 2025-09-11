import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Authentication required
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const playerId = parseInt(user.playerId);

  const client = await pool.connect();
  
  try {
    // Get active duels and leagues for the player
    const activeDuelsResult = await client.query(`
      SELECT 
        d.duel_id,
        d.status,
        d.duel_creator_id,
        d.challenged_id,
        d.rules,
        d.created_at,
        d.started_at,
        d.challenger_session_id,
        d.challenged_session_id,
        challenger.display_name as challenger_name,
        challenged.display_name as challenged_name
      FROM duels d
      LEFT JOIN users creator ON d.duel_creator_id = creator.id
      LEFT JOIN users challenged ON d.challenged_id = challenged.id
      WHERE (d.duel_creator_id = $1 OR d.duel_invited_player_id = $1) 
        AND d.status IN ('pending', 'active')
      ORDER BY d.created_at DESC
    `, [playerId]);

    // Calculate status for each active duel
    const activeDuels = activeDuelsResult.rows.map(duel => {
      const isCreator = duel.duel_creator_id === playerId;
      
      // Check time expiration
      let timeRemaining = null;
      let isExpired = false;
      
      if (duel.rules?.time_limit_hours) {
        const createdAt = new Date(duel.created_at);
        const expiryTime = new Date(createdAt.getTime() + (duel.rules.time_limit_hours * 60 * 60 * 1000));
        const now = new Date();
        
        if (now > expiryTime) {
          isExpired = true;
          timeRemaining = 0;
        } else {
          timeRemaining = Math.max(0, Math.floor((expiryTime - now) / (1000 * 60))); // minutes remaining
        }
      }

      return {
        duel_id: duel.duel_id,
        status: duel.status,
        is_challenger: isChallenger,
        opponent_name: isChallenger ? 
          (duel.challenged_name || `Player ${duel.challenged_id}`) : 
          (duel.creator_name || `Player ${duel.duel_creator_id}`),
        my_session_submitted: isChallenger ? !!duel.challenger_session_id : !!duel.challenged_session_id,
        opponent_session_submitted: isChallenger ? !!duel.challenged_session_id : !!duel.challenger_session_id,
        time_limit_hours: duel.rules?.time_limit_hours || null,
        time_remaining_minutes: timeRemaining,
        is_expired: isExpired,
        created_at: duel.created_at,
        started_at: duel.started_at
      };
    });

    // Get recent session activity
    const recentSessionsResult = await client.query(`
      SELECT 
        session_id,
        data,
        created_at
      FROM sessions 
      WHERE player_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [playerId]);

    const recentSessions = recentSessionsResult.rows.map(session => {
      const data = session.data || {};
      return {
        session_id: session.session_id,
        session_type: data.session_type || 'practice',
        total_putts: data.total_putts || 0,
        total_makes: data.total_makes || 0,
        uploaded_at: session.created_at
      };
    });

    // Get overall player statistics
    const playerStatsResult = await client.query(`
      SELECT 
        total_sessions,
        total_putts,
        total_makes,
        make_percentage,
        best_streak,
        last_session_at
      FROM player_stats 
      WHERE player_id = $1
    `, [playerId]);

    const playerStats = playerStatsResult.rows[0] || {
      total_sessions: 0,
      total_putts: 0,
      total_makes: 0,
      make_percentage: 0,
      best_streak: 0,
      last_session_at: null
    };

    return res.status(200).json({
      success: true,
      player_id: playerId,
      session_status: {
        active_duels: activeDuels,
        active_duels_count: activeDuels.length,
        pending_duel_invitations: activeDuels.filter(d => d.status === 'pending' && !d.is_challenger).length,
        active_duel_sessions: activeDuels.filter(d => d.status === 'active').length,
        recent_sessions: recentSessions,
        player_stats: playerStats,
        last_activity: playerStats.last_session_at || null
      }
    });

  } catch (error) {
    console.error('[session-status] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}