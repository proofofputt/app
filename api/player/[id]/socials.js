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

  const { x_url, tiktok_url, telegram_url, website_url } = req.body;

  let client;
  try {
    client = await pool.connect();

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (x_url !== undefined) {
      updates.push(`x_url = $${paramIndex}`);
      values.push(x_url || null);
      paramIndex++;
    }

    if (tiktok_url !== undefined) {
      updates.push(`tiktok_url = $${paramIndex}`);
      values.push(tiktok_url || null);
      paramIndex++;
    }

    if (telegram_url !== undefined) {
      updates.push(`telegram_url = $${paramIndex}`);
      values.push(telegram_url || null);
      paramIndex++;
    }

    if (website_url !== undefined) {
      updates.push(`website_url = $${paramIndex}`);
      values.push(website_url || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No social fields to update provided' });
    }

    const query = `
      UPDATE players 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE player_id = $${paramIndex}
      RETURNING player_id, x_url, tiktok_url, telegram_url, website_url
    `;
    values.push(playerId);

    console.log(`[player/${id}/socials] Updating social links:`, { x_url, tiktok_url, telegram_url, website_url, playerId });
    
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const updatedSocials = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Social links updated successfully',
      socials: updatedSocials
    });

  } catch (error) {
    console.error(`[player/${id}/socials] Update error:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update social links',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}