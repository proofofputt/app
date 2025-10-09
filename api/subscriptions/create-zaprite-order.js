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
      'SELECT player_id, display_name, email FROM players WHERE player_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const pricing = PRICING[interval];

    // Create Zaprite Order
    const orderPayload = {
      organizationId: process.env.ZAPRITE_ORG_ID,
      customerId: user.player_id.toString(),
      customerEmail: user.email,
      customerName: user.display_name,
      amount: pricing.amount,
      currency: 'USD',
      description: pricing.description,
      // Metadata to track subscription details
      metadata: {
        userId: user.player_id.toString(),
        displayName: user.display_name,
        interval: interval,
        includesGift: interval === 'annual' ? 'true' : 'false',
        subscriptionType: 'proof-of-putt'
      },
      // Redirect URLs
      successUrl: `${process.env.FRONTEND_URL}/subscription/success?session_id={ORDER_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/settings?canceled=true`
    };

    console.log('Creating Zaprite order:', JSON.stringify(orderPayload, null, 2));

    const zapriteResponse = await fetch(`${process.env.ZAPRITE_BASE_URL}/v1/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZAPRITE_API_KEY}`
      },
      body: JSON.stringify(orderPayload)
    });

    const responseText = await zapriteResponse.text();
    console.log('Zaprite API Response:', responseText);

    if (!zapriteResponse.ok) {
      console.error('Zaprite API Error:', {
        status: zapriteResponse.status,
        statusText: zapriteResponse.statusText,
        body: responseText
      });
      return res.status(500).json({
        error: 'Failed to create order',
        details: responseText,
        status: zapriteResponse.status
      });
    }

    let orderData;
    try {
      orderData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Zaprite response:', parseError);
      return res.status(500).json({
        error: 'Invalid response from Zaprite',
        details: responseText
      });
    }

    // Store order in database for tracking
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
        'order.created',
        orderData.id || orderData.orderId || `order_${Date.now()}`,
        JSON.stringify({
          interval,
          amount: pricing.amount,
          orderData: orderData
        }),
        'pending'
      ]
    );

    // Extract checkout URL from response
    // Zaprite might return different field names
    const checkoutUrl = orderData.checkoutUrl
      || orderData.url
      || orderData.hostedUrl
      || orderData.paymentUrl
      || orderData.checkoutLink;

    if (!checkoutUrl) {
      console.error('No checkout URL in Zaprite response:', orderData);
      return res.status(500).json({
        error: 'No checkout URL received from Zaprite',
        orderData: orderData
      });
    }

    res.status(200).json({
      success: true,
      checkoutUrl: checkoutUrl,
      orderId: orderData.id || orderData.orderId,
      interval: interval,
      amount: pricing.amount,
      currency: 'USD',
      includesGift: interval === 'annual',
      orderData: orderData // Include full response for debugging
    });

  } catch (error) {
    console.error('Error creating Zaprite order:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
