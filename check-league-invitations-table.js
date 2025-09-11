// Script to check if league_invitations table exists
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function checkLeagueInvitationsTable() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking for league_invitations table...');
    
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'league_invitations'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`📋 league_invitations table exists: ${tableExists}`);
    
    if (tableExists) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'league_invitations'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Table structure:');
      columnsResult.rows.forEach(column => {
        console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
      });
    } else {
      console.log('❌ Table does not exist - this may cause 500 errors for league invitations');
    }
    
  } catch (error) {
    console.error('❌ Error checking table:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkLeagueInvitationsTable();