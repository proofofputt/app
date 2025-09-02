import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Initialize the database pool. It will automatically use the DATABASE_URL
// environment variable when deployed on a platform like Vercel.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests (e.g., from desktop app)
  res.setHeader('Access-Control-Allow-Origin', '*'); // More restrictive in production if possible
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  try {
    // 1. Find the user by email
    // The 'username' column was removed from the query as it does not exist in the current schema.
    const userQuery = await pool.query('SELECT player_id, email, password_hash FROM players WHERE email = $1', [email]);
    const player = userQuery.rows[0];

    if (!player) {
      console.log(`Login attempt failed: No user found for email ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, player.password_hash);

    if (!isMatch) {
      console.log(`Login attempt failed: Incorrect password for email ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 3. Passwords match, generate a JWT
    if (!process.env.JWT_SECRET) {
      // This is a server-side configuration error, so we'll log it and throw.
      console.error('FATAL: JWT_SECRET environment variable is not set.');
      throw new Error('Server configuration error: JWT secret is missing.');
    }

    const token = jwt.sign({ playerId: player.player_id, email: player.email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // 4. Prepare player data for the response.
    // We derive a temporary username from the email to satisfy the client-side code.
    // TODO: Consider adding a dedicated 'username' column to the 'players' table.
    const username = player.email.split('@')[0];
    const playerResponseData = {
      player_id: player.player_id,
      email: player.email,
      username: username,
      name: username, // The client also expects a "name" property.
    };

    console.log(`Login successful for player_id: ${player.player_id}`);
    return res.status(200).json({
      success: true,
      token: token,
      player: playerResponseData,
    });
  } catch (error) {
    console.error('Server error during login:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
}