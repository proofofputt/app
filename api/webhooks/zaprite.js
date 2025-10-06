import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Zaprite Webhook Handler
 * Receives and processes subscription events from Zaprite
 *
 * Events supported:
 * - order.paid: Payment completed, activate subscription
 * - subscription.created: Subscription initiated
 * - subscription.renewed: Subscription renewed for new period
 * - subscription.canceled: User canceled subscription
 * - subscription.expired: Subscription period ended
 */

// Verify Zaprite webhook signature
function verifyZapriteSignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.warn('Missing signature or secret for webhook verification');
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Extract player ID from Zaprite event metadata
function extractPlayerIdFromEvent(eventData) {
  // Check for player_id in metadata (should be set during checkout creation)
  if (eventData.metadata && eventData.metadata.player_id) {
    return parseInt(eventData.metadata.player_id, 10);
  }

  // Check for player_id in customer metadata
  if (eventData.customer && eventData.customer.metadata && eventData.customer.metadata.player_id) {
    return parseInt(eventData.customer.metadata.player_id, 10);
  }

  // If no player_id found, try to match by email
  if (eventData.customer && eventData.customer.email) {
    // This will be handled asynchronously
    return null;
  }

  return null;
}

// Find player by email if player_id not in metadata
async function findPlayerByEmail(email) {
  if (!email) return null;

  const query = 'SELECT player_id FROM players WHERE email = $1 LIMIT 1';
  const result = await pool.query(query, [email.toLowerCase()]);

  return result.rows[0]?.player_id || null;
}

// Map Zaprite subscription tier to Proof of Putt tier
function mapZapriteTierToApp(zapriteProductId) {
  const tierMapping = {
    [process.env.ZAPRITE_PLAN_BASIC]: 'basic',
    [process.env.ZAPRITE_PLAN_PREMIUM]: 'premium',
    [process.env.ZAPRITE_PLAN_FULL]: 'full_subscriber'
  };

  return tierMapping[zapriteProductId] || 'basic';
}

// Calculate subscription period end based on billing cycle
function calculatePeriodEnd(billingCycle) {
  const now = new Date();

  if (billingCycle === 'annual' || billingCycle === 'yearly') {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  } else {
    // Default to monthly
    return new Date(now.setMonth(now.getMonth() + 1));
  }
}

// Store webhook event in database
async function storeWebhookEvent(eventData, signature) {
  const query = `
    INSERT INTO zaprite_events (
      zaprite_event_id,
      event_type,
      player_id,
      zaprite_customer_id,
      zaprite_subscription_id,
      zaprite_order_id,
      event_data,
      payment_amount,
      payment_currency,
      payment_method,
      processed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING event_id
  `;

  const playerId = extractPlayerIdFromEvent(eventData);

  const values = [
    eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventData.type || 'unknown',
    playerId,
    eventData.customer?.id || null,
    eventData.subscription?.id || null,
    eventData.order?.id || eventData.id || null,
    JSON.stringify(eventData),
    eventData.amount_paid || eventData.amount || null,
    eventData.currency || 'USD',
    eventData.payment_method || null,
    false // Will process after storing
  ];

  const result = await pool.query(query, values);
  return result.rows[0].event_id;
}

