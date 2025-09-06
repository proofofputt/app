import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { term, exclude_player_id } = req.query;

  if (!term) {
    return res.status(400).json({ success: false, message: 'Search term is required' });
  }

  // Prevent very short search terms to avoid performance issues
  if (term.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'Search term must be at least 2 characters long' 
    });
  }

  const client = await pool.connect();
  
  try {
    let query = `
      SELECT 
        player_id,
        email,
        email AS name,
        membership_tier
      FROM players 
      WHERE (email ILIKE $1 OR email ILIKE $2)
    `;
    
    let params = [`%${term}%`, `${term}%`];
    let paramIndex = 3;

    // Exclude specific player if provided (e.g., don't show self in results)
    if (exclude_player_id) {
      query += ` AND player_id != $${paramIndex}`;
      params.push(parseInt(exclude_player_id));
      paramIndex++;
    }

    // Limit results to prevent performance issues
    query += ` ORDER BY 
      CASE 
        WHEN email = $${paramIndex} THEN 1  -- Exact match first
        WHEN email ILIKE $${paramIndex + 1} THEN 2  -- Starts with term
        ELSE 3  -- Contains term
      END
      LIMIT 10`;
    
    params.push(term, `${term}%`);

    console.log(`[players/search] Searching for term: "${term}", exclude: ${exclude_player_id}`);
    const result = await client.query(query, params);

    // Format results for frontend
    const players = result.rows.map(row => ({
      player_id: row.player_id,
      name: row.email.split('@')[0], // Use email prefix as display name
      email: row.email,
      membership_tier: row.membership_tier || 'free'
    }));

    console.log(`[players/search] Found ${players.length} players`);
    
    return res.status(200).json({
      success: true,
      players,
      total: players.length
    });

  } catch (error) {
    console.error('[players/search] Error:', error);
    
    // If it's a database connection error, return empty results instead of crashing
    if (error.message.includes('connect') || error.message.includes('database')) {
      console.log('[players/search] Database connection error, returning empty results');
      return res.status(200).json({
        success: true,
        players: [],
        total: 0,
        message: 'Search service temporarily unavailable'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}