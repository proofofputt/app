import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get session token from auth header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify token and get user ID from sessions table
    const sessionResult = await pool.query(
      'SELECT player_id FROM sessions WHERE token = $1',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    const userId = sessionResult.rows[0].player_id;

    // Get all gift codes owned by this user
    const giftCodesResult = await pool.query(
      `SELECT id, gift_code, is_redeemed, redeemed_by_user_id, redeemed_at, created_at
       FROM user_gift_subscriptions
       WHERE owner_user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      giftCodes: giftCodesResult.rows
    });

  } catch (error) {
    console.error('Error fetching gift codes:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
