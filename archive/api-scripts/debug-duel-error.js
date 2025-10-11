import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== DUEL CREATION DEBUG ===');
    console.log('Method:', req.method);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    // Check auth
    const user = await verifyToken(req);
    console.log('User from token:', user);

    if (!user) {
      console.log('Auth failed - no valid token');
      return res.status(200).json({ 
        debug: true,
        error: 'Authentication failed',
        auth_header: req.headers.authorization ? 'Present' : 'Missing'
      });
    }

    // Check database connection
    const client = await pool.connect();
    console.log('Database connection successful');

    // Check if duels table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'duels'
      ) as table_exists
    `);
    console.log('Duels table exists:', tableCheck.rows[0].table_exists);

    if (!tableCheck.rows[0].table_exists) {
      client.release();
      return res.status(200).json({
        debug: true,
        error: 'Duels table does not exist',
        solution: 'Run the DUELS_LEAGUES_NEONDB_SETUP.sql script'
      });
    }

    // Try a simple insert
    const { creator_id, invited_player_id, settings } = req.body;
    console.log('Attempting insert with:', { creator_id, invited_player_id, settings });

    const result = await client.query(`
      INSERT INTO duels (challenger_id, challengee_id, status, rules)
      VALUES ($1, $2, 'pending', $3)
      RETURNING duel_id, challenger_id, challengee_id, status
    `, [creator_id, invited_player_id, settings || {}]);

    console.log('Insert successful:', result.rows[0]);
    client.release();

    return res.status(200).json({
      debug: true,
      success: true,
      duel: result.rows[0],
      message: 'Duel created successfully in debug mode'
    });

  } catch (error) {
    console.error('=== DUEL CREATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);

    return res.status(200).json({
      debug: true,
      success: false,
      error: error.message,
      error_code: error.code,
      error_detail: error.detail,
      error_constraint: error.constraint,
      full_error: error.toString()
    });
  }
}