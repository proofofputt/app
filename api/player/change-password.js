import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
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

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { old_password, new_password } = req.body;
    const { playerId } = user;

    if (!old_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Old and new passwords are required.' });
    }

    const client = await pool.connect();
    try {
      // Get the player's current password hash
      const playerQuery = await client.query('SELECT password_hash FROM players WHERE player_id = $1', [playerId]);
      if (playerQuery.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Player not found.' });
      }

      const { password_hash } = playerQuery.rows[0];

      // Compare the old password with the stored hash
      const isMatch = await bcrypt.compare(old_password, password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect old password.' });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(new_password, salt);

      // Update the player's password in the database
      await client.query('UPDATE players SET password_hash = $1 WHERE player_id = $2', [newPasswordHash, playerId]);

      return res.status(200).json({ success: true, message: 'Password changed successfully.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
}
