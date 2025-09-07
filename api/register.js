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

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
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

  // Validate name (reasonable length)
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
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

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new player matching the production schema
    const result = await client.query(
      `INSERT INTO players (
        name,
        email, 
        password_hash, 
        membership_tier,
        subscription_status,
        timezone,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'basic', 'active', 'America/New_York', NOW(), NOW())
      RETURNING player_id, name, email, membership_tier, subscription_status, timezone`,
      [name, email, hashedPassword]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const player = result.rows[0];

    // Initialize player stats (using player_stats table like login.js expects)
    await client.query(
      `INSERT INTO player_stats (
        player_id,
        total_sessions,
        total_putts,
        total_makes,
        total_misses,
        make_percentage,
        best_streak,
        created_at,
        updated_at
      )
      VALUES ($1, 0, 0, 0, 0, 0.0, 0, NOW(), NOW())
      ON CONFLICT (player_id) DO NOTHING`,
      [player.player_id]
    );

    // Generate JWT token (matching login.js format)
    const token = jwt.sign(
      { 
        playerId: player.player_id,
        email: player.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Generate username from email like login.js does
    const username = player.email.split('@')[0];

    return res.status(201).json({
      success: true,
      token,
      player: {
        player_id: player.player_id,
        email: player.email,
        name: player.name,
        username: username, // Derived from email
        membership_tier: player.membership_tier,
        subscription_status: player.subscription_status,
        timezone: player.timezone
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