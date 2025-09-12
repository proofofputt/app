import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { id } = req.query;
  const playerId = parseInt(id);

  // Verify user can update this player
  if (user.playerId !== playerId) {
    return res.status(403).json({ success: false, message: 'Unauthorized to update this player' });
  }

  const { name, phone, timezone } = req.body;

  let client;
  try {
    client = await pool.connect();

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      values.push(timezone);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update provided' });
    }

    const query = `
      UPDATE players 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE player_id = $${paramIndex}
      RETURNING player_id, name, phone, email, timezone, membership_tier
    `;
    values.push(playerId);

    console.log(`[player/${id}] Updating player:`, { name, phone, timezone, playerId });
    
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const updatedPlayer = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Player updated successfully',
      player: updatedPlayer
    });

  } catch (error) {
    console.error(`[player/${id}] Update error:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update player',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}