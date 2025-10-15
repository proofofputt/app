
import { db } from '../../../database/db'; // Assuming db connection utility
import { authenticateAdmin } from '../../../auth'; // Assuming admin auth middleware

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const adminUser = await authenticateAdmin(req, res);
  if (!adminUser) {
    return; // authenticateAdmin function handles the response
  }

  const { userId, bundleId } = req.body;

  try {
    // 1. Get bundle details from the database
    const bundle = await db.one('SELECT * FROM subscription_bundles WHERE id = $1', [bundleId]);

    // 2. Generate gift codes and insert into user_gift_subscriptions
    const generatedCodes = [];
    for (let i = 0; i < bundle.quantity; i++) {
      const giftCode = `GIFT-${userId}-${Date.now()}-${i}`;
      await db.none(
        'INSERT INTO user_gift_subscriptions (owner_user_id, bundle_id, gift_code) VALUES ($1, $2, $3)',
        [userId, bundle.id, giftCode]
      );
      generatedCodes.push(giftCode);
    }

    res.status(200).json({ message: `Bundle granted successfully to user ${userId}`, generatedCodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
