// Script to check duels table structure and data
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function checkDuelsTable() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking duels table structure...');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'duels'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Duels table structure:');
    columnsResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
    });
    
    console.log('\n🔍 Checking existing duels...');
    const duelsResult = await client.query(`
      SELECT 
        duel_id,
        challenger_id,
        challengee_id,
        status,
        created_at
      FROM duels 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${duelsResult.rows.length} duels:`);
    duelsResult.rows.forEach(duel => {
      console.log(`   Duel ${duel.duel_id}: challenger=${duel.challenger_id}, challengee=${duel.challengee_id}, status=${duel.status}`);
    });
    
    console.log('\n🔍 Checking for NULL challengee_id (email invitations)...');
    const nullChallengeesResult = await client.query(`
      SELECT COUNT(*) as count FROM duels WHERE challengee_id IS NULL
    `);
    
    console.log(`📊 Duels with NULL challengee_id: ${nullChallengeesResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking duels table:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkDuelsTable();