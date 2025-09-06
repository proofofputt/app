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
    
    // Check duels table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      ORDER BY ordinal_position
    `);
    
    // Check if duels table exists and has any data
    const duelCount = await client.query('SELECT COUNT(*) as count FROM duels');
    
    // Sample duel if any exist
    const sampleDuel = await client.query('SELECT * FROM duels LIMIT 1');
    
    return res.status(200).json({
      success: true,
      table_structure: tableInfo.rows,
      duel_count: duelCount.rows[0].count,
      sample_duel: sampleDuel.rows[0] || null
    });
    
  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message,
      hint: "Duels table might not exist"
    });
  } finally {
    if (client) client.release();
  }
}