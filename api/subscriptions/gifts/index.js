import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';

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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // Support different ID field names in JWT
  const userId = user.playerId || user.userId || user.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      debug: process.env.NODE_ENV === 'development' ? 'No user ID found in token' : undefined
    });
  }

  try {

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
