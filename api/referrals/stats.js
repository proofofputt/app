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
    const stats = {
      totalInvites: 0,
      viewed: 0,
      rejected: 0,
      accountsCreated: 0,
      upgraded: 0,
      invites: [],
      giftCodeRedemptions: 0,
      referredBy: null // Only show direct referrer (Level 1), not full chain
    };

    // Get direct referrer information (Level 1 only)
    // Note: Full 5-level chain is only visible to admins
    try {
      const referrerResult = await pool.query(
        `SELECT
          p.player_id,
          p.display_name,
          p.email,
          p.created_at as joined_date,
          p.total_referrals
         FROM players current
         INNER JOIN players p ON current.referrer_level_1 = p.player_id
         WHERE current.player_id = $1`,
        [userId]
      );

      if (referrerResult.rows.length > 0) {
        const referrer = referrerResult.rows[0];
        stats.referredBy = {
          player_id: referrer.player_id,
          display_name: referrer.display_name || referrer.email,
          email: referrer.email,
          joined_date: referrer.joined_date,
          total_referrals: referrer.total_referrals || 0
        };
      }
    } catch (referrerError) {
      console.log('Could not fetch referrer info (may not have referrer):', referrerError.message);
      // Not an error - user may not have been referred by anyone
    }

    // Get gift code sends (invitations sent via Send button)
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
        is_subscriber: row.is_subscribed || false,
        type: 'gift_send'
      }));

      // Calculate summary stats
      stats.totalInvites = invitesResult.rows.length;
      stats.viewed = invitesResult.rows.filter(r => r.viewed).length;
      stats.rejected = invitesResult.rows.filter(r => r.status === 'rejected').length;
      stats.accountsCreated = invitesResult.rows.filter(r => r.account_created).length;
      stats.upgraded = invitesResult.rows.filter(r => r.is_subscribed).length;

    } catch (queryError) {
      console.log('Gift code sends table may not exist yet:', queryError.message);
    }

    // Get gift code redemptions (codes redeemed by others)
    try {
      const redemptionsResult = await pool.query(
        `SELECT
          ugs.gift_code,
          ugs.redeemed_at,
          p.player_id,
          p.name,
          p.email,
          p.is_subscribed,
          p.membership_tier
         FROM user_gift_subscriptions ugs
         INNER JOIN players p ON p.player_id = ugs.redeemed_by_user_id
         WHERE ugs.owner_user_id = $1
           AND ugs.is_redeemed = TRUE
         ORDER BY ugs.redeemed_at DESC
         LIMIT 50`,
        [userId]
      );

      // Add redemptions to invites list
      const redemptions = redemptionsResult.rows.map(row => ({
        recipient: row.email || row.name,
        sent_at: row.redeemed_at,
        status: 'redeemed',
        viewed: true,
        account_created: true,
        is_subscriber: row.is_subscribed || false,
        type: 'gift_redemption',
        gift_code: row.gift_code
      }));

      stats.invites = [...stats.invites, ...redemptions];
      stats.giftCodeRedemptions = redemptions.length;

      // Update stats to include redemptions
      stats.totalInvites += redemptions.length;
      stats.accountsCreated += redemptions.length;
      stats.upgraded += redemptions.filter(r => r.is_subscriber).length;

      // Sort all invites by date
      stats.invites.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

    } catch (queryError) {
      console.log('Gift code redemptions query error:', queryError.message);
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
