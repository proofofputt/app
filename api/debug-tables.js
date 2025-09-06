import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();
    
    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Check if we have any sessions data
    const sessionCount = await client.query('SELECT COUNT(*) FROM sessions');
    
    // Check if we have any players
    const playerCount = await client.query('SELECT COUNT(*) FROM players');
    
    return res.status(200).json({
      success: true,
      tables: tables,
      session_count: sessionCount.rows[0].count,
      player_count: playerCount.rows[0].count,
      database_url_set: !!process.env.DATABASE_URL
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      database_url_set: !!process.env.DATABASE_URL
    });
  } finally {
    if (client) client.release();
  }
}