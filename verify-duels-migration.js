// Script to verify duels migration is working correctly
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function verifyDuelsMigration() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Verifying duels table migration...');
    
    // Check table structure
    const columnsResult = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND (column_name LIKE '%creator%' OR column_name LIKE '%invited%')
      ORDER BY column_name
    `);
    
    console.log('📋 Updated duels table structure:');
    columnsResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
    });
    
    // Check existing duels
    const duelsResult = await client.query(`
      SELECT 
        duel_id,
        duel_creator_id,
        duel_invited_player_id,
        status,
        created_at
      FROM duels 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log(`\\n📊 Found ${duelsResult.rows.length} duels with new field names:`);
    duelsResult.rows.forEach(duel => {
      console.log(`   Duel ${duel.duel_id}: creator=${duel.duel_creator_id}, invited_player=${duel.duel_invited_player_id}, status=${duel.status}`);
    });
    
    // Test NULL invited player for email invitations
    console.log('\\n🔍 Checking for NULL duel_invited_player_id (email invitations)...');
    const nullInviteesResult = await client.query(`
      SELECT COUNT(*) as count FROM duels WHERE duel_invited_player_id IS NULL
    `);
    
    console.log(`📧 Duels with NULL duel_invited_player_id (email invitations): ${nullInviteesResult.rows[0].count}`);
    
    // Check constraints
    console.log('\\n🔍 Checking table constraints...');
    const constraintsResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'duels'
      ORDER BY constraint_type, constraint_name
    `);
    
    console.log('📋 Active constraints:');
    constraintsResult.rows.forEach(constraint => {
      console.log(`   ${constraint.constraint_type}: ${constraint.constraint_name}`);
    });
    
    console.log('\\n✅ Migration verification completed!');
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

verifyDuelsMigration();