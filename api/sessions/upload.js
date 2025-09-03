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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const user = await verifyToken(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    const sessionData = req.body;

    // Basic validation
    if (!sessionData || typeof sessionData.total_putts !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid session data provided.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO sessions (player_id, total_putts, total_makes, total_misses, session_duration_seconds, best_streak, makes_per_minute, fastest_21_makes_seconds, putts_by_distance, makes_by_distance, details_by_distance, most_makes_in_60_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING session_id`,
      [user.playerId, sessionData.total_putts, sessionData.total_makes, sessionData.total_misses, sessionData.session_duration_seconds, sessionData.best_streak, sessionData.makes_per_minute, sessionData.fastest_21_makes_seconds, JSON.stringify(sessionData.putts_by_distance), JSON.stringify(sessionData.makes_by_distance), JSON.stringify(sessionData.details_by_distance), sessionData.most_makes_in_60_seconds]
    );

    const newSessionId = rows[0].session_id;

    return res.status(201).json({ success: true, message: 'Session uploaded successfully.', session_id: newSessionId });

  } catch (error) {
    console.error('Session upload API error:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
}