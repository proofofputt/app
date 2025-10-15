/**
 * Admin Approve Club Update API
 * ============================================================================
 * POST /api/admin/club-updates/[updateId]/approve - Approve and apply update
 *
 * Approves a pending club update and applies it to the database.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../utils/cors.js';
import { verifyAdmin } from '../../../../utils/adminAuth.js';

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
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.isAdmin) {
    return res.status(adminCheck.error === 'Authentication required' ? 401 : 403).json({
      success: false,
      message: adminCheck.error,
    });
  }

  const { updateId } = req.query;
  const { notes } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the pending update
    const updateResult = await client.query(
      `SELECT * FROM pending_club_updates
       WHERE update_id = $1 AND status = 'pending'`,
      [updateId]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Update not found or already processed',
      });
    }

    const update = updateResult.rows[0];

    // Apply the update to the clubs table
    const updateQuery = `UPDATE clubs SET ${update.field_name} = $1, last_synced_from_crm = NOW() WHERE club_id = $2`;
    await client.query(updateQuery, [update.new_value, update.club_id]);

    // Mark update as approved
    await client.query(
      `UPDATE pending_club_updates
       SET status = 'approved',
           reviewed_at = NOW(),
           reviewed_by_admin_id = $1,
           review_notes = $2
       WHERE update_id = $3`,
      [adminCheck.user.player_id, notes, updateId]
    );

    // Log the sync event
    await client.query(
      `INSERT INTO crm_sync_log (sync_type, club_id, direction, source, payload, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'approval_applied',
        update.club_id,
        'inbound',
        update.source,
        JSON.stringify({
          update_id: updateId,
          field: update.field_name,
          oldValue: update.old_value,
          newValue: update.new_value,
          approved_by: adminCheck.user.player_id,
        }),
        true,
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Update approved and applied successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
}
