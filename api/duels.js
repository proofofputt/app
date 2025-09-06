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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGetDuels(req, res);
  } else if (req.method === 'POST') {
    return handleCreateDuel(req, res);
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

}

async function handleGetDuels(req, res) {
  let client;
  try {
    client = await pool.connect();
    console.log('Duels API: Database connected successfully');

    const { player_id } = req.query;

    if (!player_id) {
      return res.status(400).json({ success: false, message: 'player_id is required' });
    }

    // Get duels where player is involved (as challenger or challengee)
    const duelsResult = await client.query(`
      SELECT 
        d.duel_id,
        d.challenger_id,
        d.challengee_id,
        d.status,
        d.settings,
        d.created_at,
        d.expires_at,
        challenger.name as challenger_name,
        challengee.name as challengee_name,
        cs.session_id as challenger_session_id,
        ces.session_id as challengee_session_id,
        cs.data as challenger_session_data,
        ces.data as challengee_session_data
      FROM duels d
      JOIN players challenger ON d.challenger_id = challenger.player_id
      JOIN players challengee ON d.challengee_id = challengee.player_id
      LEFT JOIN sessions cs ON d.challenger_session_id = cs.session_id
      LEFT JOIN sessions ces ON d.challengee_session_id = ces.session_id
      WHERE d.challenger_id = $1 OR d.challengee_id = $1
      ORDER BY d.created_at DESC
    `, [player_id]);

    const duels = duelsResult.rows.map(duel => ({
      duel_id: duel.duel_id,
      challenger_id: duel.challenger_id,
      challengee_id: duel.challengee_id,
      challenger_name: duel.challenger_name,
      challengee_name: duel.challengee_name,
      status: duel.status,
      settings: duel.settings,
      created_at: duel.created_at,
      expires_at: duel.expires_at,
      challenger_session: duel.challenger_session_id ? {
        session_id: duel.challenger_session_id,
        ...duel.challenger_session_data
      } : null,
      challengee_session: duel.challengee_session_id ? {
        session_id: duel.challengee_session_id,
        ...duel.challengee_session_data
      } : null,
      is_challenger: parseInt(player_id) === duel.challenger_id,
      is_challengee: parseInt(player_id) === duel.challengee_id
    }));

    return res.status(200).json({
      success: true,
      duels: duels
    });

  } catch (error) {
    console.error('Duels API error:', error);
    
    // Always return expected structure for GET requests
    return res.status(200).json({
      success: false,
      message: 'Failed to load duels',
      duels: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}

async function handleCreateDuel(req, res) {
  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { challenger_id, challengee_id, rules } = req.body;

  if (!challenger_id || !challengee_id) {
    return res.status(400).json({ 
      success: false, 
      message: 'challenger_id and challengee_id are required' 
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Insert new duel
    const duelResult = await client.query(`
      INSERT INTO duels (challenger_id, challengee_id, status, rules, created_at)
      VALUES ($1, $2, 'pending', $3, NOW())
      RETURNING duel_id, challenger_id, challengee_id, status, rules, created_at
    `, [challenger_id, challengee_id, rules || {}]);

    const duel = duelResult.rows[0];

    // Get challenger and challengee names
    const playersResult = await client.query(`
      SELECT player_id, name FROM players WHERE player_id IN ($1, $2)
    `, [challenger_id, challengee_id]);

    const players = {};
    playersResult.rows.forEach(p => {
      players[p.player_id] = p.name;
    });

    return res.status(201).json({
      success: true,
      duel: {
        ...duel,
        challenger_name: players[challenger_id],
        challengee_name: players[challengee_id]
      }
    });

  } catch (error) {
    console.error('Create duel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create duel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}