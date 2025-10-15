/**
 * Admin Club Details API
 * ============================================================================
 * GET /api/admin/clubs/[clubId] - Get club details with stats
 * PATCH /api/admin/clubs/[clubId] - Update club information
 * DELETE /api/admin/clubs/[clubId] - Deactivate club
 *
 * Admin only endpoint for individual club management
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../utils/cors.js';
import { verifyToken } from '../../../../utils/auth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  const user = await verifyToken(req);

  if (!user || !user.playerId) {
    return { authorized: false, message: 'Authentication required' };
  }

  const result = await pool.query(
    'SELECT player_id, is_admin FROM players WHERE player_id = $1 AND is_admin = TRUE',
    [user.playerId]
  );

  if (result.rows.length === 0) {
    return { authorized: false, message: 'Admin access required' };
  }

  return { authorized: true, playerId: user.playerId };
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify admin access
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.authorized) {
    return res.status(403).json({
      success: false,
      message: adminCheck.message,
    });
  }

  const { clubId } = req.query;
  const clubIdInt = parseInt(clubId);

  if (!clubIdInt) {
    return res.status(400).json({
      success: false,
      message: 'Valid club ID is required',
    });
  }

  // GET - Get club details
  if (req.method === 'GET') {
    try {
      // Get club basic info
      const clubResult = await pool.query(
        'SELECT * FROM clubs WHERE club_id = $1',
        [clubIdInt]
      );

      if (clubResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      const club = clubResult.rows[0];

      // Get representatives
      const repsResult = await pool.query(
        `SELECT
          cr.rep_id,
          cr.player_id,
          cr.role,
          cr.can_invite_players,
          cr.can_create_leagues,
          cr.can_grant_subscriptions,
          cr.can_manage_reps,
          cr.is_active,
          cr.added_at,
          p.name,
          p.email,
          u.username,
          u.display_name
         FROM club_representatives cr
         JOIN players p ON cr.player_id = p.player_id
         LEFT JOIN users u ON p.player_id = u.id
         WHERE cr.club_id = $1
         ORDER BY cr.added_at DESC`,
        [clubIdInt]
      );

      // Get stats
      const statsResult = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM club_representatives WHERE club_id = $1 AND is_active = TRUE) as active_reps,
          (SELECT COUNT(*) FROM player_club_affiliations WHERE club_id = $1 AND is_active = TRUE) as total_players,
          (SELECT COUNT(*) FROM leagues WHERE host_club_id = $1) as total_leagues,
          (SELECT COUNT(*) FROM club_subscription_grants WHERE club_id = $1) as subscriptions_granted,
          (SELECT COUNT(*) FROM club_subscription_grants WHERE club_id = $1 AND is_redeemed = TRUE) as subscriptions_redeemed`,
        [clubIdInt]
      );

      // Get bundle purchases
      const bundlesResult = await pool.query(
        `SELECT
          bundle_purchase_id,
          bundle_id,
          quantity,
          total_granted,
          remaining,
          payment_amount,
          payment_currency,
          purchased_at,
          purchased_by_player_id
         FROM club_subscription_bundles
         WHERE club_id = $1
         ORDER BY purchased_at DESC
         LIMIT 10`,
        [clubIdInt]
      );

      return res.status(200).json({
        success: true,
        club: {
          ...club,
          osm_data: club.osm_data || {},
        },
        representatives: repsResult.rows,
        stats: statsResult.rows[0] || {},
        recentBundles: bundlesResult.rows,
      });
    } catch (error) {
      console.error('Error fetching club details:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch club details',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // PATCH - Update club
  if (req.method === 'PATCH') {
    try {
      const updates = req.body;
      const allowedFields = [
        'name',
        'club_type',
        'address_street',
        'address_city',
        'address_state',
        'address_postcode',
        'address_country',
        'latitude',
        'longitude',
        'phone',
        'email',
        'website',
        'facebook_url',
        'instagram_url',
        'twitter_url',
        'is_verified',
        'is_active',
      ];

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update',
        });
      }

      // Add updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add club_id for WHERE clause
      paramCount++;
      values.push(clubIdInt);

      const query = `UPDATE clubs SET ${updateFields.join(', ')} WHERE club_id = $${paramCount} RETURNING *`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Club updated successfully',
        club: result.rows[0],
      });
    } catch (error) {
      console.error('Error updating club:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update club',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // DELETE - Deactivate club
  if (req.method === 'DELETE') {
    try {
      const result = await pool.query(
        'UPDATE clubs SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE club_id = $1 RETURNING *',
        [clubIdInt]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Club deactivated successfully',
        club: result.rows[0],
      });
    } catch (error) {
      console.error('Error deactivating club:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate club',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
  });
}
