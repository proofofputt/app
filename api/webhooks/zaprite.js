import pg from 'pg';
import crypto from 'crypto';
import { logWebhookEvent, logSubscriptionEvent, error as logError, warn as logWarn, critical as logCritical } from '../../utils/logger.js';
import { isProduction } from '../../utils/validate-env.js';

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

/**
 * Verify Zaprite webhook signature using timing-safe comparison
 */
function verifyZapriteSignature(payload, signature, secret) {
  if (!signature) {
    logWarn('Webhook signature missing from request');
    return false;
  }

  if (!secret) {
    logCritical('ZAPRITE_WEBHOOK_SECRET not configured', new Error('Missing webhook secret'));
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (error) {
    logError('Error verifying webhook signature', error);
    return false;
  }
}

/**
 * Extract player ID from Zaprite event metadata
 * Ensures consistent use of player_id across all event types
 */
function extractPlayerIdFromEvent(eventData) {
  // Priority 1: Check metadata.playerId (new consistent format)
  if (eventData.metadata && eventData.metadata.playerId) {
    return parseInt(eventData.metadata.playerId, 10);
  }

  // Priority 2: Check metadata.userId (legacy format)
  if (eventData.metadata && eventData.metadata.userId) {
    return parseInt(eventData.metadata.userId, 10);
  }

  // Priority 3: Check metadata.player_id (alternate format)
  if (eventData.metadata && eventData.metadata.player_id) {
    return parseInt(eventData.metadata.player_id, 10);
  }

  // Priority 4: Check customer.id if it's a player_id reference
  // Zaprite uses customerId as player_id in our system
  if (eventData.customerId && !isNaN(eventData.customerId)) {
    return parseInt(eventData.customerId, 10);
  }

  if (eventData.customer && eventData.customer.id && !isNaN(eventData.customer.id)) {
    return parseInt(eventData.customer.id, 10);
  }

  // Priority 5: Check customer metadata
  if (eventData.customer && eventData.customer.metadata) {
    if (eventData.customer.metadata.playerId) {
      return parseInt(eventData.customer.metadata.playerId, 10);
    }
    if (eventData.customer.metadata.player_id) {
      return parseInt(eventData.customer.metadata.player_id, 10);
    }
  }

  // If no player_id found, will need to match by email
  return null;
}

/**
 * Find player by email if player_id not in metadata
 */
async function findPlayerByEmail(email) {
  if (!email) return null;

  const query = 'SELECT player_id FROM players WHERE email = $1 LIMIT 1';
  const result = await pool.query(query, [email.toLowerCase()]);

  return result.rows[0]?.player_id || null;
}

/**
 * Map Zaprite subscription tier to Proof of Putt tier
 */
function mapZapriteTierToApp(zapriteProductId) {
  const tierMapping = {
    [process.env.ZAPRITE_PLAN_BASIC]: 'basic',
    [process.env.ZAPRITE_PLAN_PREMIUM]: 'premium',
    [process.env.ZAPRITE_PLAN_FULL]: 'full_subscriber'
  };

  return tierMapping[zapriteProductId] || 'full_subscriber';
}

/**
 * Calculate subscription period end based on billing cycle
 */
function calculatePeriodEnd(billingCycle, metadata) {
  const now = new Date();

  // Check metadata for interval if billing cycle not provided
  const interval = billingCycle || metadata?.interval || 'monthly';

  if (interval === 'annual' || interval === 'yearly') {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  } else {
    // Default to monthly
    return new Date(now.setMonth(now.getMonth() + 1));
  }
}

/**
 * Store webhook event in database for audit trail and idempotency
 */
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

/**
 * Check if order is a bundle purchase by looking up payment link
 */
async function checkForBundlePurchase(eventData) {
  try {
    // Try to extract payment link ID from various possible locations in event data
    const paymentLinkId =
      eventData.payment_link?.id ||
      eventData.payment_link_id ||
      eventData.checkout?.payment_link_id ||
      eventData.metadata?.payment_link_id;

    if (!paymentLinkId) {
      return null;
    }

    // Look up bundle configuration from mapping table
    const result = await pool.query(
      `SELECT bundle_id, bundle_name, bundle_quantity, bundle_price
       FROM zaprite_payment_link_bundles
       WHERE payment_link_id = $1 AND is_active = TRUE`,
      [paymentLinkId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return null;
  } catch (error) {
    logError('Error checking for bundle purchase', error);
    return null;
  }
}

/**
 * Check if order is a subscription purchase by looking up payment link
 */
async function checkForSubscriptionPurchase(eventData) {
  try {
    // Try to extract payment link ID from various possible locations in event data
    const paymentLinkId =
      eventData.payment_link?.id ||
      eventData.payment_link_id ||
      eventData.checkout?.payment_link_id ||
      eventData.metadata?.payment_link_id;

    if (!paymentLinkId) {
      return null;
    }

    // Look up subscription configuration from mapping table
    const result = await pool.query(
      `SELECT subscription_type, amount, billing_cycle, includes_gift
       FROM zaprite_subscription_links
       WHERE payment_link_id = $1 AND is_active = TRUE`,
      [paymentLinkId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return null;
  } catch (error) {
    logError('Error checking for subscription purchase', error);
    return null;
  }
}

/**
 * Handle order.paid event - Activate subscription
 */
async function handleOrderPaid(playerId, eventData) {
  const subscriptionId = eventData.subscription?.id || eventData.order?.subscription_id || eventData.id;
  const customerId = eventData.customer?.id || playerId.toString();
  const paymentMethod = eventData.payment_method || 'unknown';
  const productId = eventData.product?.id || eventData.items?.[0]?.product_id;

  // Extract payment profile ID for auto-pay (saved payment method)
  const paymentProfileId = eventData.paymentProfile?.id ||
                           eventData.payment_profile_id ||
                           eventData.paymentProfileId ||
                           null;

  // Check if this is a bundle purchase via payment link
  const bundleInfo = await checkForBundlePurchase(eventData);

  // Check if this is a subscription purchase via payment link
  const subscriptionInfo = await checkForSubscriptionPurchase(eventData);

  // Determine billing cycle and tier
  let billingCycle = eventData.billing_cycle || eventData.subscription?.billing_cycle || eventData.metadata?.interval;
  let tier = mapZapriteTierToApp(productId);
  let includesGift = false;

  // Override with payment link subscription info if available
  if (subscriptionInfo) {
    billingCycle = subscriptionInfo.billing_cycle;
    includesGift = subscriptionInfo.includes_gift;
    tier = 'full_subscriber';  // All subscription links are full subscriber

    logSubscriptionEvent('subscription_purchased_via_link', {
      playerId,
      paymentLinkType: subscriptionInfo.subscription_type,
      billingCycle,
      amount: subscriptionInfo.amount
    });
  }

  const periodEnd = calculatePeriodEnd(billingCycle, eventData.metadata);

  // Only update subscription status if NOT a bundle purchase
  // Bundles don't activate subscriptions, they just generate gift codes
  if (!bundleInfo) {
    const query = `
      UPDATE players
      SET
        zaprite_customer_id = $1,
        zaprite_subscription_id = $2,
        zaprite_payment_method = $3,
        zaprite_payment_profile_id = $4,
        subscription_status = 'active',
        subscription_tier = $5,
        subscription_billing_cycle = $6,
        subscription_started_at = COALESCE(subscription_started_at, NOW()),
        subscription_current_period_start = NOW(),
        subscription_current_period_end = $7,
        subscription_cancel_at_period_end = FALSE,
        is_subscribed = TRUE,
        membership_tier = 'premium',
        updated_at = NOW()
      WHERE player_id = $8
    `;

    await pool.query(query, [
      customerId,
      subscriptionId,
      paymentMethod,
      paymentProfileId,  // Store payment profile for auto-pay
      tier,
      billingCycle || 'monthly',
      periodEnd,
      playerId
    ]);

    logSubscriptionEvent('subscription_activated', {
      playerId,
      tier,
      billingCycle,
      periodEnd,
      subscriptionId
    });
  }

  // Generate gift codes based on purchase type
  if (bundleInfo) {
    // Bundle purchase - generate gift codes based on bundle quantity
    logSubscriptionEvent('bundle_purchased', {
      playerId,
      bundleId: bundleInfo.bundle_id,
      bundleName: bundleInfo.bundle_name,
      quantity: bundleInfo.bundle_quantity,
      price: bundleInfo.bundle_price
    });
    await generateGiftCodes(playerId, bundleInfo.bundle_quantity, bundleInfo.bundle_id);
  } else {
    // Check if subscription includes gift codes
    const metadata = eventData.metadata || {};
    if (metadata.type === 'bundle' && metadata.bundleQuantity) {
      const quantity = parseInt(metadata.bundleQuantity, 10);
      await generateGiftCodes(playerId, quantity);
    } else if (includesGift || metadata.includesGift === 'true' || billingCycle === 'annual') {
      await generateGiftCodes(playerId, 1);
    }
  }
}

/**
 * Generate gift codes for user
 */
async function generateGiftCodes(playerId, quantity, bundleId = null) {
  for (let i = 0; i < quantity; i++) {
    const giftCode = `GIFT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    await pool.query(
      `INSERT INTO user_gift_subscriptions (
        owner_user_id,
        gift_code,
        bundle_id,
        is_redeemed,
        created_at
      ) VALUES ($1, $2, $3, FALSE, NOW())`,
      [playerId, giftCode, bundleId]
    );

    logSubscriptionEvent('gift_code_generated', {
      playerId,
      giftCode,
      bundleId
    });
  }
}

/**
 * Handle subscription.created event
 */
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

  logSubscriptionEvent('subscription_created', {
    playerId,
    subscriptionId
  });
}

/**
 * Handle subscription.renewed event
 */
async function handleSubscriptionRenewed(playerId, eventData) {
  const billingCycle = eventData.billing_cycle || eventData.subscription?.billing_cycle || eventData.metadata?.interval;
  const periodEnd = calculatePeriodEnd(billingCycle, eventData.metadata);

  const query = `
    UPDATE players
    SET
      subscription_current_period_start = NOW(),
      subscription_current_period_end = $1,
      subscription_cancel_at_period_end = FALSE,
      subscription_status = 'active',
      is_subscribed = TRUE,
      updated_at = NOW()
    WHERE player_id = $2
  `;

  await pool.query(query, [periodEnd, playerId]);

  logSubscriptionEvent('subscription_renewed', {
    playerId,
    periodEnd
  });
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(playerId, eventData) {
  const query = `
    UPDATE players
    SET
      subscription_cancel_at_period_end = TRUE,
      updated_at = NOW()
    WHERE player_id = $1
  `;

  await pool.query(query, [playerId]);

  logSubscriptionEvent('subscription_canceled', {
    playerId
  });
}

/**
 * Handle subscription.expired event
 */
async function handleSubscriptionExpired(playerId, eventData) {
  const query = `
    UPDATE players
    SET
      subscription_status = 'canceled',
      subscription_tier = NULL,
      is_subscribed = FALSE,
      updated_at = NOW()
    WHERE player_id = $1
  `;

  await pool.query(query, [playerId]);

  logSubscriptionEvent('subscription_expired', {
    playerId
  });
}

/**
 * Handle invoice.paid event (for recurring invoices)
 * This is triggered when a recurring monthly invoice is successfully paid
 * Also used when auto-pay succeeds with /v1/order/charge
 */
async function handleInvoicePaid(playerId, eventData) {
  const subscriptionId = eventData.subscription?.id || eventData.invoice?.subscription_id;
  const customerId = eventData.customer?.id || eventData.customerId;
  const paymentMethod = eventData.payment_method || 'square'; // Default to Square for monthly recurring
  const billingCycle = eventData.billing_cycle || eventData.metadata?.interval || 'monthly';

  // Extract payment profile ID for auto-pay (saved payment method)
  const paymentProfileId = eventData.paymentProfile?.id ||
                           eventData.payment_profile_id ||
                           eventData.paymentProfileId ||
                           null;

  // Extend subscription period for recurring payment
  const periodEnd = calculatePeriodEnd(billingCycle, eventData.metadata);

  const query = `
    UPDATE players
    SET
      zaprite_customer_id = $1,
      zaprite_subscription_id = $2,
      zaprite_payment_method = $3,
      zaprite_payment_profile_id = COALESCE($4, zaprite_payment_profile_id),
      subscription_status = 'active',
      subscription_tier = 'full_subscriber',
      subscription_billing_cycle = $5,
      subscription_started_at = COALESCE(subscription_started_at, NOW()),
      subscription_current_period_start = NOW(),
      subscription_current_period_end = $6,
      subscription_cancel_at_period_end = FALSE,
      is_subscribed = TRUE,
      updated_at = NOW()
    WHERE player_id = $7
  `;

  await pool.query(query, [
    customerId,
    subscriptionId,
    paymentMethod,
    paymentProfileId,  // Update payment profile if provided, keep existing if null
    billingCycle,
    periodEnd,
    playerId
  ]);

  logSubscriptionEvent('recurring_invoice_paid', {
    playerId,
    billingCycle,
    periodEnd,
    subscriptionId,
    paymentMethod
  });
}

/**
 * Handle invoice.payment_failed event (for recurring invoices)
 * This is triggered when a recurring payment fails
 */
async function handleInvoicePaymentFailed(playerId, eventData) {
  const query = `
    UPDATE players
    SET
      subscription_status = 'past_due',
      updated_at = NOW()
    WHERE player_id = $1
  `;

  await pool.query(query, [playerId]);

  logSubscriptionEvent('recurring_payment_failed', {
    playerId,
    reason: eventData.failure_reason || 'unknown'
  });

  // TODO: Send email notification to user about failed payment
}

/**
 * Handle invoice.created event (for recurring invoices)
 * This is triggered when a new recurring invoice is generated
 */
async function handleInvoiceCreated(playerId, eventData) {
  logSubscriptionEvent('recurring_invoice_created', {
    playerId,
    invoiceId: eventData.id,
    amount: eventData.amount
  });

  // TODO: Send email notification to user about upcoming charge
}

/**
 * Process webhook event and update subscription
 */
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
    // One-time order/payment events
    case 'order.paid':
    case 'payment.succeeded':
      await handleOrderPaid(playerId, eventData);
      break;

    // Recurring invoice events (for monthly subscriptions)
    case 'invoice.paid':
    case 'recurring_invoice.paid':
      await handleInvoicePaid(playerId, eventData);
      break;

    case 'invoice.payment_failed':
    case 'recurring_invoice.payment_failed':
    case 'payment.failed':
      await handleInvoicePaymentFailed(playerId, eventData);
      break;

    case 'invoice.created':
    case 'recurring_invoice.created':
      await handleInvoiceCreated(playerId, eventData);
      break;

    // Subscription lifecycle events
    case 'subscription.created':
      await handleSubscriptionCreated(playerId, eventData);
      break;

    case 'subscription.renewed':
    case 'subscription.updated':
      await handleSubscriptionRenewed(playerId, eventData);
      break;

    case 'subscription.canceled':
    case 'subscription.cancelled':
      await handleSubscriptionCanceled(playerId, eventData);
      break;

    case 'subscription.expired':
    case 'subscription.ended':
      await handleSubscriptionExpired(playerId, eventData);
      break;

    default:
      logWarn(`Unhandled webhook event type: ${eventType}`, { eventType, eventId });
  }

  // Mark event as processed
  await pool.query(
    'UPDATE zaprite_events SET processed = TRUE, processed_at = NOW() WHERE event_id = $1',
    [eventId]
  );
}

/**
 * Main webhook handler
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['x-zaprite-signature'] || req.headers['zaprite-signature'];
    const webhookSecret = process.env.ZAPRITE_WEBHOOK_SECRET;

    // ENFORCE signature verification in production
    if (isProduction() && !webhookSecret) {
      logCritical('Webhook secret not configured in production', new Error('Missing ZAPRITE_WEBHOOK_SECRET'));
      return res.status(500).json({ error: 'Webhook not properly configured' });
    }

    // Verify webhook signature
    if (webhookSecret) {
      const isValid = verifyZapriteSignature(req.body, signature, webhookSecret);
      if (!isValid) {
        logCritical('Invalid webhook signature detected - possible security breach', new Error('Invalid signature'), {
          hasSignature: !!signature,
          hasSecret: !!webhookSecret
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else if (isProduction()) {
      // In production without secret, reject the webhook
      logCritical('Production webhook received without signature verification', new Error('No webhook secret'));
      return res.status(500).json({ error: 'Webhook security not configured' });
    }

    const eventData = req.body;

    logWebhookEvent(eventData.type || 'unknown', eventData.id || 'unknown', {
      customer: eventData.customer?.id,
      amount: eventData.amount || eventData.amount_paid
    });

    // Check for duplicate event (idempotency)
    const duplicateCheck = await pool.query(
      'SELECT event_id FROM zaprite_events WHERE zaprite_event_id = $1',
      [eventData.id]
    );

    if (duplicateCheck.rows.length > 0) {
      logWarn('Duplicate webhook event received, ignoring', {
        eventId: eventData.id,
        eventType: eventData.type
      });
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Store event in database
    const eventId = await storeWebhookEvent(eventData, signature);

    // Process event asynchronously (don't block webhook response)
    processWebhookEvent(eventId, eventData).catch(error => {
      logError('Error processing webhook event', error, {
        eventId,
        eventType: eventData.type
      });
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
    logError('Webhook handler error', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
}
