/**
 * Admin Reject Club Update API
 * ============================================================================
 * POST /api/admin/club-updates/[updateId]/reject - Reject update
 *
 * Rejects a pending club update without applying changes.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../utils/cors.js';
import { verifyAdminToken } from '../../../../utils/auth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

  // Verify admin authentication
  const adminCheck = await verifyAdminToken(req);
  if (!adminCheck.isValid) {
    return res.status(adminCheck.status).json({
      success: false,
      message: adminCheck.message,
    });
  }

  const { updateId } = req.query;
  const { notes } = req.body;

  try {
    // Mark update as rejected
    const result = await pool.query(
      `UPDATE pending_club_updates
       SET status = 'rejected',
           reviewed_at = NOW(),
           reviewed_by_admin_id = $1,
           review_notes = $2
       WHERE update_id = $3 AND status = 'pending'
       RETURNING club_id, field_name`,
      [adminCheck.user.player_id, notes, updateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Update not found or already processed',
      });
    }

    // Log the rejection
    await pool.query(
      `INSERT INTO crm_sync_log (sync_type, club_id, direction, source, payload, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'approval_rejected',
        result.rows[0].club_id,
        'inbound',
        'admin_panel',
        JSON.stringify({
          update_id: updateId,
          field: result.rows[0].field_name,
          rejected_by: adminCheck.user.player_id,
          notes,
        }),
        true,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Update rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
