import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import { requireAdmin } from '../../../utils/adminAuth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();

    if (req.method === 'GET') {
      return await handleGetPlayerProfile(req, res, client);
    } else {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Admin player profile API error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// GET: Retrieve detailed player profile with 5-level referral chain
async function handleGetPlayerProfile(req, res, client) {
  // Extract playerId from query params (Vercel dynamic route)
  const playerId = req.query.playerId;

  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: 'playerId is required'
    });
  }

  const query = `
    SELECT
      -- Player basic info
      p.player_id,
      p.email,
      p.first_name,
      p.last_name,
      p.display_name,
      p.name,
      p.phone,
      p.membership_tier,
      p.created_at,
      p.timezone,
      p.referral_code,
      p.is_subscriber,
      p.referred_by_player_id,
      p.total_referrals,

      -- HubSpot tracking
      p.hubspot_contact_id,
      p.hubspot_last_sync_at,
      p.hubspot_sync_status,

      -- Referrer levels (IDs)
      p.referrer_level_1,
      p.referrer_level_2,
      p.referrer_level_3,
      p.referrer_level_4,
      p.referrer_level_5,

      -- Referrer Level 1 details (Direct Referrer)
      r1.player_id as l1_player_id,
      r1.display_name as l1_display_name,
      r1.email as l1_email,
      r1.created_at as l1_joined_date,
      r1.total_referrals as l1_total_referrals,

      -- Referrer Level 2 details
      r2.player_id as l2_player_id,
      r2.display_name as l2_display_name,
      r2.email as l2_email,
      r2.created_at as l2_joined_date,
      r2.total_referrals as l2_total_referrals,

      -- Referrer Level 3 details
      r3.player_id as l3_player_id,
      r3.display_name as l3_display_name,
      r3.email as l3_email,
      r3.created_at as l3_joined_date,
      r3.total_referrals as l3_total_referrals,

      -- Referrer Level 4 details
      r4.player_id as l4_player_id,
      r4.display_name as l4_display_name,
      r4.email as l4_email,
      r4.created_at as l4_joined_date,
      r4.total_referrals as l4_total_referrals,

      -- Referrer Level 5 details
      r5.player_id as l5_player_id,
      r5.display_name as l5_display_name,
      r5.email as l5_email,
      r5.created_at as l5_joined_date,
      r5.total_referrals as l5_total_referrals,

      -- Session stats
      COUNT(DISTINCT s.session_id) as total_sessions,
      MAX(s.created_at) as last_session_date,
      MIN(s.created_at) as first_session_date

    FROM players p
    LEFT JOIN players r1 ON p.referrer_level_1 = r1.player_id
    LEFT JOIN players r2 ON p.referrer_level_2 = r2.player_id
    LEFT JOIN players r3 ON p.referrer_level_3 = r3.player_id
    LEFT JOIN players r4 ON p.referrer_level_4 = r4.player_id
    LEFT JOIN players r5 ON p.referrer_level_5 = r5.player_id
    LEFT JOIN sessions s ON p.player_id = s.player_id
    WHERE p.player_id = $1
    GROUP BY
      p.player_id,
      r1.player_id, r1.display_name, r1.email, r1.created_at, r1.total_referrals,
      r2.player_id, r2.display_name, r2.email, r2.created_at, r2.total_referrals,
      r3.player_id, r3.display_name, r3.email, r3.created_at, r3.total_referrals,
      r4.player_id, r4.display_name, r4.email, r4.created_at, r4.total_referrals,
      r5.player_id, r5.display_name, r5.email, r5.created_at, r5.total_referrals
  `;

  console.log('[Admin Player Profile] Fetching profile for player_id:', playerId);

  const result = await client.query(query, [playerId]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Player not found'
    });
  }

  return res.status(200).json({
    success: true,
    player: result.rows[0]
  });
}

// Export with admin protection
export default requireAdmin(handler);
