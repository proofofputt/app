/**
 * Admin Approve Club Claim API
 * ============================================================================
 * POST /api/admin/clubs/claims/[claimId]/approve - Approve a club claim request
 *
 * Approves the claim and automatically creates a club representative entry
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../../utils/cors.js';
import { verifyToken } from '../../../../../utils/auth.js';

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

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  // Verify admin access
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.authorized) {
    return res.status(403).json({
      success: false,
      message: adminCheck.message,
    });
  }

  const { claimId } = req.query;
  const claimIdInt = parseInt(claimId);

  if (!claimIdInt) {
    return res.status(400).json({
      success: false,
      message: 'Valid claim ID is required',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { admin_notes, role = 'rep' } = req.body;

    // Get claim details
    const claimResult = await client.query(
      `SELECT
        ccr.*,
        c.name as club_name,
        p.name as player_name,
        p.email as player_email
       FROM club_claim_requests ccr
       JOIN clubs c ON ccr.club_id = c.club_id
       JOIN players p ON ccr.player_id = p.player_id
       WHERE ccr.claim_id = $1`,
      [claimIdInt]
    );

    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Claim request not found',
      });
    }

    const claim = claimResult.rows[0];

    if (claim.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `This claim has already been ${claim.status}`,
      });
    }

    // Update claim status
    await client.query(
      `UPDATE club_claim_requests
       SET
         status = 'approved',
         reviewed_by_admin_id = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         admin_notes = $2
       WHERE claim_id = $3`,
      [adminCheck.playerId, admin_notes, claimIdInt]
    );

    // Check if already a rep (in case added manually between claim and approval)
    const existingRep = await client.query(
      'SELECT rep_id, is_active FROM club_representatives WHERE club_id = $1 AND player_id = $2',
      [claim.club_id, claim.player_id]
    );

    let representative;

    if (existingRep.rows.length > 0) {
      // If exists but inactive, reactivate
      if (!existingRep.rows[0].is_active) {
        const reactivateResult = await client.query(
          `UPDATE club_representatives
           SET is_active = TRUE, role = $1, added_at = CURRENT_TIMESTAMP, added_by_player_id = $2
           WHERE rep_id = $3
           RETURNING *`,
          [role, adminCheck.playerId, existingRep.rows[0].rep_id]
        );
        representative = reactivateResult.rows[0];
      } else {
        representative = existingRep.rows[0];
      }
    } else {
      // Create new representative
      const repResult = await client.query(
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
          claim.club_id,
          claim.player_id,
          role,
          true, // can_invite_players
          true, // can_create_leagues
          true, // can_grant_subscriptions
          true, // can_manage_reps
          adminCheck.playerId,
        ]
      );
      representative = repResult.rows[0];
    }

    // Set is_club_rep flag on player
    await client.query(
      'UPDATE players SET is_club_rep = TRUE WHERE player_id = $1',
      [claim.player_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${claim.player_name} has been approved as a representative for ${claim.club_name}`,
      claim: {
        ...claim,
        status: 'approved',
        reviewed_at: new Date(),
        reviewed_by_admin_id: adminCheck.playerId,
        admin_notes,
      },
      representative,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving club claim:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve claim',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
}
