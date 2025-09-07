import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Simple test - just check if we can query players table
    const result = await client.query('SELECT player_id, name FROM players LIMIT 5');
    
    client.release();
    
    return res.status(200).json({
      success: true,
      message: "Database connection works",
      players: result.rows
    });

  } catch (error) {
    if (client) client.release();
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}