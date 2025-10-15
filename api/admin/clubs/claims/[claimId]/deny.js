/**
 * Admin Deny Club Claim API
 * ============================================================================
 * POST /api/admin/clubs/claims/[claimId]/deny - Deny a club claim request
 *
 * Denies the claim request with optional admin notes
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

  try {
    const { admin_notes } = req.body;

    // Get claim details
    const claimResult = await pool.query(
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
      return res.status(404).json({
        success: false,
        message: 'Claim request not found',
      });
    }

    const claim = claimResult.rows[0];

    if (claim.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This claim has already been ${claim.status}`,
      });
    }

    // Update claim status
    const updateResult = await pool.query(
      `UPDATE club_claim_requests
       SET
         status = 'denied',
         reviewed_by_admin_id = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         admin_notes = $2
       WHERE claim_id = $3
       RETURNING *`,
      [adminCheck.playerId, admin_notes, claimIdInt]
    );

    return res.status(200).json({
      success: true,
      message: `Claim request from ${claim.player_name} for ${claim.club_name} has been denied`,
      claim: {
        ...updateResult.rows[0],
        club_name: claim.club_name,
        player_name: claim.player_name,
        player_email: claim.player_email,
      },
    });
  } catch (error) {
    console.error('Error denying club claim:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deny claim',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
