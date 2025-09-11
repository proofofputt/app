// Add invitation rate limiting fields to players table
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addInvitationRateLimiting() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔄 Adding invitation rate limiting fields to players table...');
    
    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log(`📋 Existing rate limiting columns: ${existingColumns.length > 0 ? existingColumns.join(', ') : 'none'}`);
    
    // Add daily_invites_sent column if it doesn't exist
    if (!existingColumns.includes('daily_invites_sent')) {
      await client.query(`
        ALTER TABLE players 
        ADD COLUMN daily_invites_sent INTEGER DEFAULT 0
      `);
      console.log('✅ Added daily_invites_sent column');
    } else {
      console.log('ℹ️  daily_invites_sent column already exists');
    }
    
    // Add last_invite_date column if it doesn't exist
    if (!existingColumns.includes('last_invite_date')) {
      await client.query(`
        ALTER TABLE players 
        ADD COLUMN last_invite_date DATE
      `);
      console.log('✅ Added last_invite_date column');
    } else {
      console.log('ℹ️  last_invite_date column already exists');
    }
    
    // Verify the additions
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('daily_invites_sent', 'last_invite_date')
      ORDER BY column_name
    `);
    
    console.log('\n📋 Rate limiting columns verification:');
    verifyResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}, Default: ${column.column_default || 'none'}`);
    });
    
    // Create index for performance on date lookups
    try {
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_invite_date 
        ON players(last_invite_date) 
        WHERE last_invite_date IS NOT NULL
      `);
      console.log('✅ Created performance index on last_invite_date');
    } catch (indexError) {
      console.log('ℹ️  Index creation skipped (may already exist)');
    }
    
    console.log('\n🎉 Invitation rate limiting setup complete!');
    console.log('\n📊 Rate Limits:');
    console.log('   📧 Email: 10 per day, 5 per batch');
    console.log('   📱 SMS: 1 per day, 1 per batch (US numbers only)');
    
  } catch (error) {
    console.error('❌ Error adding invitation rate limiting:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

addInvitationRateLimiting();