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

/**
 * Score a completed duel between two sessions
 */
function scoreDuel(challengerSession, challengedSession, rules) {
  const scoring = rules.scoring_method || 'total_makes';
  
  let challengerScore, challengedScore;
  
  switch(scoring) {
    case 'total_makes':
      challengerScore = challengerSession.total_makes || 0;
      challengedScore = challengedSession.total_makes || 0;
      break;
    case 'make_percentage':
      challengerScore = challengerSession.make_percentage || 0;
      challengedScore = challengedSession.make_percentage || 0;
      break;
    case 'best_streak':
      challengerScore = challengerSession.best_streak || 0;
      challengedScore = challengedSession.best_streak || 0;
      break;
    case 'fastest_21':
      challengerScore = challengerSession.fastest_21_makes || 999999;
      challengedScore = challengedSession.fastest_21_makes || 999999;
      // For time-based, lower is better
      return challengerScore < challengedScore ? 'challenger' : 'challenged';
    default:
      challengerScore = challengerSession.total_makes || 0;
      challengedScore = challengedSession.total_makes || 0;
  }
  
  if (challengerScore === challengedScore) {
    return 'tie';
  }
  
  return challengerScore > challengedScore ? 'challenger' : 'challenged';
}

/**
 * Check if a duel has expired based on rules
 */
