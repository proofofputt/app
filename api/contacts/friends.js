import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Verify JWT and extract player_id
function getPlayerIdFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.playerId;
  } catch (error) {
    console.error('[Contacts Friends] Token verification error:', error.message);
    return null;
  }
}

async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    // Verify authentication
    const playerId = getPlayerIdFromToken(req);
    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { status = 'accepted', include_stats = 'true' } = req.query;

    client = await pool.connect();

    // Build query to get friends with coach access status and optional stats
    let query = `
      SELECT
        f.friendship_id,
        f.friend_id as player_id,
        f.status,
        f.source,
        f.source_context,
        f.created_at as friendship_created_at,
        p.display_name,
        p.email,
        p.name,
        p.membership_tier,
        p.is_subscriber,

        -- Check if this friend is the player's referrer
        CASE
          WHEN current_player.referred_by_player_id = f.friend_id THEN true
          ELSE false
        END as is_referrer,

        -- Check coach access grants
        cag_to_friend.grant_id as coach_grant_id_given,
        cag_to_friend.access_level as coach_access_level_given,
        cag_to_friend.granted_at as coach_access_granted_at,
        cag_from_friend.grant_id as coach_grant_id_received,
        cag_from_friend.access_level as coach_access_level_received,
        cag_from_friend.granted_at as coach_access_received_at
    `;

    // Add session stats if requested
    if (include_stats === 'true') {
      query += `,
        COUNT(DISTINCT s.session_id) as total_sessions,
        MAX(s.created_at) as last_session_date
      `;
    }

    query += `
      FROM friendships f
      INNER JOIN players p ON f.friend_id = p.player_id
      INNER JOIN players current_player ON f.player_id = current_player.player_id

      -- Check if I've granted coach access TO this friend
      LEFT JOIN coach_access_grants cag_to_friend ON (
        cag_to_friend.student_player_id = $1
        AND cag_to_friend.coach_player_id = f.friend_id
        AND cag_to_friend.status = 'active'
      )

      -- Check if this friend has granted coach access TO ME
      LEFT JOIN coach_access_grants cag_from_friend ON (
        cag_from_friend.student_player_id = f.friend_id
        AND cag_from_friend.coach_player_id = $1
        AND cag_from_friend.status = 'active'
      )
    `;

    if (include_stats === 'true') {
      query += `
        LEFT JOIN sessions s ON p.player_id = s.player_id
      `;
    }

    query += `
      WHERE f.player_id = $1
    `;

    const params = [playerId];

    if (status && status !== 'all') {
      query += ' AND f.status = $2';
      params.push(status);
    }

    if (include_stats === 'true') {
      query += `
        GROUP BY
          f.friendship_id,
          f.friend_id,
          f.status,
          f.source,
          f.source_context,
          f.created_at,
          p.display_name,
          p.email,
          p.name,
          p.membership_tier,
          p.is_subscriber,
          current_player.referred_by_player_id,
          cag_to_friend.grant_id,
          cag_to_friend.access_level,
          cag_to_friend.granted_at,
          cag_from_friend.grant_id,
          cag_from_friend.access_level,
          cag_from_friend.granted_at
      `;
    }

    // Order by: referrer first, then by friendship date
    query += `
      ORDER BY
        (CASE WHEN current_player.referred_by_player_id = f.friend_id THEN 0 ELSE 1 END),
        f.created_at DESC
    `;

    const result = await client.query(query, params);

    const friends = result.rows.map(row => ({
      friendship_id: row.friendship_id,
      player_id: row.player_id,
      display_name: row.display_name || row.name || row.email,
      email: row.email,
      membership_tier: row.membership_tier,
      is_subscriber: row.is_subscriber,
      friendship_status: row.status,
      friendship_source: row.source,
      friendship_created_at: row.friendship_created_at,
      is_referrer: row.is_referrer,

      // Coach access I've granted TO this friend (they can see my sessions)
      coach_access_granted: {
        has_access: !!row.coach_grant_id_given,
        grant_id: row.coach_grant_id_given,
        access_level: row.coach_access_level_given,
        granted_at: row.coach_access_granted_at
      },

      // Coach access this friend granted TO ME (I can see their sessions)
      coach_access_received: {
        has_access: !!row.coach_grant_id_received,
        grant_id: row.coach_grant_id_received,
        access_level: row.coach_access_level_received,
        granted_at: row.coach_access_received_at
      },

      // Session stats if requested
      ...(include_stats === 'true' && {
        total_sessions: parseInt(row.total_sessions) || 0,
        last_session_date: row.last_session_date
      })
    }));

    return res.status(200).json({
      success: true,
      friends
    });

  } catch (error) {
    console.error('[Contacts Friends] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve friends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default handler;
