import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../../../utils/cors.js';
import crypto from 'crypto';
import { createZapriteOrder, extractCheckoutUrl, extractOrderId, ZapriteApiError } from '../../../utils/zaprite-client.js';
import { logApiRequest, logApiResponse, logPaymentEvent, error as logError, createRequestLogger } from '../../../utils/logger.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Bundle pricing - matches frontend
const BUNDLE_PRICING = {
  1: { quantity: 3, price: 56.70, discount: 10 },
  2: { quantity: 5, price: 84, discount: 21 },
  3: { quantity: 10, price: 121, discount: 42 },
  4: { quantity: 21, price: 221, discount: 50 }
};

function generateGiftCode() {
  return `GIFT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId);

  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 405, { requestId });
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  logApiRequest('/api/subscriptions/bundles/purchase', 'POST', { requestId });

  const { bundleId } = req.body;

  // Get user from auth token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 401, {
      requestId,
      reason: 'missing_auth_header'
    });
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    // Verify JWT token
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          logger.warn('JWT verification failed', { error: err.message, tokenPresent: !!token });
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  } catch (jwtError) {
    logger.error('JWT verification error', jwtError, {
      requestId,
      errorName: jwtError.name,
      errorMessage: jwtError.message
    });
    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 401, {
      requestId,
      reason: 'jwt_verification_failed',
      error: jwtError.message
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      error: process.env.NODE_ENV === 'development' ? jwtError.message : undefined
    });
  }

  if (!decoded || (!decoded.playerId && !decoded.userId && !decoded.id)) {
    logger.warn('JWT decoded but missing player ID', { decoded });
    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 401, {
      requestId,
      reason: 'missing_player_id'
    });
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }

  // Support different ID field names
  const playerId = decoded.playerId || decoded.userId || decoded.id;

  try {

    // Get user details from database
    const userResult = await pool.query(
      'SELECT player_id, email, display_name FROM players WHERE player_id = $1',
      [playerId]
    );

    if (userResult.rows.length === 0) {
      logger.warn('User not found');
      logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 401, {
        requestId,
        reason: 'user_not_found'
      });
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];
    logger.info('User authenticated', { userId: user.player_id, email: user.email });

    // Get bundle details
    const bundle = BUNDLE_PRICING[bundleId];
    if (!bundle) {
      logger.warn('Invalid bundle ID requested', { bundleId });
      logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 400, {
        requestId,
        userId: user.player_id,
        reason: 'invalid_bundle_id'
      });
      return res.status(400).json({ success: false, message: 'Invalid bundle ID' });
    }

    logger.info('Processing bundle purchase', {
      userId: user.player_id,
      bundleId,
      quantity: bundle.quantity,
      price: bundle.price
    });

    // Create Zaprite order for bundle purchase
    const orderPayload = {
      customerId: user.player_id.toString(),
      customerEmail: user.email,
      customerName: `Player ${user.player_id}`,
      amount: bundle.price,
      currency: 'USD',
      description: `Proof of Putt ${bundle.quantity}-Pack Bundle - ${bundle.quantity} Year Subscriptions`,
      metadata: {
        userId: user.player_id.toString(),
        userEmail: user.email,
        displayName: user.display_name || 'Anonymous',
        bundleId: bundleId.toString(),
        bundleQuantity: bundle.quantity.toString(),
        type: 'bundle',
        requestId
      }
    };

    logPaymentEvent('bundle_purchase_initiated', {
      userId: user.player_id,
      bundleId,
      amount: bundle.price,
      requestId
    });

    // Use Zaprite client with retry logic
    let zapriteData;
    try {
      zapriteData = await createZapriteOrder(orderPayload);
    } catch (zapriteError) {
      if (zapriteError instanceof ZapriteApiError) {
        logger.error('Zaprite API error', zapriteError, {
          statusCode: zapriteError.statusCode,
          response: zapriteError.response
        });

        logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 500, {
          requestId,
          userId: user.player_id,
          reason: 'zaprite_api_error',
          zapriteStatus: zapriteError.statusCode
        });

        return res.status(500).json({
          success: false,
          message: `Failed to create payment order: ${zapriteError.message}`
        });
      }
      throw zapriteError; // Re-throw if not a Zaprite API error
    }

    // Extract checkout URL
    const checkoutUrl = extractCheckoutUrl(zapriteData);
    const orderId = extractOrderId(zapriteData);

    if (!checkoutUrl) {
      logger.error('No checkout URL in Zaprite response', null, { zapriteData });
      logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 500, {
        requestId,
        userId: user.player_id,
        reason: 'missing_checkout_url'
      });
      return res.status(500).json({
        success: false,
        message: 'Payment order created but no checkout URL received'
      });
    }

    logPaymentEvent('bundle_purchase_order_created', {
      userId: user.player_id,
      bundleId,
      orderId,
      checkoutUrl,
      requestId
    });

    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 200, {
      requestId,
      userId: user.player_id,
      bundleId,
      orderId
    });

    // Return checkout URL for redirect
    return res.status(200).json({
      success: true,
      checkoutUrl: checkoutUrl,
      orderId: orderId
    });

  } catch (error) {
    logger.error('Bundle purchase error', error);
    logApiResponse('/api/subscriptions/bundles/purchase', 'POST', 500, {
      requestId,
      reason: 'internal_error',
      error: error.message
    });
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}
