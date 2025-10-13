import pg from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  createZapriteOrder,
  createZapriteOrderCharge,
  extractCheckoutUrl,
  extractOrderId,
  ZapriteApiError
} from '../../utils/zaprite-client.js';
import { logApiRequest, logApiResponse, logPaymentEvent, createRequestLogger } from '../../utils/logger.js';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Zaprite Custom Checkout ID for monthly subscriptions with auto-pay
const ZAPRITE_CUSTOM_CHECKOUT_ID = 'cmgoepfh00001kv04t7a0mvdk';

// Pricing Configuration
const PRICING = {
  monthly: {
    amount: 2.10,
    interval: 'monthly',
    description: 'Proof of Putt Monthly Subscription'
  },
  annual: {
    amount: 21.00,
    interval: 'annual',
    description: 'Proof of Putt Annual Subscription (includes 1 free year gift)'
  }
};

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();
  const logger = createRequestLogger(requestId);

  if (req.method !== 'POST') {
    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 405, { requestId });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  logApiRequest('/api/subscriptions/create-zaprite-order', 'POST', { requestId });

  // Authenticate user
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 401, {
      requestId,
      reason: 'missing_auth_header'
    });
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId || decoded.playerId || decoded.id;
    logger.info('User authenticated', { userId });
  } catch (error) {
    logger.error('JWT verification failed', error);
    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 401, {
      requestId,
      reason: 'invalid_jwt'
    });
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  const { interval } = req.body; // 'monthly' or 'annual'

  if (!interval || !['monthly', 'annual'].includes(interval)) {
    logger.warn('Invalid interval provided', { interval });
    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 400, {
      requestId,
      userId,
      reason: 'invalid_interval'
    });
    return res.status(400).json({ error: 'Invalid interval. Must be "monthly" or "annual"' });
  }

  try {
    // Get user details
    const userResult = await pool.query(
      'SELECT player_id, display_name, email FROM players WHERE player_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      logger.warn('User not found in database', { userId });
      logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 404, {
        requestId,
        userId,
        reason: 'user_not_found'
      });
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const pricing = PRICING[interval];

    logger.info('Processing subscription order', {
      userId: user.player_id,
      interval,
      amount: pricing.amount
    });

    // Create Zaprite Order or Recurring Invoice
    const basePayload = {
      customerId: user.player_id.toString(),  // Always use player_id for customer reference
      customerEmail: user.email,
      customerName: user.display_name || `Player ${user.player_id}`,
      amount: pricing.amount,
      currency: 'USD',
      description: pricing.description,
      metadata: {
        userId: user.player_id.toString(),
        playerId: user.player_id.toString(),  // Explicit player_id reference
        userEmail: user.email,
        displayName: user.display_name || 'Anonymous',
        interval: interval,
        includesGift: interval === 'annual' ? 'true' : 'false',
        subscriptionType: 'proof-of-putt',
        requestId
      },
      successUrl: `${process.env.FRONTEND_URL}/subscription/success?session_id={ORDER_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/settings?canceled=true`
    };

    logPaymentEvent('subscription_order_initiated', {
      userId: user.player_id,
      interval,
      amount: pricing.amount,
      requestId
    });

    // Use Zaprite client with retry logic
    let zapriteData;
    try {
      if (interval === 'monthly') {
        // For monthly subscriptions, use custom checkout for auto-pay
        // This creates the first order and allows customer to save their payment method
        // Note: Custom checkouts have pre-configured URLs, so we don't pass successUrl/cancelUrl
        const { successUrl, cancelUrl, ...basePayloadWithoutUrls } = basePayload;

        const monthlyPayload = {
          ...basePayloadWithoutUrls,
          customCheckoutId: ZAPRITE_CUSTOM_CHECKOUT_ID  // Custom checkout configured for Square auto-pay
        };

        logger.info('Creating order with custom checkout for monthly subscription', {
          userId: user.player_id,
          amount: pricing.amount,
          customCheckoutId: ZAPRITE_CUSTOM_CHECKOUT_ID,
          payloadKeys: Object.keys(monthlyPayload)
        });

        // Log the exact payload being sent (without sensitive data)
        console.log('[Zaprite Monthly Order] Payload structure:', {
          ...monthlyPayload,
          metadata: '... (see below)',
          metadataKeys: Object.keys(monthlyPayload.metadata || {})
        });

        zapriteData = await createZapriteOrder(monthlyPayload);
      } else {
        // For annual subscriptions, use one-time order (lifetime early adopter)
        logger.info('Creating one-time order for annual subscription', {
          userId: user.player_id,
          amount: pricing.amount
        });

        zapriteData = await createZapriteOrder(basePayload);
      }
    } catch (zapriteError) {
      if (zapriteError instanceof ZapriteApiError) {
        logger.error('Zaprite API error', zapriteError, {
          statusCode: zapriteError.statusCode,
          response: zapriteError.response,
          message: zapriteError.message,
          interval,
          customCheckoutId: interval === 'monthly' ? ZAPRITE_CUSTOM_CHECKOUT_ID : null
        });

        // Log full error details for debugging
        console.error('[Zaprite Error Details]', {
          statusCode: zapriteError.statusCode,
          message: zapriteError.message,
          response: JSON.stringify(zapriteError.response, null, 2),
          interval,
          userId: user.player_id
        });

        logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 500, {
          requestId,
          userId: user.player_id,
          reason: 'zaprite_api_error',
          zapriteStatus: zapriteError.statusCode,
          zapriteMessage: zapriteError.message
        });

        return res.status(500).json({
          error: 'Failed to create order',
          details: zapriteError.message,
          status: zapriteError.statusCode,
          zapriteResponse: zapriteError.response
        });
      }
      throw zapriteError; // Re-throw if not a Zaprite API error
    }

    // Store order in database for tracking
    const orderId = extractOrderId(zapriteData);
    const eventType = 'order.created';  // Both monthly and annual use regular orders

    await pool.query(
      `INSERT INTO zaprite_payment_events (
        player_id,
        event_type,
        event_id,
        raw_event,
        status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        user.player_id,
        eventType,
        orderId || `${interval}_${Date.now()}`,
        JSON.stringify({
          interval,
          amount: pricing.amount,
          isRecurring: interval === 'monthly',
          usesCustomCheckout: interval === 'monthly',  // Monthly uses custom checkout for auto-pay
          customCheckoutId: interval === 'monthly' ? ZAPRITE_CUSTOM_CHECKOUT_ID : null,
          orderData: zapriteData,
          requestId,
          playerId: user.player_id  // Ensure player_id is stored in raw_event
        }),
        'pending'
      ]
    );

    // Extract checkout URL from response
    const checkoutUrl = extractCheckoutUrl(zapriteData);

    if (!checkoutUrl) {
      logger.error('No checkout URL in Zaprite response', null, { zapriteData });
      logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 500, {
        requestId,
        userId: user.player_id,
        reason: 'missing_checkout_url'
      });
      return res.status(500).json({
        error: 'No checkout URL received from Zaprite',
        orderData: zapriteData
      });
    }

    logPaymentEvent('subscription_order_created', {
      userId: user.player_id,
      interval,
      orderId,
      checkoutUrl,
      requestId
    });

    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 200, {
      requestId,
      userId: user.player_id,
      interval,
      orderId
    });

    res.status(200).json({
      success: true,
      checkoutUrl: checkoutUrl,
      orderId: orderId,
      interval: interval,
      amount: pricing.amount,
      currency: 'USD',
      isRecurring: interval === 'monthly',
      includesGift: interval === 'annual',
      playerId: user.player_id  // Return player_id for frontend reference
    });

  } catch (error) {
    logger.error('Error creating Zaprite order', error);
    logApiResponse('/api/subscriptions/create-zaprite-order', 'POST', 500, {
      requestId,
      userId,
      reason: 'internal_error',
      error: error.message
    });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
