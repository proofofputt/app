/**
 * Admin API endpoint to generate bundle subscription gift codes
 * Use case: Create gift codes for partnerships, beta testing, promotional campaigns
 *
 * Example usage:
 * POST /api/admin/subscriptions/bundles/generate-gift-codes
 * {
 *   "userId": 123,                           // User who will own these gift codes
 *   "bundleId": 2,                          // Which bundle (3-pack, 5-pack, etc.)
 *   "customLabel": "BETA-GOLF-CLUB-XYZ",   // Custom identifier for these codes
 *   "grantReason": "Partnership agreement with Golf Club XYZ - Beta testing program"
 * }
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../../utils/cors.js';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple admin authentication - check for admin token
// TODO: Replace with proper admin authentication system
function authenticateAdmin(req) {
  const adminToken = req.headers.authorization?.replace('Bearer ', '');
  const validAdminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || !validAdminToken) {
    return { isAdmin: false, error: 'Admin authentication not configured' };
  }

  if (adminToken !== validAdminToken) {
    return { isAdmin: false, error: 'Invalid admin credentials' };
  }

  return { isAdmin: true };
}

function generateCustomGiftCode(customLabel, index) {
  // Generate a secure random component
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();

  // Format: CUSTOMLABEL-RANDOM-INDEX
  // Example: BETA-CLUBXYZ-A3F2B1E4-001
  return `${customLabel}-${randomPart}-${String(index).padStart(3, '0')}`;
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authenticate admin
  const authResult = authenticateAdmin(req);
  if (!authResult.isAdmin) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'Unauthorized - Admin access required'
    });
  }

  const { userId, bundleId, customLabel, grantReason, adminId } = req.body;

  // Validate required fields
  if (!userId || !bundleId || !customLabel) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, bundleId, customLabel'
    });
  }

  // Validate custom label format
  const labelRegex = /^[A-Z0-9-]+$/;
  if (!labelRegex.test(customLabel)) {
    return res.status(400).json({
      success: false,
      message: 'Custom label must contain only uppercase letters, numbers, and hyphens'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify user exists
    const userCheck = await client.query(
      'SELECT player_id, display_name FROM players WHERE player_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `User with ID ${userId} not found`
      });
    }

    const user = userCheck.rows[0];

    // 2. Get bundle details
    const bundleResult = await client.query(
      'SELECT * FROM subscription_bundles WHERE id = $1',
      [bundleId]
    );

    if (bundleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Bundle with ID ${bundleId} not found`
      });
    }

    const bundle = bundleResult.rows[0];

    // 3. Check if custom label already exists
    const existingLabel = await client.query(
      'SELECT COUNT(*) as count FROM user_gift_subscriptions WHERE custom_label = $1',
      [customLabel]
    );

    if (parseInt(existingLabel.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Custom label "${customLabel}" already exists. Please use a unique label.`
      });
    }

    // 4. Generate gift codes
    const generatedCodes = [];
    const now = new Date().toISOString();

    for (let i = 0; i < bundle.quantity; i++) {
      const giftCode = generateCustomGiftCode(customLabel, i + 1);

      await client.query(
        `INSERT INTO user_gift_subscriptions
         (owner_user_id, bundle_id, gift_code, custom_label, granted_by_admin_id, grant_reason, granted_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [userId, bundle.id, giftCode, customLabel, adminId || null, grantReason || null, now]
      );

      generatedCodes.push(giftCode);
    }

    await client.query('COMMIT');

    console.log(`[Admin] Generated ${bundle.quantity} gift codes for user ${userId} (${user.display_name})`);
    console.log(`[Admin] Custom label: ${customLabel}`);
    console.log(`[Admin] Reason: ${grantReason || 'Not specified'}`);

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${bundle.quantity} gift codes`,
      data: {
        userId: userId,
        displayName: user.display_name,
        bundleName: bundle.name,
        quantity: bundle.quantity,
        customLabel: customLabel,
        grantReason: grantReason,
        generatedCodes: generatedCodes
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Admin] Error generating gift codes:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    client.release();
  }
}
