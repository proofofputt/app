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
    console.log('🔄 Adding mode and referral_code columns to oauth_sessions...');

    // Add both mode and referral_code columns
    await client.query(`
      ALTER TABLE oauth_sessions
      ADD COLUMN IF NOT EXISTS mode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)
    `);

    // Verify both columns were added
    const verify = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'oauth_sessions'
      AND column_name IN ('mode', 'referral_code')
      ORDER BY column_name
    `);

    const columnsAdded = verify.rows.map(r => r.column_name);
    const allColumnsPresent = columnsAdded.includes('mode') && columnsAdded.includes('referral_code');

    console.log('✅ Migration completed successfully');
    console.log('📊 Columns added:', columnsAdded.join(', '));

    return res.status(200).json({
      success: true,
      message: 'OAuth referral tracking migration completed successfully',
      columns_added: allColumnsPresent,
      columns: verify.rows,
      summary: {
        mode: columnsAdded.includes('mode') ? '✓ Added' : '✗ Missing',
        referral_code: columnsAdded.includes('referral_code') ? '✓ Added' : '✗ Missing'
      }
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
