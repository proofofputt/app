import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, display_name, player_id } = req.query;

  if (!email && !display_name && !player_id) {
    return res.status(400).json({
      success: false,
      message: 'Must provide email, display_name, or player_id'
    });
  }

  let client;
  try {
    client = await pool.connect();

    let query = `
      SELECT
        player_id,
        name,
        email,
        display_name,
        google_id,
        linkedin_id,
        nostr_pubkey,
        oauth_providers,
        avatar_url,
        created_at,
        updated_at
      FROM players
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (email) {
      query += ` AND email = $${paramIndex}`;
      params.push(email);
      paramIndex++;
    }

    if (display_name) {
      query += ` AND display_name ILIKE $${paramIndex}`;
      params.push(`%${display_name}%`);
      paramIndex++;
    }

    if (player_id) {
      query += ` AND player_id = $${paramIndex}`;
      params.push(parseInt(player_id));
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 10`;

    const result = await client.query(query, params);

    // Also check for any players with similar emails or google_id
    let relatedPlayers = [];
    if (email && email.includes('noonewillpay')) {
      const relatedResult = await client.query(`
        SELECT player_id, email, display_name, google_id, created_at
        FROM players
        WHERE email ILIKE '%noonewillpay%'
        ORDER BY created_at DESC
      `);
      relatedPlayers = relatedResult.rows;
    }

    return res.status(200).json({
      success: true,
      search_params: { email, display_name, player_id },
      matches: result.rows,
      match_count: result.rows.length,
      related_players: relatedPlayers
    });

  } catch (error) {
    console.error('Debug find-player error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
