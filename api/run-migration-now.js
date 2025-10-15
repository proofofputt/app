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
    console.log('🔄 Running invitation rate limiting migration...');

    // Check current players table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
      ORDER BY column_name
    `);
    
    const existingColumns = columnsResult.rows;
    console.log('Existing rate limiting columns:', existingColumns);

    // Add missing columns
    try {
      await client.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS daily_invites_sent INTEGER DEFAULT 0
      `);
      console.log('✅ Added daily_invites_sent column');
    } catch (error) {
      console.log('⚠️ daily_invites_sent column might already exist:', error.message);
    }

    try {
      await client.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS last_invite_date DATE
      `);
      console.log('✅ Added last_invite_date column');
    } catch (error) {
      console.log('⚠️ last_invite_date column might already exist:', error.message);
    }

    // Set default values for existing players
    const updateResult = await client.query(`
      UPDATE players 
      SET daily_invites_sent = 0 
      WHERE daily_invites_sent IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} players with default daily_invites_sent`);

    // Verify the changes
    const finalColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
      ORDER BY column_name
    `);

    console.log('✅ Migration completed successfully');
    console.log('Final columns:', finalColumnsResult.rows);

    return res.status(200).json({
      success: true,
      message: 'Migration completed successfully',
      before: existingColumns,
      after: finalColumnsResult.rows,
      updated_players: updateResult.rowCount
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