function isDuelExpired(duel) {
  if (!duel.rules?.time_limit_hours) return false;
  
  const createdAt = new Date(duel.created_at);
  const expiryTime = new Date(createdAt.getTime() + (duel.rules.time_limit_hours * 60 * 60 * 1000));
  
  return new Date() > expiryTime;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authentication required for all duel operations
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const client = await pool.connect();
  
  try {
    const playerId = parseInt(user.playerId);

    if (req.method === 'GET') {
      const { status, limit = 20, include_history = 'false' } = req.query;
      
      // Get player's duels
      let query = `
        SELECT 
          d.*,
          creator.display_name as creator_name,
          invited.display_name as invited_player_name,
          cs.data as creator_session_data,
          chs.data as invited_player_session_data
        FROM duels d
        LEFT JOIN users creator ON d.duel_creator_id = creator.id
        LEFT JOIN users invited ON d.duel_invited_player_id = invited.id
        LEFT JOIN sessions cs ON d.duel_creator_session_id = cs.session_id
        LEFT JOIN sessions chs ON d.duel_invited_player_session_id = chs.session_id
        WHERE d.duel_creator_id = $1 OR d.duel_invited_player_id = $1
      `;
      
      let queryParams = [playerId];
      
      if (status && status !== 'all') {
        query += ` AND d.status = $2`;
        queryParams.push(status);
      }
      
      if (include_history === 'false') {
        query += ` AND d.status != 'completed'`;
      }
      
      query += ` ORDER BY d.created_at DESC LIMIT $${queryParams.length + 1}`;
      queryParams.push(parseInt(limit));

      const result = await client.query(query, queryParams);
      
      const duels = result.rows.map(row => ({
        duel_id: row.duel_id,
        duel_creator_id: row.duel_creator_id,
        duel_invited_player_id: row.duel_invited_player_id,
        creator_name: row.creator_name || `Player ${row.duel_creator_id}`,
        invited_player_name: row.invited_player_name || `Player ${row.duel_invited_player_id}`,
        status: row.status,
        rules: row.rules,
        winner_id: row.winner_id,
        started_at: row.started_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
        is_creator: row.duel_creator_id === playerId,
        has_submitted: row.duel_creator_id === playerId ? !!row.duel_creator_session_id : !!row.duel_invited_player_session_id,
        opponent_submitted: row.duel_creator_id === playerId ? !!row.duel_invited_player_session_id : !!row.duel_creator_session_id,
        expired: isDuelExpired(row)
      }));

      return res.status(200).json({
        success: true,
        duels,
        total: duels.length
      });
    }

    if (req.method === 'POST') {
      const { invited_player_id, rules = {} } = req.body;
      
      if (!invited_player_id) {
        return res.status(400).json({ success: false, message: 'invited_player_id is required' });
      }
      
      if (invited_player_id === playerId) {
        return res.status(400).json({ success: false, message: 'Cannot challenge yourself' });
      }
      
      // Check if invited player exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [invited_player_id]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Invited player not found' });
      }
      
      // Set default rules
      const defaultRules = {
        duel_type: 'standard',
        time_limit_hours: 48,
        target_putts: 50,
        scoring_method: 'total_makes',
        handicap_enabled: false,
        entry_stakes: 0,
        auto_accept: false,
        ...rules
      };
      
      // Create duel
      const insertResult = await client.query(`
        INSERT INTO duels (duel_creator_id, duel_invited_player_id, status, rules, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING duel_id, created_at
      `, [playerId, invited_player_id, 'pending', JSON.stringify(defaultRules)]);
      
      const duelId = insertResult.rows[0].duel_id;
      
      return res.status(201).json({
        success: true,
        message: 'Duel challenge created successfully',
        duel: {
          duel_id: duelId,
          duel_creator_id: playerId,
          duel_invited_player_id: invited_player_id,
          status: 'pending',
          rules: defaultRules,
          created_at: insertResult.rows[0].created_at
        }
      });
    }

    if (req.method === 'PUT') {
      const { duelId } = req.query;
      const { action, session_id } = req.body;
      
      if (!duelId) {
        return res.status(400).json({ success: false, message: 'duelId is required' });
      }
      
      // Get duel details
      const duelResult = await client.query(`
        SELECT d.*, cs.data as creator_session_data, chs.data as invited_player_session_data
        FROM duels d
        LEFT JOIN sessions cs ON d.duel_creator_session_id = cs.session_id
        LEFT JOIN sessions chs ON d.duel_invited_player_session_id = chs.session_id
        WHERE d.duel_id = $1
      `, [duelId]);
      
      if (duelResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Duel not found' });
      }
      
      const duel = duelResult.rows[0];
      
      // Check if player is part of this duel
      if (duel.duel_creator_id !== playerId && duel.duel_invited_player_id !== playerId) {
        return res.status(403).json({ success: false, message: 'Not authorized for this duel' });
      }
      
      if (action === 'accept') {
        // Only invited player can accept
        if (duel.duel_invited_player_id !== playerId) {
          return res.status(403).json({ success: false, message: 'Only the invited player can accept' });
        }
        
        if (duel.status !== 'pending') {
          return res.status(400).json({ success: false, message: 'Duel is not in pending status' });
        }
        
        // Check if expired
        if (isDuelExpired(duel)) {
          await client.query('UPDATE duels SET status = $1, updated_at = NOW() WHERE duel_id = $2', ['cancelled', duelId]);
          return res.status(400).json({ success: false, message: 'Duel has expired' });
        }
        
        await client.query(`
          UPDATE duels SET status = $1, started_at = NOW(), updated_at = NOW() 
          WHERE duel_id = $2
        `, ['active', duelId]);
        
        return res.status(200).json({
          success: true,
          message: 'Duel accepted successfully',
          status: 'active'
        });
      }
      
      if (action === 'submit') {
        if (!session_id) {
          return res.status(400).json({ success: false, message: 'session_id is required for submission' });
        }
        
        if (duel.status !== 'active') {
          return res.status(400).json({ success: false, message: 'Duel is not active' });
        }
        
        // Verify session belongs to player and exists
        const sessionResult = await client.query(`
          SELECT session_id, data FROM sessions 
          WHERE session_id = $1 AND player_id = $2
        `, [session_id, playerId]);
        
        if (sessionResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Session not found or does not belong to player' });
        }
        
        const isCreator = duel.duel_creator_id === playerId;
        const sessionField = isCreator ? 'duel_creator_session_id' : 'duel_invited_player_session_id';
        
        // Check if player already submitted
        if (isCreator && duel.duel_creator_session_id || !isCreator && duel.duel_invited_player_session_id) {
          return res.status(400).json({ success: false, message: 'Session already submitted for this duel' });
        }
        
        // Update duel with session
        await client.query(`
          UPDATE duels SET ${sessionField} = $1, updated_at = NOW() 
          WHERE duel_id = $2
        `, [session_id, duelId]);
        
        // Check if both players have submitted
        const updatedDuelResult = await client.query(`
          SELECT d.*, cs.data as creator_session_data, chs.data as invited_player_session_data
          FROM duels d
          LEFT JOIN sessions cs ON d.duel_creator_session_id = cs.session_id
          LEFT JOIN sessions chs ON d.duel_invited_player_session_id = chs.session_id
          WHERE d.duel_id = $1
        `, [duelId]);
        
        const updatedDuel = updatedDuelResult.rows[0];
        
        if (updatedDuel.duel_creator_session_id && updatedDuel.duel_invited_player_session_id) {
          // Both submitted - score the duel
          const winner = scoreDuel(
            updatedDuel.creator_session_data,
            updatedDuel.invited_player_session_data,
            updatedDuel.rules
          );
          
          let winnerId = null;
          if (winner === 'challenger') winnerId = updatedDuel.duel_creator_id;
          else if (winner === 'challenged') winnerId = updatedDuel.duel_invited_player_id;
          // winnerId remains null for ties
          
          await client.query(`
            UPDATE duels SET status = $1, winner_id = $2, completed_at = NOW(), updated_at = NOW()
            WHERE duel_id = $3
          `, ['completed', winnerId, duelId]);
          
          return res.status(200).json({
            success: true,
            message: 'Duel completed successfully',
            status: 'completed',
            winner_id: winnerId,
            result: winner
          });
        } else {
          return res.status(200).json({
            success: true,
            message: 'Session submitted successfully, waiting for opponent',
            status: 'active'
          });
        }
      }
      
      if (action === 'expire') {
        // Mark duel as expired (can be called by automated system)
        if (duel.status === 'completed' || duel.status === 'cancelled') {
          return res.status(400).json({ success: false, message: 'Duel is already completed or cancelled' });
        }
        
        await client.query(`
          UPDATE duels SET status = $1, completed_at = NOW(), updated_at = NOW() 
          WHERE duel_id = $2
        `, ['expired', duelId]);
        
        return res.status(200).json({
          success: true,
          message: 'Duel marked as expired',
          status: 'expired'
        });
      }
      
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    if (req.method === 'DELETE') {
      const { duelId } = req.query;
      
      if (!duelId) {
        return res.status(400).json({ success: false, message: 'duelId is required' });
      }
      
      // Get duel details
      const duelResult = await client.query('SELECT * FROM duels WHERE duel_id = $1', [duelId]);
      
      if (duelResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Duel not found' });
      }
      
      const duel = duelResult.rows[0];
      
      // Check if player can cancel this duel
      if (duel.duel_creator_id !== playerId && duel.duel_invited_player_id !== playerId) {
        return res.status(403).json({ success: false, message: 'Not authorized for this duel' });
      }
      
      // Can only cancel pending or active duels
      if (!['pending', 'active'].includes(duel.status)) {
        return res.status(400).json({ success: false, message: 'Cannot cancel completed duel' });
      }
      
      await client.query(`
        UPDATE duels SET status = $1, updated_at = NOW() WHERE duel_id = $2
      `, ['cancelled', duelId]);
      
      return res.status(200).json({
        success: true,
        message: 'Duel cancelled successfully'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
    
  } catch (error) {
    console.error('[duels-v2] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}