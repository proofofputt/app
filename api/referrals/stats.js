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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const userId = user.playerId;

  try {

    // Get referral statistics
    // Note: This table needs to be created. For now, we'll return mock data structure
    const stats = {
      totalInvites: 0,
      viewed: 0,
      rejected: 0,
      accountsCreated: 0,
      upgraded: 0,
      invites: []
    };

    // Check if gift_code_sends table exists and query it
    try {
      const invitesResult = await pool.query(
        `SELECT
          gcs.id,
          gcs.recipient,
          gcs.sent_at,
          gcs.viewed,
          gcs.status,
          p.player_id as recipient_player_id,
          p.is_subscribed,
          CASE
            WHEN p.player_id IS NOT NULL THEN true
            ELSE false
          END as account_created
         FROM gift_code_sends gcs
         LEFT JOIN players p ON (p.email = gcs.recipient OR p.phone = gcs.recipient)
         WHERE gcs.sent_by_user_id = $1
         ORDER BY gcs.sent_at DESC
         LIMIT 50`,
        [userId]
      );

      stats.invites = invitesResult.rows.map(row => ({
        recipient: row.recipient,
        sent_at: row.sent_at,
        status: row.status || 'pending',
        viewed: row.viewed || false,
        account_created: row.account_created,
        is_subscriber: row.is_subscribed || false
      }));

      // Calculate summary stats
      stats.totalInvites = invitesResult.rows.length;
      stats.viewed = invitesResult.rows.filter(r => r.viewed).length;
      stats.rejected = invitesResult.rows.filter(r => r.status === 'rejected').length;
      stats.accountsCreated = invitesResult.rows.filter(r => r.account_created).length;
      stats.upgraded = invitesResult.rows.filter(r => r.is_subscribed).length;

    } catch (queryError) {
      console.log('Gift code sends table may not exist yet:', queryError.message);
      // Return empty stats if table doesn't exist
    }

    return res.status(200).json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
