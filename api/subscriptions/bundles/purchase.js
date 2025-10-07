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
  2: { quantity: 5, price: 84, discount: 20 },
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

  try {
    // Get bundle details
    const bundle = BUNDLE_PRICING[bundleId];
    if (!bundle) {
      return res.status(400).json({ success: false, message: 'Invalid bundle ID' });
    }

    // For now, return mock success with gift codes
    // In production, this would create a Zaprite order and wait for webhook
    const generatedCodes = [];
    for (let i = 0; i < bundle.quantity; i++) {
      generatedCodes.push(generateGiftCode());
    }

    return res.status(200).json({
      success: true,
      message: `${bundle.quantity}-pack bundle purchased successfully! Redirecting to payment...`,
      generatedCodes,
      requiresPayment: true,
      amount: bundle.price
    });

  } catch (error) {
    console.error('Bundle purchase error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}
