
import { db } from '../../../database/db'; // Assuming db connection utility

// This endpoint is designed to be called by a Zaprite webhook when a new subscription is created.
// You will need to configure this webhook in your Zaprite account.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // It is crucial to verify that the webhook request is coming from Zaprite.
  // Zaprite may provide a secret key or a signature to verify the request.
  // This is a placeholder for the actual verification logic.
  const isVerified = verifyZapriteWebhook(req);
  if (!isVerified) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { event, data } = req.body;

    // Assuming the webhook sends an event type for a new subscription
    if (event === 'subscription.created') {
      // Assuming the data contains the user's email or player_id
      const userEmail = data.customer.email; // This is an assumption, adjust based on the actual payload

      // Find the user in your database
      const user = await db.oneOrNone('SELECT * FROM players WHERE email = $1', [userEmail]);

      if (user) {
        // Grant the user a gift subscription for the 2-for-1 offer
        const giftCode = `GIFT-${user.id}-${Date.now()}-INTRO`;
        await db.none(
          'INSERT INTO user_gift_subscriptions (owner_user_id, gift_code) VALUES ($1, $2)',
          [user.id, giftCode]
        );

        // You might also want to update the user's subscription status in your database here
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        await db.none(
          'UPDATE players SET is_subscribed = TRUE, subscription_expires_at = $1 WHERE id = $2',
          [oneYearFromNow, user.id]
        );

        console.log(`Granted a gift subscription to user ${user.email} for the 2-for-1 offer.`);
      } else {
        console.warn(`Received a subscription webhook for an unknown user: ${userEmail}`);
      }
    }

    res.status(200).json({ message: 'Webhook received' });
  } catch (error) {
    console.error('Error processing Zaprite webhook:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

function verifyZapriteWebhook(req) {
  // Implement the logic to verify the webhook request from Zaprite.
  // This might involve checking a secret token from the headers.
  // For example:
  // const secret = process.env.ZAPRITE_WEBHOOK_SECRET;
  // const signature = req.headers['zaprite-signature'];
  // return compare(signature, secret);
  return true; // Placeholder
}
