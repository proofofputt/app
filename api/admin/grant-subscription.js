import pg from 'pg';
import { requireAdmin, requirePermission, logAdminActivity, PERMISSIONS } from '../../utils/admin-middleware.js';
import { logApiRequest, logApiResponse, logSubscriptionEvent, createRequestLogger } from '../../utils/logger.js';
import crypto from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Admin Endpoint: Grant Subscription to User
 *
 * POST /api/admin/grant-subscription
 *
 * Body:
 * {
 *   "targetEmail": "user@example.com",  // OR targetPlayerId
 *   "targetPlayerId": 1234,              // OR targetEmail
 *   "subscriptionType": "monthly|annual|lifetime",
 *   "durationMonths": 12,                // Required unless lifetime
 *   "reason": "Customer support request",
 *   "notes": "Optional additional notes"
 * }
 */
async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId);

  if (req.method !== 'POST') {
    logApiResponse('/api/admin/grant-subscription', 'POST', 405, { requestId });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  logApiRequest('/api/admin/grant-subscription', 'POST', { requestId, adminId: req.admin?.player_id });

  const { targetEmail, targetPlayerId, subscriptionType, durationMonths, reason, notes } = req.body;

  // Validation
  if (!targetEmail && !targetPlayerId) {
    logApiResponse('/api/admin/grant-subscription', 'POST', 400, {
      requestId,
      reason: 'missing_target'
    });
    return res.status(400).json({
      success: false,
      error: 'Target user required',
      message: 'Provide either targetEmail or targetPlayerId'
    });
  }

  if (!subscriptionType || !['monthly', 'annual', 'lifetime'].includes(subscriptionType)) {
    logApiResponse('/api/admin/grant-subscription', 'POST', 400, {
      requestId,
      reason: 'invalid_subscription_type'
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid subscription type',
      message: 'subscriptionType must be: monthly, annual, or lifetime'
    });
  }

  if (subscriptionType !== 'lifetime' && (!durationMonths || durationMonths < 1)) {
    logApiResponse('/api/admin/grant-subscription', 'POST', 400, {
      requestId,
      reason: 'invalid_duration'
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid duration',
      message: 'durationMonths must be a positive number for non-lifetime subscriptions'
    });
  }

  if (!reason || reason.trim().length === 0) {
    logApiResponse('/api/admin/grant-subscription', 'POST', 400, {
      requestId,
      reason: 'missing_reason'
    });
    return res.status(400).json({
      success: false,
      error: 'Reason required',
      message: 'Provide a reason for granting this subscription'
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
        'grant_subscription',
        null,
        {
          targetEmail,
          targetPlayerId,
          subscriptionType,
          durationMonths
        },
        reason,
        req,
        'failed',
        'Target user not found'
      );

      logApiResponse('/api/admin/grant-subscription', 'POST', 404, {
        requestId,
        reason: 'user_not_found'
      });

      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No user found with the provided email or player ID'
      });
    }

    logger.info('Granting subscription', {
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      subscriptionType,
      durationMonths
    });

    // Calculate expiration
    let expiresAt = null;
    if (subscriptionType !== 'lifetime') {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + parseInt(durationMonths));
      expiresAt = expiryDate.toISOString();
    }

    // Create grant record
    const grantResult = await pool.query(
      `INSERT INTO admin_granted_subscriptions (
        granted_by_admin_id,
        granted_to_player_id,
        subscription_type,
        duration_months,
        reason,
        notes,
        expires_at,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING grant_id, granted_at`,
      [
        req.admin.player_id,
        targetUser.player_id,
        subscriptionType,
        subscriptionType === 'lifetime' ? null : durationMonths,
        reason,
        notes || null,
        expiresAt
      ]
    );

    const grant = grantResult.rows[0];

    // Update player subscription status
    await pool.query(
      `UPDATE players
      SET
        subscription_status = 'active',
        subscription_tier = 'full_subscriber',
        is_subscribed = TRUE,
        subscription_started_at = COALESCE(subscription_started_at, NOW()),
        subscription_current_period_start = NOW(),
        subscription_current_period_end = $1,
        updated_at = NOW()
      WHERE player_id = $2`,
      [expiresAt, targetUser.player_id]
    );

    // Log the action
    await logAdminActivity(
      req.admin,
      'grant_subscription',
      targetUser.player_id,
      {
        targetEmail: targetUser.email,
        subscriptionType,
        durationMonths,
        expiresAt,
        grantId: grant.grant_id
      },
      reason,
      req,
      'completed'
    );

    logSubscriptionEvent('admin_granted_subscription', {
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      subscriptionType,
      durationMonths,
      expiresAt,
      grantId: grant.grant_id
    });

    logApiResponse('/api/admin/grant-subscription', 'POST', 200, {
      requestId,
      adminId: req.admin.player_id,
      targetUserId: targetUser.player_id,
      grantId: grant.grant_id
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription granted successfully',
      grant: {
        grantId: grant.grant_id,
        grantedAt: grant.granted_at,
        targetUser: {
          playerId: targetUser.player_id,
          email: targetUser.email,
          displayName: targetUser.display_name
        },
        subscription: {
          type: subscriptionType,
          durationMonths: subscriptionType === 'lifetime' ? null : durationMonths,
          expiresAt: expiresAt,
          status: 'active'
        }
      }
    });

  } catch (error) {
    logger.error('Error granting subscription', error);

    // Log failed attempt
    try {
      await logAdminActivity(
        req.admin,
        'grant_subscription',
        targetPlayerId || null,
        {
          targetEmail,
          targetPlayerId,
          subscriptionType,
          durationMonths
        },
        reason,
        req,
        'failed',
        error.message
      );
    } catch (logError) {
      logger.error('Failed to log admin activity', logError);
    }

    logApiResponse('/api/admin/grant-subscription', 'POST', 500, {
      requestId,
      reason: 'internal_error',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to grant subscription'
    });
  }
}

// Apply middleware
export default function(req, res) {
  // Chain middleware
  requireAdmin(req, res, () => {
    requirePermission(PERMISSIONS.GRANT_SUBSCRIPTIONS)(req, res, () => {
      handler(req, res);
    });
  });
}
