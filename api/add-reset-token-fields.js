import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  
  try {
    // Add reset token fields to players table if they don't exist
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `);

    // Create index for faster token lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_reset_token 
      ON players(reset_token) 
      WHERE reset_token IS NOT NULL
    `);

    return res.status(200).json({ 
      success: true,
      message: 'Reset token fields added successfully' 
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      error: 'Failed to add reset token fields',
      details: error.message 
    });
  } finally {
    client.release();
  }
}