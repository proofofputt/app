import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { duelId } = req.query;
  const { player_id, session_id } = req.body;

  if (!duelId || !player_id || !session_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'duelId, player_id, and session_id are required' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get the duel and verify the player is a participant
    const duelResult = await client.query(`
      SELECT 
        duel_id,
        duel_creator_id,
        duel_invited_player_id,
        status,
        duel_creator_session_id,
        duel_invited_player_session_id
      FROM duels 
      WHERE duel_id = $1
    `, [duelId]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Duel not found' 
      });
    }

    const duel = duelResult.rows[0];
    const isCreator = parseInt(player_id) === duel.duel_creator_id;
    const isInvitedPlayer = parseInt(player_id) === duel.duel_invited_player_id;

    // Verify the player is a participant
    if (!isCreator && !isInvitedPlayer) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only duel participants can submit sessions' 
      });
    }

    // Verify the duel is active
    if (duel.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot submit session to duel with status: ${duel.status}` 
      });
    }

    // Check if player has already submitted
    if ((isCreator && duel.duel_creator_session_id) || (isInvitedPlayer && duel.duel_invited_player_session_id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Player has already submitted a session for this duel' 
      });
    }

    // Get session data
    const sessionResult = await client.query(`
      SELECT 
        session_id,
        player_id,
        data,
        created_at
      FROM sessions 
      WHERE session_id = $1 AND player_id = $2
    `, [session_id, player_id]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found or does not belong to player' 
      });
    }

    const session = sessionResult.rows[0];
    const sessionData = session.data || {};

    // Extract key metrics from session data
    const score = sessionData.total_makes || 0;

    // Update the duel with session submission
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (isCreator) {
      updateFields.push(`duel_creator_session_id = $${paramCount++}`);
      updateFields.push(`duel_creator_session_data = $${paramCount++}`);
      updateFields.push(`duel_creator_score = $${paramCount++}`);
      updateValues.push(session_id, sessionData, score);
    } else {
      updateFields.push(`duel_invited_player_session_id = $${paramCount++}`);
      updateFields.push(`duel_invited_player_session_data = $${paramCount++}`);
      updateFields.push(`duel_invited_player_score = $${paramCount++}`);
      updateValues.push(session_id, sessionData, score);
    }

    updateValues.push(duelId);

    const updateQuery = `
      UPDATE duels 
      SET 
        ${updateFields.join(', ')},
        updated_at = NOW()
      WHERE duel_id = $${paramCount}
      RETURNING 
        duel_id, 
        status,
        duel_creator_session_id,
        duel_invited_player_session_id,
        duel_creator_score,
        duel_invited_player_score
    `;

    const updateResult = await client.query(updateQuery, updateValues);
    const updatedDuel = updateResult.rows[0];

    // Check if both players have submitted and determine winner
    if (updatedDuel.duel_creator_session_id && updatedDuel.duel_invited_player_session_id) {
      let winnerId = null;
      
      // Determine winner based on score (higher score wins)
      if (updatedDuel.duel_creator_score > updatedDuel.duel_invited_player_score) {
        winnerId = duel.duel_creator_id;
      } else if (updatedDuel.duel_invited_player_score > updatedDuel.duel_creator_score) {
        winnerId = duel.duel_invited_player_id;
      }
      // If scores are equal, winnerId remains null (tie)

      // Update duel to completed status
      await client.query(`
        UPDATE duels 
        SET 
          status = 'completed',
          winner_id = $1,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE duel_id = $2
      `, [winnerId, duelId]);
    }

    return res.status(200).json({
      success: true,
      message: 'Session submitted successfully',
      duel: {
        duel_id: updatedDuel.duel_id,
        status: updatedDuel.duel_creator_session_id && updatedDuel.duel_invited_player_session_id ? 'completed' : 'active',
        creator_score: updatedDuel.duel_creator_score,
        invited_player_score: updatedDuel.duel_invited_player_score,
        player_submitted: isCreator ? 'creator' : 'invited_player'
      }
    });

  } catch (error) {
    console.error('Duel session submit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit session to duel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}