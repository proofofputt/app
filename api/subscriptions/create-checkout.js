import pg from 'pg';
import jwt from 'jsonwebtoken';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Create Zaprite Checkout Session
 * Generates a payment link for subscription purchase
 *
 * POST /api/subscriptions/create-checkout
 * Body: {
 *   tier: 'basic' | 'premium' | 'full_subscriber',
 *   billing_cycle: 'monthly' | 'annual'
 * }
 * Headers: {
 *   Authorization: Bearer <jwt_token>
 * }
 */

// Get player from JWT token
async function getPlayerFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const playerId = decoded.player_id;

  const query = 'SELECT * FROM players WHERE player_id = $1';
  const result = await pool.query(query, [playerId]);

  if (result.rows.length === 0) {
    throw new Error('Player not found');
  }

  return result.rows[0];
}

// Get Zaprite plan ID for tier
function getZapritePlanId(tier, billingCycle) {
  const envKey = `ZAPRITE_PLAN_${tier.toUpperCase()}${billingCycle === 'annual' ? '_ANNUAL' : ''}`;
  const planId = process.env[envKey];

  if (!planId) {
    // Fallback to monthly plan ID
    const monthlyKey = `ZAPRITE_PLAN_${tier.toUpperCase()}`;
    return process.env[monthlyKey];
  }

  return planId;
}

// Get pricing for tier
function getPricing(tier, billingCycle) {
  const pricing = {
    basic: {
      monthly: { amount: 4.99, currency: 'USD' },
      annual: { amount: 49.99, currency: 'USD' }
    },
    premium: {
      monthly: { amount: 9.99, currency: 'USD' },
      annual: { amount: 99.99, currency: 'USD' }
    },
    full_subscriber: {
      monthly: { amount: 29.99, currency: 'USD' },
      annual: { amount: 299.99, currency: 'USD' }
    }
  };

  return pricing[tier]?.[billingCycle] || pricing.basic.monthly;
}

// Create Zaprite payment link via API
async function createZapriteCheckout(player, tier, billingCycle) {
  const zapriteApiKey = process.env.ZAPRITE_API_KEY;
  const zapriteOrgId = process.env.ZAPRITE_ORG_ID || 'cmgbcd9d80008l104g3tasx06';

  if (!zapriteApiKey) {
    throw new Error('ZAPRITE_API_KEY not configured');
  }

  const planId = getZapritePlanId(tier, billingCycle);
  const pricing = getPricing(tier, billingCycle);

  // Construct return URLs
  const baseUrl = process.env.FRONTEND_URL || 'https://app.proofofputt.com';
  const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/subscribe`;

  // Create order/checkout via Zaprite API
  const checkoutData = {
    organizationId: zapriteOrgId,
    customer: {
      email: player.email,
      name: player.username || player.email,
      metadata: {
        player_id: player.player_id.toString(),
        tier: tier,
        billing_cycle: billingCycle
      }
    },
    items: [
      {
        name: `Proof of Putt - ${tier.replace('_', ' ').toUpperCase()}`,
        description: `${billingCycle === 'annual' ? 'Annual' : 'Monthly'} subscription`,
        amount: pricing.amount,
        currency: pricing.currency,
        quantity: 1
      }
    ],
    metadata: {
      player_id: player.player_id.toString(),
      subscription_tier: tier,
      billing_cycle: billingCycle
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_methods: ['bitcoin', 'lightning', 'card'] // Enable all payment methods
  };

  // Make API request to Zaprite
  try {
    const response = await fetch('https://api.zaprite.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${zapriteApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zaprite API error:', errorText);
      throw new Error(`Zaprite API error: ${response.status} ${response.statusText}`);
    }

    const checkoutSession = await response.json();

    return {
      checkout_url: checkoutSession.url || checkoutSession.checkout_url,
      session_id: checkoutSession.id,
      expires_at: checkoutSession.expires_at
    };

  } catch (error) {
    console.error('Error creating Zaprite checkout:', error);
    throw error;
  }
}

// Main handler
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const player = await getPlayerFromToken(req);

    // Validate request body
    const { tier, billing_cycle } = req.body;

    if (!tier || !['basic', 'premium', 'full_subscriber'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        message: 'Tier must be: basic, premium, or full_subscriber'
      });
    }

    if (!billing_cycle || !['monthly', 'annual'].includes(billing_cycle)) {
      return res.status(400).json({
        error: 'Invalid billing cycle',
        message: 'Billing cycle must be: monthly or annual'
      });
    }

    // Check if player already has active subscription
    if (player.subscription_status === 'active' && !player.subscription_cancel_at_period_end) {
      // Allow upgrade/downgrade by creating new checkout
      console.log(`Player ${player.player_id} has active subscription, allowing change`);
    }

    // Create Zaprite checkout session
    const checkout = await createZapriteCheckout(player, tier, billing_cycle);

    // Log checkout creation
    console.log(`Created checkout for player ${player.player_id}: ${tier} (${billing_cycle})`);

    // Return checkout URL
    res.status(200).json({
      success: true,
      checkout_url: checkout.checkout_url,
      session_id: checkout.session_id,
      expires_at: checkout.expires_at,
      tier,
      billing_cycle
    });

  } catch (error) {
    console.error('Error creating checkout:', error);

    if (error.message.includes('token') || error.message.includes('Player not found')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    res.status(500).json({
      error: 'Failed to create checkout',
      message: error.message
    });
  }
}
