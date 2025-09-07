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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  if (!duelId || !player_id || !response) {
    return res.status(400).json({ 
      success: false, 
      message: 'duelId, player_id, and response are required' 
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
    `, [duelId]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Duel not found' 
      });
    }

    const duel = duelResult.rows[0];

    // Verify the player is the invited player
    if (parseInt(player_id) !== duel.duel_invited_player_id) {
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

    // Update the duel status
    const newStatus = response === 'accepted' ? 'active' : 'declined';
    const updateResult = await client.query(`
      UPDATE duels 
      SET 
        status = $1,
        accepted_at = CASE WHEN $1 = 'active' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE duel_id = $2
      RETURNING duel_id, status, accepted_at
    `, [newStatus, duelId]);

    const updatedDuel = updateResult.rows[0];

    return res.status(200).json({
      success: true,
      message: `Duel invitation ${response}`,
      duel: {
        duel_id: updatedDuel.duel_id,
        status: updatedDuel.status,
        accepted_at: updatedDuel.accepted_at
      }
    });

  } catch (error) {
    console.error('Duel respond error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to respond to duel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}