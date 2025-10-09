import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Zaprite configuration
const ZAPRITE_API_KEY = process.env.ZAPRITE_API_KEY;
const ZAPRITE_ORG_ID = process.env.ZAPRITE_ORG_ID;
const ZAPRITE_BASE_URL = process.env.ZAPRITE_BASE_URL || 'https://api.zaprite.com';

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
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { bundleId } = req.body;

  // Get user from auth token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    // Verify token and get user
    const userResult = await pool.query(
      'SELECT player_id, email, display_name FROM players WHERE player_id = (SELECT player_id FROM sessions WHERE token = $1 LIMIT 1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    const user = userResult.rows[0];

    // Get bundle details
    const bundle = BUNDLE_PRICING[bundleId];
    if (!bundle) {
      return res.status(400).json({ success: false, message: 'Invalid bundle ID' });
    }

    // Create Zaprite order for bundle purchase
    const orderPayload = {
      organizationId: ZAPRITE_ORG_ID,
      customerId: user.player_id.toString(),
      customerEmail: user.email,
      customerName: user.display_name,
      amount: bundle.price,
      currency: 'USD',
      description: `Proof of Putt ${bundle.quantity}-Pack Bundle - ${bundle.quantity} Year Subscriptions`,
      metadata: {
        userId: user.player_id.toString(),
        displayName: user.display_name,
        bundleId: bundleId.toString(),
        bundleQuantity: bundle.quantity.toString(),
        type: 'bundle'
      }
    };

    console.log('Creating Zaprite order:', orderPayload);

    const zapriteResponse = await fetch(`${ZAPRITE_BASE_URL}/v1/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAPRITE_API_KEY}`
      },
      body: JSON.stringify(orderPayload)
    });

    const zapriteData = await zapriteResponse.json();

    console.log('Zaprite response status:', zapriteResponse.status);
    console.log('Zaprite response data:', zapriteData);

    if (!zapriteResponse.ok) {
      console.error('Zaprite API error:', zapriteData);
      return res.status(500).json({
        success: false,
        message: `Failed to create payment order: ${zapriteData.message || 'Unknown error'}`
      });
    }

    // Check multiple possible field names for checkout URL
    const checkoutUrl = zapriteData.checkoutUrl ||
                       zapriteData.checkout_url ||
                       zapriteData.url ||
                       zapriteData.paymentUrl ||
                       zapriteData.payment_url;

    if (!checkoutUrl) {
      console.error('No checkout URL found in Zaprite response:', zapriteData);
      return res.status(500).json({
        success: false,
        message: 'Payment order created but no checkout URL received'
      });
    }

    console.log('Returning checkout URL:', checkoutUrl);

    // Return checkout URL for redirect
    return res.status(200).json({
      success: true,
      checkoutUrl: checkoutUrl,
      orderId: zapriteData.id
    });

  } catch (error) {
    console.error('Bundle purchase error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}
