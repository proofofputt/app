import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    
    // Test player lookup
    const playerResult = await client.query(
      'SELECT player_id, name, email FROM players WHERE player_id = 1'
    );

    client.release();

    return res.status(200).json({
      success: true,
      player_found: playerResult.rows.length > 0,
      player_data: playerResult.rows[0] || null,
      message: "Player lookup test"
    });

  } catch (error) {
    console.error('Player lookup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Player lookup failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}