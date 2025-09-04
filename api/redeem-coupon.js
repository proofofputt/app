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

    // Check if it's the early access coupon (case-insensitive)
    const isEarlyAccessCoupon = coupon_code.toLowerCase() === 'early';
    
    if (!isEarlyAccessCoupon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid coupon code.' 
      });
    }

    const client = await pool.connect();
    try {
      // Verify the player exists in the database
      const playerCheck = await client.query('SELECT player_id, membership_tier FROM players WHERE player_id = $1', [player_id]);
      if (playerCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid player ID' });
      }

      const currentPlayer = playerCheck.rows[0];
      console.log(`🎫 Attempting to redeem coupon: "${coupon_code}" for player ${player_id}. Current tier: ${currentPlayer.membership_tier}`);
      
      // Check if user is already upgraded
      if (currentPlayer.membership_tier === 'regular' || currentPlayer.membership_tier === 'premium') {
        return res.status(400).json({ success: false, message: 'You already have full access.' });
      }

      // Update player membership tier to regular
      await client.query("UPDATE players SET membership_tier = 'regular' WHERE player_id = $1", [player_id]);
      console.log(`🎫 Successfully upgraded player ${player_id} to regular tier`);

      return res.status(200).json({ success: true, message: 'Coupon redeemed successfully! You now have full access.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Coupon redemption error:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
  }
}