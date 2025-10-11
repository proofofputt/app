import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    console.log('🔄 Adding referral_code column to oauth_sessions...');

    // Add referral_code column
    await client.query(`
      ALTER TABLE oauth_sessions
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)
    `);

    // Verify the column was added
    const verify = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'oauth_sessions'
      AND column_name = 'referral_code'
    `);

    console.log('✅ Migration completed successfully');

    return res.status(200).json({
      success: true,
      message: 'OAuth referral tracking migration completed successfully',
      column_added: verify.rows.length > 0,
      details: verify.rows[0]
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  } finally {
    client.release();
  }
}
