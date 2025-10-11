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
    // Check duels table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      ORDER BY ordinal_position
    `);
    
    const columns = columnsResult.rows;
    console.log('Duels table columns:', columns);
    
    // Check if duels table has any data
    const countResult = await client.query('SELECT COUNT(*) as count FROM duels');
    const count = countResult.rows[0].count;
    
    // Try a simple select to see what fails
    let queryError = null;
    let queryResult = null;
    
    try {
      const testResult = await client.query(`
        SELECT duel_id, duel_creator_id, duel_invited_player_id, status, created_at 
        FROM duels 
        LIMIT 1
      `);
      queryResult = testResult.rows;
    } catch (error) {
      queryError = error.message;
    }

    return res.status(200).json({ 
      success: true,
      schema: {
        columns: columns,
        recordCount: count,
        queryError: queryError,
        sampleData: queryResult
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    return res.status(500).json({ 
      error: 'Failed to debug duels schema',
      details: error.message 
    });
  } finally {
    client.release();
  }
}