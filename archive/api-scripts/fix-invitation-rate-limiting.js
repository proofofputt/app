import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('Running invitation rate limiting migration...');

    // Add the missing columns
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS daily_invites_sent INTEGER DEFAULT 0
    `);

    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS last_invite_date DATE
    `);

    // Set default values for existing players
    await client.query(`
      UPDATE players 
      SET daily_invites_sent = 0 
      WHERE daily_invites_sent IS NULL
    `);

    // Add index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_invite_tracking 
      ON players (last_invite_date, daily_invites_sent)
    `);

    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
      ORDER BY column_name
    `);

    console.log('✅ Migration completed successfully');
    console.log('Added columns:', result.rows);

    return res.status(200).json({
      success: true,
      message: 'Invitation rate limiting columns added successfully',
      columns_added: result.rows
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}