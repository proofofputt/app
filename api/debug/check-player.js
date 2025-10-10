import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../utils/cors.js';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    client = await pool.connect();

    // Check if player exists - using only guaranteed columns
    const playerCheck = await client.query(`
      SELECT player_id, name, email, created_at
      FROM players
      WHERE player_id = $1
    `, [user.playerId]);

    // Check database info
    const dbInfo = await client.query(`
      SELECT current_database(), current_schema()
    `);

    // Count total players
    const playerCount = await client.query(`
      SELECT COUNT(*) as total FROM players
    `);

    // Check for any leagues created by this player
    const existingLeagues = await client.query(`
      SELECT league_id, name, created_by, created_at
      FROM leagues
      WHERE created_by = $1
      LIMIT 5
    `, [user.playerId]);

    return res.status(200).json({
      success: true,
      jwt_payload: user,
      player_exists: playerCheck.rows.length > 0,
      player_data: playerCheck.rows[0] || null,
      database: dbInfo.rows[0],
      total_players: parseInt(playerCount.rows[0].total),
      existing_leagues: existingLeagues.rows,
      diagnosis: {
        can_create_league: playerCheck.rows.length > 0,
        reason: playerCheck.rows.length === 0
          ? 'Player not found in database'
          : 'Player exists, should be able to create league'
      }
    });

  } catch (error) {
    console.error('Debug check-player error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
