import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const client = await pool.connect();

  try {
    // Add is_admin column if it doesn't exist
    await client.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
    `);

    // Create index for admin user lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_admin ON players(is_admin) WHERE is_admin = true;
    `);

    // Set the user as admin
    const result = await client.query(
      'UPDATE players SET is_admin = true WHERE LOWER(email) = LOWER($1) RETURNING player_id, name, email, is_admin',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found with that email'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin role granted successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Setup admin role error:', error);
    return res.status(500).json({
      error: 'Failed to setup admin role',
      details: error.message
    });
  } finally {
    client.release();
  }
}
