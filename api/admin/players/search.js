/**
 * Admin Player Search API
 * ============================================================================
 * GET /api/admin/players/search - Search for players by name or email
 *
 * Admin-only endpoint to help find player IDs when manually generating
 * gift codes or looking up user information.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import { verifyAdmin } from '../../../utils/adminAuth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  // Verify admin authentication
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.isAdmin) {
    return res.status(adminCheck.error === 'Authentication required' ? 401 : 403).json({
      success: false,
      message: adminCheck.error,
    });
  }

  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search by name, email, or player_id
    const result = await pool.query(
      `SELECT
        player_id,
        name,
        email,
        display_name,
        membership_tier,
        subscription_status,
        created_at
      FROM players
      WHERE
        LOWER(name) LIKE LOWER($1) OR
        LOWER(email) LIKE LOWER($1) OR
        LOWER(display_name) LIKE LOWER($1) OR
        CAST(player_id AS TEXT) = $2
      ORDER BY
        CASE
          WHEN CAST(player_id AS TEXT) = $2 THEN 0
          WHEN LOWER(email) = LOWER($3) THEN 1
          WHEN LOWER(name) = LOWER($3) THEN 2
          ELSE 3
        END,
        name
      LIMIT 20`,
      [searchTerm, q.trim(), q.trim()]
    );

    return res.status(200).json({
      success: true,
      players: result.rows.map(player => ({
        playerId: player.player_id,
        name: player.name,
        email: player.email,
        displayName: player.display_name,
        membershipTier: player.membership_tier,
        subscriptionStatus: player.subscription_status,
        createdAt: player.created_at,
      })),
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search players',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
