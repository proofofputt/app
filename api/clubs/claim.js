/**
 * Club Claim Request API
 * ============================================================================
 * POST /api/clubs/claim - Submit a request to become a club representative
 *
 * Allows authenticated users to request representative access to a club.
 * Requires admin approval before access is granted.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';
import { verifyToken } from '../../utils/auth.js';
import { sendClubClaimAlertEmail } from '../../utils/emailService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ADMIN_EMAIL = 'pop@proofofputt.com';

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

  // Verify authentication
  const user = await verifyToken(req);
  if (!user || !user.playerId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  try {
    const {
      club_id,
      position,
      work_email,
      work_phone,
      verification_notes,
      message,
    } = req.body;

    if (!club_id) {
      return res.status(400).json({
        success: false,
        message: 'Club ID is required',
      });
    }

    if (!position || !work_email) {
      return res.status(400).json({
        success: false,
        message: 'Position and work email are required for verification',
      });
    }

    // Verify club exists
    const clubCheck = await pool.query(
      'SELECT club_id, name, address_city, address_state FROM clubs WHERE club_id = $1 AND is_active = TRUE',
      [club_id]
    );

    if (clubCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const club = clubCheck.rows[0];

    // Check if user is already a rep for this club
    const existingRep = await pool.query(
      'SELECT rep_id FROM club_representatives WHERE club_id = $1 AND player_id = $2 AND is_active = TRUE',
      [club_id, user.playerId]
    );

    if (existingRep.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already a representative of this club',
      });
    }

    // Check for existing pending claim
    const existingClaim = await pool.query(
      'SELECT claim_id FROM club_claim_requests WHERE club_id = $1 AND player_id = $2 AND status = $3',
      [club_id, user.playerId, 'pending']
    );

    if (existingClaim.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending claim request for this club',
      });
    }

    // Create claim request
    const result = await pool.query(
      `INSERT INTO club_claim_requests (
        club_id,
        player_id,
        position,
        work_email,
        work_phone,
        verification_notes,
        message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        club_id,
        user.playerId,
        position,
        work_email,
        work_phone,
        verification_notes,
        message,
      ]
    );

    const claim = result.rows[0];

    // Get player info for notifications
    const playerResult = await pool.query(
      'SELECT player_id, name, email FROM players WHERE player_id = $1',
      [user.playerId]
    );
    const playerInfo = playerResult.rows[0];

    // Send in-app notifications to all admins
    try {
      const adminsResult = await pool.query(
        'SELECT player_id FROM players WHERE is_admin = TRUE'
      );

      const notificationPromises = adminsResult.rows.map(admin =>
        pool.query(
          `INSERT INTO notifications (
            player_id,
            type,
            title,
            message,
            link_path,
            data,
            read_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            admin.player_id,
            'club_claim_request',
            'New Club Claim Request',
            `${playerInfo.name} has requested to represent ${club.name}`,
            '/admin/clubs/claims',
            JSON.stringify({
              claim_id: claim.claim_id,
              club_id: club.club_id,
              club_name: club.name,
              player_id: user.playerId,
              player_name: playerInfo.name,
              position: position,
            }),
            false,
          ]
        )
      );

      await Promise.all(notificationPromises);
      console.log(`Sent in-app notifications to ${adminsResult.rows.length} admins`);
    } catch (notifError) {
      console.error('Error sending in-app notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    // Send email notification to pop@proofofputt.com
    try {
      await sendClubClaimAlertEmail(
        ADMIN_EMAIL,
        {
          position,
          work_email,
          work_phone,
          verification_notes,
          message,
        },
        playerInfo,
        club
      );
      console.log(`Sent club claim alert email to ${ADMIN_EMAIL}`);
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(201).json({
      success: true,
      message: `Your claim request for ${club.name} has been submitted and is pending admin approval`,
      claim: {
        ...claim,
        club_name: club.name,
        club_location: `${club.address_city}, ${club.address_state}`,
      },
    });
  } catch (error) {
    console.error('Error submitting club claim:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit claim request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
