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
        challenger.display_name as challenger_name,
        challenged.display_name as challenged_name,
        cs.data as challenger_session_data,
        chs.data as challenged_session_data,
        cs.created_at as challenger_session_uploaded_at,
        chs.created_at as challenged_session_uploaded_at
      FROM duels d
      LEFT JOIN users challenger ON d.challenger_id = challenger.id
      LEFT JOIN users challenged ON d.challenged_id = challenged.id
      LEFT JOIN sessions cs ON d.challenger_session_id = cs.session_id
      LEFT JOIN sessions chs ON d.challenged_session_id = chs.session_id
      WHERE d.duel_id = $1 AND (d.challenger_id = $2 OR d.challenged_id = $2)
    `, [duelId, playerId]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Duel not found or access denied' });
    }

    const duel = duelResult.rows[0];
    const isChallenger = duel.challenger_id === playerId;

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
      challenger_id: duel.challenger_id,
      challenged_id: duel.challenged_id,
      challenger_name: duel.challenger_name || `Player ${duel.challenger_id}`,
      challenged_name: duel.challenged_name || `Player ${duel.challenged_id}`,
      is_challenger: isChallenger,
      rules: duel.rules,
      
      // Time information
      time_limit_hours: duel.rules?.time_limit_hours || null,
      time_remaining_minutes: timeRemaining,
      is_expired: isExpired,
      created_at: duel.created_at,
      started_at: duel.started_at,
      completed_at: duel.completed_at,
      
      // Session submission status
      challenger_session_submitted: !!duel.challenger_session_id,
      challenged_session_submitted: !!duel.challenged_session_id,
      challenger_session_uploaded_at: duel.challenger_session_uploaded_at,
      challenged_session_uploaded_at: duel.challenged_session_uploaded_at,
      
      // Player-specific status
      my_session_submitted: isChallenger ? !!duel.challenger_session_id : !!duel.challenged_session_id,
      opponent_session_submitted: isChallenger ? !!duel.challenged_session_id : !!duel.challenger_session_id,
      
      // Results (if completed)
      winner_id: duel.winner_id,
      is_winner: duel.winner_id === playerId,
      is_tie: duel.status === 'completed' && !duel.winner_id
    };

    // Add basic session stats if available (without full session data for performance)
    if (duel.challenger_session_data) {
      const challengerStats = duel.challenger_session_data;
      sessionStatus.challenger_stats = {
        total_putts: challengerStats.total_putts || 0,
        total_makes: challengerStats.total_makes || 0,
        make_percentage: challengerStats.make_percentage || 0,
        best_streak: challengerStats.best_streak || 0,
        session_duration: challengerStats.session_duration || challengerStats.session_duration_seconds || 0
      };
    }

    if (duel.challenged_session_data) {
      const challengedStats = duel.challenged_session_data;
      sessionStatus.challenged_stats = {
        total_putts: challengedStats.total_putts || 0,
        total_makes: challengedStats.total_makes || 0,
        make_percentage: challengedStats.make_percentage || 0,
        best_streak: challengedStats.best_streak || 0,
        session_duration: challengedStats.session_duration || challengedStats.session_duration_seconds || 0
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