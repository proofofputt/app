import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

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
    // Check if the search term is a complete email address
    const isCompleteEmail = term.includes('@') && term.includes('.') && term.indexOf('@') < term.lastIndexOf('.');
    
    // Check if the search term looks like a phone number (contains only digits, spaces, +, -, (, ))
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    const isPhoneSearch = phoneRegex.test(term) && term.replace(/[\D]/g, '').length >= 10;
    
    let query = `
      SELECT 
        player_id,
        name,
        email,
        phone,
        membership_tier
      FROM players 
      WHERE (name ILIKE $1 OR name ILIKE $2 OR email ILIKE $3 OR email ILIKE $4 OR phone ILIKE $5 OR phone ILIKE $6)
    `;
    
    let params = [`%${term}%`, `${term}%`, `%${term}%`, `${term}%`, `%${term}%`, `${term}%`];
    let paramIndex = 7;

    // Exclude specific player if provided (e.g., don't show self in results)
    if (exclude_player_id) {
      query += ` AND player_id != $${paramIndex}`;
      params.push(parseInt(exclude_player_id));
      paramIndex++;
    }

    // Limit results to prevent performance issues
    query += ` ORDER BY 
      CASE 
        WHEN name = $${paramIndex} THEN 1  -- Exact name match first
        WHEN email = $${paramIndex + 1} THEN 2  -- Exact email match
        WHEN phone = $${paramIndex + 2} THEN 3  -- Exact phone match
        WHEN name ILIKE $${paramIndex + 3} THEN 4  -- Name starts with term
        WHEN email ILIKE $${paramIndex + 4} THEN 5  -- Email starts with term
        WHEN phone ILIKE $${paramIndex + 5} THEN 6  -- Phone starts with term
        ELSE 7  -- Contains term
      END
      LIMIT 10`;
    
    params.push(term, term, term, `${term}%`, `${term}%`, `${term}%`);

    console.log(`[players/search] Searching for term: "${term}", exclude: ${exclude_player_id}, isCompleteEmail: ${isCompleteEmail}, isPhoneSearch: ${isPhoneSearch}`);
    const result = await client.query(query, params);

    // Format results for frontend
    const players = result.rows.map(row => {
      // Only show email if the search term was a complete email address
      const displayName = row.name || row.email.split('@')[0];
      const shouldShowEmail = isCompleteEmail;
      
      // Only show phone if there's an exact match with the phone number
      const shouldShowPhone = row.phone && row.phone === term;
      
      return {
        player_id: row.player_id,
        name: displayName,
        email: shouldShowEmail ? row.email : undefined,
        phone: shouldShowPhone ? row.phone : undefined,
        membership_tier: row.membership_tier || 'free'
      };
    });

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