import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate password strength (at least 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate username (alphanumeric and underscores only, 3-20 characters)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
  }

  const client = await pool.connect();
  
  try {

    // Check if email already exists
    const existingEmail = await client.query(
      'SELECT player_id FROM players WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if username already exists
    const existingUsername = await client.query(
      'SELECT player_id FROM players WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new player
    const result = await client.query(
      `INSERT INTO players (
        email, 
        password, 
        username, 
        created_at,
        subscription_tier,
        handicap,
        role
      )
      VALUES ($1, $2, $3, NOW(), 'free', 0, 'user')
      RETURNING player_id, email, username, subscription_tier, role`,
      [email, hashedPassword, username]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const player = result.rows[0];

    // Initialize player stats
    await client.query(
      `INSERT INTO stats (
        player_id,
        total_sessions,
        total_putts,
        total_makes,
        total_misses,
        best_streak,
        make_percentage,
        most_makes_in_60s,
        fastest_21_makes,
        created_at
      )
      VALUES ($1, 0, 0, 0, 0, 0, 0, 0, NULL, NOW())
      ON CONFLICT (player_id) DO NOTHING`,
      [player.player_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        playerId: player.player_id,
        email: player.email,
        username: player.username,
        role: player.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token,
      player: {
        player_id: player.player_id,
        email: player.email,
        username: player.username,
        subscription_tier: player.subscription_tier,
        role: player.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Failed to register. Please try again later.' 
    });
  } finally {
    client.release();
  }
}