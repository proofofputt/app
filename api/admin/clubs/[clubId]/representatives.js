/**
 * Admin Club Representatives API
 * ============================================================================
 * POST /api/admin/clubs/[clubId]/representatives - Add representative to club
 * DELETE /api/admin/clubs/[clubId]/representatives - Remove representative
 *
 * Admin only endpoint for managing club representatives
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

  // POST - Add representative to club
  if (req.method === 'POST') {
    try {
      const {
        player_id,
        role = 'rep',
        can_invite_players = true,
        can_create_leagues = true,
        can_grant_subscriptions = true,
        can_manage_reps = true,
      } = req.body;

      if (!player_id) {
        return res.status(400).json({
          success: false,
          message: 'Player ID is required',
        });
      }

      // Verify club exists
      const clubCheck = await pool.query(
        'SELECT club_id, name FROM clubs WHERE club_id = $1',
        [clubIdInt]
      );

      if (clubCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      // Verify player exists
      const playerCheck = await pool.query(
        'SELECT player_id, name, email FROM players WHERE player_id = $1',
        [player_id]
      );

      if (playerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Player not found',
        });
      }

      // Check if already a rep
      const existingRep = await pool.query(
        'SELECT rep_id, is_active FROM club_representatives WHERE club_id = $1 AND player_id = $2',
        [clubIdInt, player_id]
      );

      if (existingRep.rows.length > 0) {
        // If exists but inactive, reactivate
        if (!existingRep.rows[0].is_active) {
          const reactivateResult = await pool.query(
            `UPDATE club_representatives
             SET is_active = TRUE, role = $1, added_at = CURRENT_TIMESTAMP, added_by_player_id = $2
             WHERE rep_id = $3
             RETURNING *`,
            [role, adminCheck.playerId, existingRep.rows[0].rep_id]
          );

          // Set is_club_rep flag on player
          await pool.query(
            'UPDATE players SET is_club_rep = TRUE WHERE player_id = $1',
            [player_id]
          );

          return res.status(200).json({
            success: true,
            message: 'Club representative reactivated successfully',
            representative: reactivateResult.rows[0],
          });
        }

        return res.status(400).json({
          success: false,
          message: 'Player is already a representative of this club',
        });
      }

      // Add new representative
      const result = await pool.query(
        `INSERT INTO club_representatives (
          club_id,
          player_id,
          role,
          can_invite_players,
          can_create_leagues,
          can_grant_subscriptions,
          can_manage_reps,
          added_by_player_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          clubIdInt,
          player_id,
          role,
          can_invite_players,
          can_create_leagues,
          can_grant_subscriptions,
          can_manage_reps,
          adminCheck.playerId,
        ]
      );

      // Set is_club_rep flag on player
      await pool.query(
        'UPDATE players SET is_club_rep = TRUE WHERE player_id = $1',
        [player_id]
      );

      return res.status(201).json({
        success: true,
        message: 'Club representative added successfully',
        representative: result.rows[0],
      });
    } catch (error) {
      console.error('Error adding club representative:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add club representative',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // DELETE - Remove representative from club
  if (req.method === 'DELETE') {
    try {
      const { player_id } = req.body;

      if (!player_id) {
        return res.status(400).json({
          success: false,
          message: 'Player ID is required',
        });
      }

      // Deactivate representative
      const result = await pool.query(
        `UPDATE club_representatives
         SET is_active = FALSE
         WHERE club_id = $1 AND player_id = $2
         RETURNING *`,
        [clubIdInt, player_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Representative not found',
        });
      }

      // Check if player is rep for any other clubs
      const otherClubs = await pool.query(
        'SELECT rep_id FROM club_representatives WHERE player_id = $1 AND is_active = TRUE LIMIT 1',
        [player_id]
      );

      // If not rep for any other clubs, remove is_club_rep flag
      if (otherClubs.rows.length === 0) {
        await pool.query(
          'UPDATE players SET is_club_rep = FALSE WHERE player_id = $1',
          [player_id]
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Club representative removed successfully',
        representative: result.rows[0],
      });
    } catch (error) {
      console.error('Error removing club representative:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove club representative',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
  });
}
