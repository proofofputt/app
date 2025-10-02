import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { email, google_id, name } = req.body;

    if (!email || !google_id) {
      return res.status(400).json({
        success: false,
        message: 'Email and google_id are required'
      });
    }

    console.log(`[OAuth] Verifying Google user: ${email}`);

    // Check if user exists by email
    let user = await pool.query(
      'SELECT * FROM players WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      // Create new user account for OAuth user
      console.log(`[OAuth] Creating new user for: ${email}`);

      // Generate username from email
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const display_name = name || username;

      const insertResult = await pool.query(
        `INSERT INTO players (username, email, name, google_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING player_id, username, email, name, created_at`,
        [username, email, display_name, google_id]
      );

      user = insertResult;
    } else {
      // Update existing user with Google ID if not set
      const existingUser = user.rows[0];

      if (!existingUser.google_id) {
        await pool.query(
          'UPDATE players SET google_id = $1 WHERE player_id = $2',
          [google_id, existingUser.player_id]
        );
      }
    }

    const playerData = user.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        player_id: playerData.player_id,
        username: playerData.username,
        email: playerData.email
      },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    console.log(`[OAuth] Authentication successful for: ${playerData.username}`);

    return res.status(200).json({
      success: true,
      token: token,
      player: {
        player_id: playerData.player_id,
        username: playerData.username,
        email: playerData.email,
        name: playerData.name,
        display_name: playerData.name || playerData.username,
        created_at: playerData.created_at
      }
    });

  } catch (error) {
    console.error('Google OAuth verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify Google authentication'
    });
  }
}
