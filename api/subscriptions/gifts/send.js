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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verify authentication
  const authUser = await verifyToken(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { giftCodeId, recipient } = req.body;

  if (!giftCodeId || !recipient) {
    return res.status(400).json({
      success: false,
      message: 'Gift code ID and recipient are required'
    });
  }

  try {
    // Get user details from database
    const userResult = await pool.query(
      'SELECT player_id, email, display_name FROM players WHERE player_id = $1',
      [authUser.playerId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify ownership of gift code
    const giftCodeResult = await pool.query(
      `SELECT gift_code, is_redeemed, owner_user_id
       FROM user_gift_subscriptions
       WHERE id = $1`,
      [giftCodeId]
    );

    if (giftCodeResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gift code not found' });
    }

    const giftCode = giftCodeResult.rows[0];

    if (giftCode.owner_user_id !== user.player_id) {
      return res.status(403).json({ success: false, message: 'You do not own this gift code' });
    }

    if (giftCode.is_redeemed) {
      return res.status(400).json({ success: false, message: 'This gift code has already been redeemed' });
    }

    // TODO: Send email or SMS with gift code
    // For now, just log it
    const senderName = user.display_name || `Player ${user.player_id}`;
    console.log(`📧 Sending gift code ${giftCode.gift_code} to ${recipient} from ${senderName}`);

    // In production, integrate with email service (SendGrid, AWS SES) or SMS service (Twilio)
    // Example:
    // if (recipient.includes('@')) {
    //   await sendEmail({
    //     to: recipient,
    //     subject: 'You received a free year of Proof of Putt!',
    //     body: `${senderName} has gifted you a free year subscription. Use code: ${giftCode.gift_code}`
    //   });
    // } else {
    //   await sendSMS({
    //     to: recipient,
    //     message: `${senderName} gifted you Proof of Putt! Code: ${giftCode.gift_code}`
    //   });
    // }

    // Log the send attempt
    await pool.query(
      `INSERT INTO gift_code_sends (gift_code_id, recipient, sent_at, sent_by_user_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT DO NOTHING`,
      [giftCodeId, recipient, user.player_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Gift invitation sent successfully!',
      giftCode: giftCode.gift_code
    });

  } catch (error) {
    console.error('Error sending gift code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send gift invitation'
    });
  }
}
