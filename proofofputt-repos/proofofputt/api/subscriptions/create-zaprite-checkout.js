import pg from 'pg';
import jwt from 'jsonwebtoken';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Pricing Configuration
const PRICING = {
  monthly: {
    amount: 2.10,
    interval: 'month',
    currency: 'USD'
  },
  annual: {
    amount: 21.00,
    interval: 'year',
    currency: 'USD'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId || decoded.id;
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  const { interval } = req.body; // 'monthly' or 'annual'

  if (!interval || !['monthly', 'annual'].includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval. Must be "monthly" or "annual"' });
  }

  try {
    // Get user details
    const userResult = await pool.query(
      'SELECT id, username, email FROM players WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const pricing = PRICING[interval];

    // Create Zaprite checkout session
    const zapriteResponse = await fetch(`${process.env.ZAPRITE_BASE_URL}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZAPRITE_API_KEY}`
      },
      body: JSON.stringify({
        organizationId: process.env.ZAPRITE_ORG_ID,
        planId: process.env.ZAPRITE_PLAN_ID,
        amount: pricing.amount,
        currency: pricing.currency,
        interval: pricing.interval,
        customer: {
          id: user.id.toString(),
          email: user.email,
          name: user.username
        },
        metadata: {
          userId: user.id,
          username: user.username,
          interval: interval,
          includesGift: interval === 'annual' ? 'true' : 'false'
        },
        successUrl: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.FRONTEND_URL}/settings?canceled=true`
      })
    });

    if (!zapriteResponse.ok) {
      const errorText = await zapriteResponse.text();
      console.error('Zaprite API Error:', errorText);
      return res.status(500).json({
        error: 'Failed to create checkout session',
        details: errorText
      });
    }

    const checkoutData = await zapriteResponse.json();

    // Store checkout session in database for tracking
    await pool.query(
      `INSERT INTO zaprite_payment_events (
        player_id,
        event_type,
        event_id,
        raw_event,
        status
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'checkout.created',
        checkoutData.id || `checkout_${Date.now()}`,
        JSON.stringify({
          interval,
          amount: pricing.amount,
          checkoutUrl: checkoutData.checkoutUrl || checkoutData.url
        }),
        'pending'
      ]
    );

    res.status(200).json({
      success: true,
      checkoutUrl: checkoutData.checkoutUrl || checkoutData.url || checkoutData.hostedUrl,
      checkoutId: checkoutData.id,
      interval: interval,
      amount: pricing.amount,
      currency: pricing.currency,
      includesGift: interval === 'annual'
    });

  } catch (error) {
    console.error('Error creating Zaprite checkout:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
