import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('Test duel creation - Raw body:', req.body);
  console.log('Test duel creation - Headers:', req.headers);
  
  // Test auth
  const user = await verifyToken(req);
  console.log('Test duel creation - User:', user);
  
  if (!user) {
    return res.status(200).json({ 
      debug: true,
      auth_failed: true, 
      message: 'No valid auth token' 
    });
  }

  const { creator_id, invited_player_id, settings } = req.body;
  console.log('Test duel creation - Extracted params:', { creator_id, invited_player_id, settings });

  if (!creator_id || !invited_player_id) {
    return res.status(200).json({
      debug: true,
      missing_params: true,
      received: { creator_id, invited_player_id, settings },
      message: 'Missing required parameters'
    });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('Test duel creation - DB connected');
    
    // Test table exists
    const tableCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'duels' 
      ORDER BY ordinal_position
    `);
    console.log('Test duel creation - Table columns:', tableCheck.rows);

    // Test the actual insert that's failing
    const duelResult = await client.query(`
      INSERT INTO duels (challenger_id, challengee_id, status, rules, created_at)
      VALUES ($1, $2, 'pending', $3, NOW())
      RETURNING duel_id, challenger_id, challengee_id, status, rules, created_at
    `, [creator_id, invited_player_id, settings || {}]);
    
    console.log('Test duel creation - Insert successful:', duelResult.rows[0]);
    
    return res.status(200).json({
      debug: true,
      success: true,
      duel: duelResult.rows[0],
      table_columns: tableCheck.rows
    });

  } catch (error) {
    console.error('Test duel creation - Error:', error);
    return res.status(200).json({
      debug: true,
      success: false,
      error: error.message,
      error_code: error.code,
      error_detail: error.detail,
      error_constraint: error.constraint
    });
  } finally {
    if (client) client.release();
  }
}