// Process webhook event and update subscription
async function processWebhookEvent(eventId, eventData) {
  let playerId = extractPlayerIdFromEvent(eventData);

  // If no player_id in metadata, try to find by email
  if (!playerId && eventData.customer?.email) {
    playerId = await findPlayerByEmail(eventData.customer.email);
  }

  if (!playerId) {
    throw new Error('Could not identify player from webhook event');
  }

  const eventType = eventData.type;

  switch (eventType) {
    case 'order.paid':
    case 'payment.succeeded':
      await handleOrderPaid(playerId, eventData);
      break;

    case 'subscription.created':
      await handleSubscriptionCreated(playerId, eventData);
      break;

    case 'subscription.renewed':
    case 'subscription.updated':
      await handleSubscriptionRenewed(playerId, eventData);
      break;

    case 'subscription.canceled':
      await handleSubscriptionCanceled(playerId, eventData);
      break;

    case 'subscription.expired':
    case 'subscription.ended':
      await handleSubscriptionExpired(playerId, eventData);
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  // Mark event as processed
  await pool.query(
    'UPDATE zaprite_events SET processed = TRUE, processed_at = NOW() WHERE event_id = $1',
    [eventId]
  );
}

// Handle order.paid event - Activate subscription
async function handleOrderPaid(playerId, eventData) {
  const subscriptionId = eventData.subscription?.id || eventData.order?.subscription_id;
  const customerId = eventData.customer?.id;
  const paymentMethod = eventData.payment_method || 'unknown';
  const productId = eventData.product?.id || eventData.items?.[0]?.product_id;
  const billingCycle = eventData.billing_cycle || eventData.subscription?.billing_cycle || 'monthly';

  const tier = mapZapriteTierToApp(productId);
  const periodEnd = calculatePeriodEnd(billingCycle);

  const query = `
    UPDATE players
    SET
      zaprite_customer_id = $1,
      zaprite_subscription_id = $2,
      zaprite_payment_method = $3,
      subscription_status = 'active',
      subscription_tier = $4,
      subscription_billing_cycle = $5,
      subscription_started_at = COALESCE(subscription_started_at, NOW()),
      subscription_current_period_start = NOW(),
      subscription_current_period_end = $6,
      subscription_cancel_at_period_end = FALSE,
      updated_at = NOW()
    WHERE player_id = $7
  `;

  await pool.query(query, [
    customerId,
    subscriptionId,
    paymentMethod,
    tier,
    billingCycle,
    periodEnd,
    playerId
  ]);

  console.log(`Activated subscription for player ${playerId}: ${tier} (${billingCycle})`);
}

// Handle subscription.created event
async function handleSubscriptionCreated(playerId, eventData) {
  const subscriptionId = eventData.subscription?.id || eventData.id;

  const query = `
    UPDATE players
    SET
      zaprite_subscription_id = $1,
      subscription_started_at = COALESCE(subscription_started_at, NOW()),
      updated_at = NOW()
    WHERE player_id = $2
  `;

  await pool.query(query, [subscriptionId, playerId]);

  console.log(`Created subscription ${subscriptionId} for player ${playerId}`);
}

// Handle subscription.renewed event
async function handleSubscriptionRenewed(playerId, eventData) {
  const billingCycle = eventData.billing_cycle || eventData.subscription?.billing_cycle || 'monthly';
  const periodEnd = calculatePeriodEnd(billingCycle);

  const query = `
    UPDATE players
    SET
      subscription_current_period_start = NOW(),
      subscription_current_period_end = $1,
      subscription_cancel_at_period_end = FALSE,
      subscription_status = 'active',
      updated_at = NOW()
    WHERE player_id = $2
  `;

  await pool.query(query, [periodEnd, playerId]);

  console.log(`Renewed subscription for player ${playerId} until ${periodEnd}`);
}

// Handle subscription.canceled event
async function handleSubscriptionCanceled(playerId, eventData) {
  const query = `
    UPDATE players
    SET
      subscription_cancel_at_period_end = TRUE,
      updated_at = NOW()
    WHERE player_id = $1
  `;

  await pool.query(query, [playerId]);

  console.log(`Marked subscription for cancellation for player ${playerId}`);
}

// Handle subscription.expired event
async function handleSubscriptionExpired(playerId, eventData) {
  const query = `
    UPDATE players
    SET
      subscription_status = 'canceled',
      subscription_tier = NULL,
      updated_at = NOW()
    WHERE player_id = $1
  `;

  await pool.query(query, [playerId]);

  console.log(`Expired subscription for player ${playerId}`);
}

// Main webhook handler
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-zaprite-signature'] || req.headers['zaprite-signature'];
    const webhookSecret = process.env.ZAPRITE_WEBHOOK_SECRET;

    // Verify webhook signature
    if (webhookSecret && !verifyZapriteSignature(req.body, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventData = req.body;

    console.log('Received Zaprite webhook:', {
      type: eventData.type,
      id: eventData.id,
      customer: eventData.customer?.id
    });

    // Check for duplicate event (idempotency)
    const duplicateCheck = await pool.query(
      'SELECT event_id FROM zaprite_events WHERE zaprite_event_id = $1',
      [eventData.id]
    );

    if (duplicateCheck.rows.length > 0) {
      console.log('Duplicate webhook event, ignoring');
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Store event in database
    const eventId = await storeWebhookEvent(eventData, signature);

    // Process event asynchronously (don't block webhook response)
    processWebhookEvent(eventId, eventData).catch(error => {
      console.error('Error processing webhook event:', error);
      pool.query(
        'UPDATE zaprite_events SET processing_error = $1, retry_count = retry_count + 1 WHERE event_id = $2',
        [error.message, eventId]
      );
    });

    // Return success immediately (webhook acknowledged)
    res.status(200).json({
      received: true,
      event_id: eventId
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
}
