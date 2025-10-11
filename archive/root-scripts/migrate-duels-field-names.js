// Script to migrate duels table field names to standard convention
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function migrateDuelsFieldNames() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔄 Migrating duels table field names to standard convention...');
    
    // Check current table structure
    console.log('📋 Checking current duels table structure...');
    const currentCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND (column_name LIKE '%challenger%' OR column_name LIKE '%challengee%' OR column_name LIKE '%creator%' OR column_name LIKE '%invited%')
      ORDER BY column_name
    `);
    
    console.log('Current field names:');
    currentCols.rows.forEach(row => console.log(`   ${row.column_name}`));
    
    // Start transaction for safe migration
    await client.query('BEGIN');
    
    try {
      // Rename challenger_id to duel_creator_id
      console.log('📝 Renaming challenger_id to duel_creator_id...');
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challenger_id TO duel_creator_id
      `);
      
      // Rename challengee_id to duel_invited_player_id  
      console.log('📝 Renaming challengee_id to duel_invited_player_id...');
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challengee_id TO duel_invited_player_id
      `);
      
      // Rename session-related fields
      console.log('📝 Renaming session-related fields...');
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challenger_session_id TO duel_creator_session_id
      `);
      
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challengee_session_id TO duel_invited_player_session_id
      `);
      
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challenger_session_data TO duel_creator_session_data
      `);
      
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challengee_session_data TO duel_invited_player_session_data
      `);
      
      // Rename score fields
      console.log('📝 Renaming score fields...');
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challenger_score TO duel_creator_score
      `);
      
      await client.query(`
        ALTER TABLE duels 
        RENAME COLUMN challengee_score TO duel_invited_player_score
      `);
      
      // Update constraints that reference the old field names
      console.log('📝 Updating foreign key constraints...');
      
      // Drop existing foreign key constraints
      const fkConstraints = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'duels' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      for (const constraint of fkConstraints.rows) {
        console.log(`   Dropping constraint: ${constraint.constraint_name}`);
        await client.query(`ALTER TABLE duels DROP CONSTRAINT ${constraint.constraint_name}`);
      }
      
      // Recreate foreign key constraints with correct field names
      console.log('📝 Recreating foreign key constraints...');
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_duel_creator_id_fkey 
        FOREIGN KEY (duel_creator_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_duel_invited_player_id_fkey 
        FOREIGN KEY (duel_invited_player_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_winner_id_fkey 
        FOREIGN KEY (winner_id) REFERENCES players(player_id)
      `);
      
      // Update check constraints
      console.log('📝 Updating check constraints...');
      
      // Drop old check constraints
      const checkConstraints = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'duels' 
        AND constraint_type = 'CHECK'
      `);
      
      for (const constraint of checkConstraints.rows) {
        console.log(`   Dropping check constraint: ${constraint.constraint_name}`);
        await client.query(`ALTER TABLE duels DROP CONSTRAINT ${constraint.constraint_name}`);
      }
      
      // Add updated check constraints
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_status_check 
        CHECK (status IN ('pending', 'pending_new_player', 'active', 'completed', 'expired', 'declined', 'cancelled'))
      `);
      
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT no_self_challenge 
        CHECK (duel_invited_player_id IS NULL OR duel_creator_id != duel_invited_player_id)
      `);
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('✅ Field name migration completed successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify the migration
    console.log('🔍 Verifying updated table structure...');
    const updatedCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND (column_name LIKE '%creator%' OR column_name LIKE '%invited%')
      ORDER BY column_name
    `);
    
    console.log('📋 Updated field names:');
    updatedCols.rows.forEach(row => console.log(`   ✓ ${row.column_name}`));
    
  } catch (error) {
    console.error('❌ Error migrating field names:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrateDuelsFieldNames();