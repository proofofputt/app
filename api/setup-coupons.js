import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const client = await pool.connect();
    
    console.log('🎫 Setting up coupons table...');

    // Create coupons table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
          coupon_id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          redemption_limit INTEGER NULL, -- NULL = unlimited
          times_redeemed INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP NULL
      );
    `);

    // Add missing columns if they don't exist
    try {
      await client.query(`
        ALTER TABLE coupons ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) DEFAULT 'regular';
      `);
    } catch (e) {
      console.log('Column membership_tier already exists or cannot be added:', e.message);
    }

    // Insert the early access coupon codes (without membership_tier if column doesn't exist)
    await client.query(`
      INSERT INTO coupons (code, description, redemption_limit, times_redeemed, is_active) 
      VALUES 
          ('EARLY', 'Early Access 2025', NULL, 0, TRUE),
          ('BETA', 'Beta Access', 100, 0, TRUE),
          ('POP123', 'Pop Early Access Code', NULL, 0, TRUE)
      ON CONFLICT (code) DO UPDATE SET
          description = EXCLUDED.description,
          redemption_limit = EXCLUDED.redemption_limit,
          is_active = EXCLUDED.is_active;
    `);

    // Verify the coupons were created
    const result = await client.query("SELECT * FROM coupons WHERE code IN ('EARLY', 'BETA', 'POP123')");
    
    client.release();

    console.log('✅ Coupons table setup completed');
    return res.status(200).json({ 
      success: true, 
      message: 'Coupons table setup completed successfully',
      coupons: result.rows
    });

  } catch (error) {
    console.error('❌ Error setting up coupons table:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'An internal server error occurred' 
    });
  }
}