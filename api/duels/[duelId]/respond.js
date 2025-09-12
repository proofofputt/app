import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
  const { player_id, response } = req.body;

  // Convert to integers to ensure consistent database types
  const duelIdInt = parseInt(duelId);
  const playerIdInt = parseInt(player_id);

  console.log('[DuelRespond] Request data:', {
    duelId,
    duelIdInt,
    player_id,
    playerIdInt,
    response,
    query: req.query,
    body: req.body
  });

  if (!duelId || !player_id || !response || isNaN(duelIdInt) || isNaN(playerIdInt)) {
    return res.status(400).json({ 
      success: false, 
      message: 'duelId, player_id, and response are required and must be valid numbers',
      received: { duelId, player_id, response, duelIdInt, playerIdInt }
    });
  }

  if (!['accepted', 'declined'].includes(response)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Response must be either "accepted" or "declined"' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get the duel and verify the player is the invited player
    const duelResult = await client.query(`
      SELECT 
        duel_id,
        duel_creator_id,
        duel_invited_player_id,
        status
      FROM duels 
      WHERE duel_id = $1
    `, [duelIdInt]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Duel not found' 
      });
    }

    const duel = duelResult.rows[0];

    // Verify the player is the invited player
    if (playerIdInt !== duel.duel_invited_player_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the invited player can respond to this duel' 
      });
    }

    // Verify the duel is in pending status
    if (duel.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot respond to duel with status: ${duel.status}` 
      });
    }

    // Handle response: accept or delete
    let result;
    if (response === 'accepted') {
      result = await client.query(`
        UPDATE duels 
        SET 
          status = 'active',
          accepted_at = NOW(),
          updated_at = NOW()
        WHERE duel_id = $1
        RETURNING duel_id, status, accepted_at
      `, [duelIdInt]);

      const updatedDuel = result.rows[0];
      return res.status(200).json({
        success: true,
        message: `Duel invitation ${response}`,
        duel: {
          duel_id: updatedDuel.duel_id,
          status: updatedDuel.status,
          accepted_at: updatedDuel.accepted_at
        }
      });
    } else {
      // For declined duels, delete them completely instead of marking as declined
      result = await client.query(`
        DELETE FROM duels 
        WHERE duel_id = $1
        RETURNING duel_id
      `, [duelIdInt]);

      return res.status(200).json({
        success: true,
        message: `Duel invitation ${response} and removed`,
        deleted: true,
        duel_id: duelIdInt
      });
    }

  } catch (error) {
    console.error('Duel respond error details:', {
      message: error.message,
      stack: error.stack,
      duelId,
      duelIdInt,
      player_id,
      playerIdInt,
      response
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to respond to duel',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        duelId,
        duelIdInt,
        player_id,
        playerIdInt,
        response
      } : undefined
    });
  } finally {
    if (client) client.release();
  }
}