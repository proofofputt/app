import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

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

  const { setupToken, displayName, provider } = req.body;

  try {
    // Verify setup token
    let payload;
    try {
      payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired setup token' });
    }

    if (payload.action !== 'setup_account') {
      return res.status(400).json({ success: false, message: 'Invalid setup request' });
    }

    const { email, googleId, picture, emailVerified } = payload;

    // Check if account was already created
    const existingPlayer = await pool.query(
      'SELECT * FROM players WHERE email = $1 OR google_id = $2',
      [email, googleId]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Account already exists'
      });
    }

    // Create new player account
    const insertResult = await pool.query(
      `INSERT INTO players (email, display_name, google_id, avatar_url, oauth_providers, oauth_profile, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        email,
        displayName,
        googleId,
        picture,
        JSON.stringify({ [provider]: true }),
        JSON.stringify({ [provider]: { name: displayName, picture, verified: emailVerified } })
      ]
    );

    const player = insertResult.rows[0];
    console.log(`[Auth] Created new player ${player.player_id} via OAuth account setup`);

    // Generate application JWT token
    const appToken = jwt.sign(
      {
        playerId: player.player_id,
        email: player.email,
        provider
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token: appToken,
      player: {
        playerId: player.player_id,
        email: player.email,
        displayName: player.display_name
      }
    });

  } catch (error) {
    console.error('Complete OAuth signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete account setup'
    });
  }
}
