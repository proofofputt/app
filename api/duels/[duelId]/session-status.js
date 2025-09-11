import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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

  // Authentication required
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { duelId } = req.query;
  const playerId = parseInt(user.playerId);

  if (!duelId) {
    return res.status(400).json({ success: false, message: 'duelId is required' });
  }

  const client = await pool.connect();
  
  try {
    // Get duel information with session data
    const duelResult = await client.query(`
      SELECT 
        d.*,
        creator.name as creator_name,
        invited_player.name as invited_player_name,
        cs.data as challenger_session_data,
        chs.data as challenged_session_data,
        cs.created_at as challenger_session_uploaded_at,
        chs.created_at as challenged_session_uploaded_at
      FROM duels d
      LEFT JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      LEFT JOIN sessions cs ON d.duel_creator_session_id = cs.session_id
      LEFT JOIN sessions chs ON d.duel_invited_player_session_id = chs.session_id
      WHERE d.duel_id = $1 AND (d.duel_creator_id = $2 OR d.duel_invited_player_id = $2)
    `, [duelId, playerId]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Duel not found or access denied' });
    }

    const duel = duelResult.rows[0];
    const isCreator = duel.duel_creator_id === playerId;

    // Check if duel has time limits and calculate remaining time
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

    // Build session status information
    const sessionStatus = {
      duel_id: duel.duel_id,
      status: duel.status,
      duel_creator_id: duel.duel_creator_id,
      duel_invited_player_id: duel.duel_invited_player_id,
      creator_name: duel.creator_name || `Player ${duel.duel_creator_id}`,
      invited_player_name: duel.invited_player_name || `Player ${duel.duel_invited_player_id}`,
      is_creator: isCreator,
      rules: duel.rules,
      
      // Time information
      time_limit_hours: duel.rules?.time_limit_hours || null,
      time_remaining_minutes: timeRemaining,
      is_expired: isExpired,
      created_at: duel.created_at,
      started_at: duel.started_at,
      completed_at: duel.completed_at,
      
      // Session submission status
      creator_session_submitted: !!duel.duel_creator_session_id,
      invited_player_session_submitted: !!duel.duel_invited_player_session_id,
      creator_session_uploaded_at: duel.creator_session_uploaded_at,
      invited_player_session_uploaded_at: duel.invited_player_session_uploaded_at,
      
      // Player-specific status
      my_session_submitted: isCreator ? !!duel.duel_creator_session_id : !!duel.duel_invited_player_session_id,
      opponent_session_submitted: isCreator ? !!duel.duel_invited_player_session_id : !!duel.duel_creator_session_id,
      
      // Results (if completed)
      winner_id: duel.winner_id,
      is_winner: duel.winner_id === playerId,
      is_tie: duel.status === 'completed' && !duel.winner_id
    };

    // Add basic session stats if available (without full session data for performance)
    if (duel.duel_creator_session_data) {
      const creatorStats = duel.duel_creator_session_data;
      sessionStatus.creator_stats = {
        total_putts: creatorStats.total_putts || 0,
        total_makes: creatorStats.total_makes || 0,
        make_percentage: creatorStats.make_percentage || 0,
        best_streak: creatorStats.best_streak || 0,
        session_duration: creatorStats.session_duration || creatorStats.session_duration_seconds || 0
      };
    }

    if (duel.duel_invited_player_session_data) {
      const invitedPlayerStats = duel.duel_invited_player_session_data;
      sessionStatus.invited_player_stats = {
        total_putts: invitedPlayerStats.total_putts || 0,
        total_makes: invitedPlayerStats.total_makes || 0,
        make_percentage: invitedPlayerStats.make_percentage || 0,
        best_streak: invitedPlayerStats.best_streak || 0,
        session_duration: invitedPlayerStats.session_duration || invitedPlayerStats.session_duration_seconds || 0
      };
    }

    return res.status(200).json({
      success: true,
      session_status: sessionStatus
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