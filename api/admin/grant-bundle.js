import pg from 'pg';
import crypto from 'crypto';
import { requireAdmin, requirePermission, logAdminActivity, PERMISSIONS } from '../../utils/admin-middleware.js';
import { logApiRequest, logApiResponse, logSubscriptionEvent, createRequestLogger } from '../../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Generate a unique gift code
 */
function generateGiftCode() {
  return `GIFT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Admin Endpoint: Grant Bundle Gift Codes to User
 *
 * POST /api/admin/grant-bundle
 *
 * Body:
 * {
 *   "targetEmail": "user@example.com",  // OR targetPlayerId
 *   "targetPlayerId": 1234,              // OR targetEmail
 *   "quantity": 5,                       // Number of gift codes to generate
 *   "reason": "Partnership agreement",
 *   "notes": "Optional additional notes"
 * }
 */
async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId);

  if (req.method !== 'POST') {
    logApiResponse('/api/admin/grant-bundle', 'POST', 405, { requestId });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  logApiRequest('/api/admin/grant-bundle', 'POST', { requestId, adminId: req.admin?.player_id });

  const { targetEmail, targetPlayerId, quantity, reason, notes } = req.body;

  // Validation
  if (!targetEmail && !targetPlayerId) {
    logApiResponse('/api/admin/grant-bundle', 'POST', 400, {
      requestId,
      reason: 'missing_target'
    });
    return res.status(400).json({
      success: false,
      error: 'Target user required',
      message: 'Provide either targetEmail or targetPlayerId'
    });
  }

  if (!quantity || quantity < 1 || quantity > 100) {
    logApiResponse('/api/admin/grant-bundle', 'POST', 400, {
      requestId,
      reason: 'invalid_quantity'
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid quantity',
      message: 'quantity must be between 1 and 100'
    });
  }

  if (!reason || reason.trim().length === 0) {
    logApiResponse('/api/admin/grant-bundle', 'POST', 400, {
      requestId,
      reason: 'missing_reason'
    });
    return res.status(400).json({
      success: false,
      error: 'Reason required',
      message: 'Provide a reason for granting these gift codes'
    });
  }

  try {
    // Find target user
    let targetUser;
    if (targetPlayerId) {
      const result = await pool.query(
        'SELECT player_id, email, display_name FROM players WHERE player_id = $1',
        [targetPlayerId]
      );
      targetUser = result.rows[0];
    } else {
      const result = await pool.query(
        'SELECT player_id, email, display_name FROM players WHERE email = $1',
        [targetEmail.toLowerCase()]
      );
      targetUser = result.rows[0];
    }

    if (!targetUser) {
      logger.warn('Target user not found', { targetEmail, targetPlayerId });

      // Log failed attempt
      await logAdminActivity(
        req.admin,
        'grant_bundle',
        null,
        {
          targetEmail,
          targetPlayerId,
          quantity
        },
        reason,
        req,
        'failed',
        'Target user not found'
      );

      logApiResponse('/api/admin/grant-bundle', 'POST', 404, {
        requestId,
        reason: 'user_not_found'
      });

      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No user found with the provided email or player ID'
      });
    }

    logger.info('Granting bundle gift codes', {
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      quantity
    });

    // Generate gift codes
    const giftCodes = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < quantity; i++) {
        const giftCode = generateGiftCode();

        await client.query(
          `INSERT INTO user_gift_subscriptions (
            owner_user_id,
            gift_code,
            bundle_id,
            is_redeemed,
            created_at
          ) VALUES ($1, $2, NULL, FALSE, NOW())`,
          [targetUser.player_id, giftCode]
        );

        giftCodes.push(giftCode);

        logSubscriptionEvent('admin_granted_gift_code', {
          adminId: req.admin.player_id,
          targetUserId: targetUser.player_id,
          giftCode
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Log the action
    await logAdminActivity(
      req.admin,
      'grant_bundle',
      targetUser.player_id,
      {
        targetEmail: targetUser.email,
        quantity,
        giftCodes,
        notes
      },
      reason,
      req,
      'completed'
    );

    logger.info('Bundle gift codes granted successfully', {
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      quantity,
      codesGenerated: giftCodes.length
    });

    logApiResponse('/api/admin/grant-bundle', 'POST', 200, {
      requestId,
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      quantity
    });

    return res.status(200).json({
      success: true,
      message: `Successfully granted ${quantity} gift codes`,
      grant: {
        targetUser: {
          playerId: targetUser.player_id,
          email: targetUser.email,
          displayName: targetUser.display_name
        },
        quantity,
        giftCodes,
        reason,
        notes: notes || null,
        grantedAt: new Date().toISOString(),
        grantedBy: {
          adminId: req.admin.player_id,
          adminEmail: req.admin.email,
          adminRole: req.admin.admin_role
        }
      }
    });

  } catch (error) {
    logger.error('Error granting bundle gift codes', error);

    // Log failed attempt
    try {
      await logAdminActivity(
        req.admin,
        'grant_bundle',
        targetPlayerId || null,
        {
          targetEmail,
          targetPlayerId,
          quantity
        },
        reason,
        req,
        'failed',
        error.message
      );
    } catch (logError) {
      logger.error('Failed to log admin activity', logError);
    }

    logApiResponse('/api/admin/grant-bundle', 'POST', 500, {
      requestId,
      reason: 'internal_error',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to grant gift codes'
    });
  }
}

// Apply middleware
export default function(req, res) {
  // Chain middleware
  requireAdmin(req, res, () => {
    requirePermission(PERMISSIONS.GRANT_BUNDLES)(req, res, () => {
      handler(req, res);
    });
  });
}
