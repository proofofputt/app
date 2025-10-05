
import { db } from '../../database/db'; // Assuming db connection utility
import { authenticate } from '../../auth'; // Assuming auth middleware

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const user = await authenticate(req, res);
  if (!user) {
    return; // authenticate function handles the response
  }

  try {
    const giftSubscriptions = await db.any(
      'SELECT * FROM user_gift_subscriptions WHERE owner_user_id = $1 AND is_redeemed = FALSE',
      [user.id]
    );

    res.status(200).json({ giftSubscriptions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
