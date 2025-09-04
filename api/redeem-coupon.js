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
    const { player_id, coupon_code } = req.body;

    if (!player_id || !coupon_code) {
      return res.status(400).json({ success: false, message: 'Player ID and coupon code are required.' });
    }

    // For early access coupons, allow redemption with relaxed authentication
    const isEarlyAccessCoupon = ['EARLY', 'BETA', 'POP123'].includes(coupon_code.toUpperCase());
    
    if (!isEarlyAccessCoupon) {
      // For non-early-access coupons, require strict JWT authentication
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication failed' });
      }

      if (parseInt(user.playerId, 10) !== parseInt(player_id, 10)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    const client = await pool.connect();
    try {
      // For early access coupons, verify the player exists in the database
      if (isEarlyAccessCoupon) {
        const playerCheck = await client.query('SELECT player_id FROM players WHERE player_id = $1', [player_id]);
        if (playerCheck.rows.length === 0) {
          return res.status(400).json({ success: false, message: 'Invalid player ID' });
        }
      }

      console.log(`🎫 Attempting to redeem coupon: "${coupon_code}" for player ${player_id}`);
      
      // Check if coupon exists and is valid
      const couponResult = await client.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [coupon_code]);
      const coupon = couponResult.rows[0];

      console.log(`🎫 Coupon query result:`, coupon ? { 
        code: coupon.code, 
        times_redeemed: coupon.times_redeemed, 
        redemption_limit: coupon.redemption_limit,
        is_active: coupon.is_active 
      } : 'No coupon found');

      if (!coupon) {
        // Check if coupons table exists and has any data
        const allCouponsResult = await client.query('SELECT code FROM coupons LIMIT 5');
        console.log(`🎫 Available coupon codes:`, allCouponsResult.rows.map(row => row.code));
        return res.status(400).json({ 
          success: false, 
          message: `Coupon code "${coupon_code}" not found. Available codes: ${allCouponsResult.rows.map(row => row.code).join(', ') || 'None'}` 
        });
      }

      if (coupon.redemption_limit !== null && coupon.times_redeemed >= coupon.redemption_limit) {
        return res.status(400).json({ success: false, message: 'Coupon has reached its redemption limit.' });
      }

      // Update player membership tier
      await client.query("UPDATE players SET membership_tier = 'regular' WHERE player_id = $1", [player_id]);
      
      // Increment coupon redemption count
      await client.query('UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE coupon_id = $1', [coupon.coupon_id]);

      return res.status(200).json({ success: true, message: 'Coupon redeemed successfully! You now have full access.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Coupon redemption error:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
  }
}