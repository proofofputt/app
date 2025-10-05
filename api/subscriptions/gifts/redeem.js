
import { db } from '../../database/db'; // Assuming db connection utility
import { authenticate } from '../../auth'; // Assuming auth middleware

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const user = await authenticate(req, res);
  if (!user) {
    return; // authenticate function handles the response
  }

  const { giftCode } = req.body;

  try {
    // Find the gift subscription
    const gift = await db.oneOrNone('SELECT * FROM user_gift_subscriptions WHERE gift_code = $1', [giftCode]);

    if (!gift) {
      return res.status(404).json({ message: 'Gift code not found' });
    }

    if (gift.is_redeemed) {
      return res.status(400).json({ message: 'Gift code has already been redeemed' });
    }

    // Mark the gift as redeemed
    await db.none(
      'UPDATE user_gift_subscriptions SET is_redeemed = TRUE, redeemed_by_user_id = $1, redeemed_at = CURRENT_TIMESTAMP WHERE id = $2',
      [user.id, gift.id]
    );

    // Update the user's subscription status
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await db.none(
      'UPDATE players SET is_subscribed = TRUE, subscription_expires_at = $1 WHERE id = $2',
      [oneYearFromNow, user.id]
    );

    res.status(200).json({ message: 'Subscription redeemed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
