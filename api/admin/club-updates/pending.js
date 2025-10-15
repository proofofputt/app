/**
 * Admin Pending Club Updates API
 * ============================================================================
 * GET /api/admin/club-updates/pending - Get all pending updates for review
 *
 * Returns list of pending club data updates that require admin approval
 * before being applied to the production database.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import { verifyAdminToken } from '../../../utils/auth.js';

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
  const adminCheck = await verifyAdminToken(req);
  if (!adminCheck.isValid) {
    return res.status(adminCheck.status).json({
      success: false,
      message: adminCheck.message,
    });
  }

  try {
    const { status = 'pending', limit = 100, offset = 0 } = req.query;

    // Get pending updates with club information
    const result = await pool.query(
      `SELECT
        pcu.update_id,
        pcu.club_id,
        pcu.field_name,
        pcu.old_value,
        pcu.new_value,
        pcu.source,
        pcu.source_user_email,
        pcu.status,
        pcu.created_at,
        pcu.reviewed_at,
        pcu.review_notes,
        c.name as club_name,
        c.address_city,
        c.address_state,
        c.url_slug,
        reviewer.name as reviewed_by_name,
        reviewer.email as reviewed_by_email
      FROM pending_club_updates pcu
      JOIN clubs c ON pcu.club_id = c.club_id
      LEFT JOIN players reviewer ON pcu.reviewed_by_admin_id = reviewer.player_id
      WHERE pcu.status = $1
      ORDER BY pcu.created_at DESC
      LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM pending_club_updates WHERE status = $1',
      [status]
    );

    const updates = result.rows.map(row => ({
      updateId: row.update_id,
      clubId: row.club_id,
      clubName: row.club_name,
      clubLocation: `${row.address_city}, ${row.address_state}`,
      clubSlug: row.url_slug,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      source: row.source,
      sourceUserEmail: row.source_user_email,
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by_name
        ? { name: row.reviewed_by_name, email: row.reviewed_by_email }
        : null,
      reviewNotes: row.review_notes,
    }));

    return res.status(200).json({
      success: true,
      updates,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + updates.length < parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Error fetching pending updates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending updates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
