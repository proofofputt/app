
import { db } from '../../database/db'; // Assuming db connection utility
import { processPayment } from '../../utils/payment'; // Assuming payment processing utility
import { authenticate } from '../../auth'; // Assuming auth middleware

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const user = await authenticate(req, res);
  if (!user) {
    return; // authenticate function handles the response
  }

  const { bundleId } = req.body;

  try {
    // 1. Get bundle details from the database
    const bundle = await db.one('SELECT * FROM subscription_bundles WHERE id = $1', [bundleId]);

    // 2. Calculate the price with custom rounding rules
    const basePrice = 21;
    let totalPrice;
    switch (bundle.quantity) {
      case 3:
        totalPrice = 56.70;
        break;
      case 5:
        totalPrice = 84;
        break;
      case 10:
        totalPrice = 121;
        break;
      case 21:
        totalPrice = 221;
        break;
      default:
        // Fallback for any other bundle quantity
        totalPrice = (basePrice * bundle.quantity) * (1 - bundle.discount_percentage / 100);
        break;
    }

    // 3. Process payment
    const paymentResult = await processPayment({
      amount: totalPrice,
      user: user,
      description: `Purchase of ${bundle.name} subscription bundle`,
    });

    if (!paymentResult.success) {
      return res.status(400).json({ message: 'Payment failed', error: paymentResult.error });
    }

    // 4. Generate gift codes and insert into user_gift_subscriptions
    const generatedCodes = [];
    for (let i = 0; i < bundle.quantity; i++) {
      const giftCode = `GIFT-${user.id}-${Date.now()}-${i}`; // Simple unique code generation
      await db.none(
        'INSERT INTO user_gift_subscriptions (owner_user_id, bundle_id, gift_code) VALUES ($1, $2, $3)',
        [user.id, bundle.id, giftCode]
      );
      generatedCodes.push(giftCode);
    }
    
    // Handle the 2-for-1 intro offer
    if (bundle.quantity === 1) { // Assuming a single subscription purchase is a bundle of 1
        const giftCode = `GIFT-${user.id}-${Date.now()}-INTRO`; // Simple unique code generation
        await db.none(
            'INSERT INTO user_gift_subscriptions (owner_user_id, gift_code) VALUES ($1, $2)',
            [user.id, giftCode]
        );
        generatedCodes.push(giftCode);
    }


    res.status(200).json({ message: 'Bundle purchased successfully', generatedCodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
