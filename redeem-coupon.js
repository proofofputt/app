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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // Verify the JWT from the Authorization header
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    const { playerId } = req.query;
    const { coupon_code } = req.body;

    if (parseInt(user.playerId, 10) !== parseInt(playerId, 10)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!coupon_code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const client = await pool.connect();
    const couponResult = await client.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [coupon_code]);
    const coupon = couponResult.rows[0];

    if (!coupon || (coupon.redemption_limit !== null && coupon.times_redeemed >= coupon.redemption_limit)) {
      client.release();
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    await client.query("UPDATE players SET membership_tier = 'regular' WHERE player_id = $1", [playerId]);
    await client.query('UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE coupon_id = $1', [coupon.coupon_id]);
    client.release();

    return res.status(200).json({ success: true, message: 'Coupon redeemed successfully! You now have full access.' });
  } catch (error) {
    console.error('Coupon redemption error:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
  }
}