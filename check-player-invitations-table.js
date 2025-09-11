// Script to check if player_invitations table exists
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPlayerInvitationsTable() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking for player_invitations table...');
    
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'player_invitations'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`📋 player_invitations table exists: ${tableExists}`);
    
    if (tableExists) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'player_invitations'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Table structure:');
      columnsResult.rows.forEach(column => {
        console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
      });
    } else {
      console.log('❌ Table does not exist - this is causing the 500 error');
    }
    
  } catch (error) {
    console.error('❌ Error checking table:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkPlayerInvitationsTable();