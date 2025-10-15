// Safe script to migrate duels table field names to standard convention
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function migrateDuelsFieldNames() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔄 Migrating duels table field names to standard convention...');
    
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
      
      // Update foreign key constraints - handle them safely
      console.log('📝 Updating foreign key constraints...');
      
      // Get constraint names safely
      const fkConstraints = await client.query(`
        SELECT tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'duels' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name IN ('duel_creator_id', 'duel_invited_player_id', 'winner_id')
      `);
      
      // Drop and recreate foreign key constraints with safe names
      for (const constraint of fkConstraints.rows) {
        try {
          console.log(`   Dropping constraint: ${constraint.constraint_name} on ${constraint.column_name}`);
          await client.query(`ALTER TABLE duels DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}"`);
        } catch (err) {
          console.log(`   Warning: Could not drop constraint ${constraint.constraint_name}: ${err.message}`);
        }
      }
      
      // Recreate foreign key constraints with safe names
      console.log('📝 Recreating foreign key constraints...');
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_creator_fkey 
        FOREIGN KEY (duel_creator_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_invited_player_fkey 
        FOREIGN KEY (duel_invited_player_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_winner_fkey 
        FOREIGN KEY (winner_id) REFERENCES players(player_id)
      `);
      
      // Handle check constraints safely 
      console.log('📝 Updating check constraints...');
      
      // Drop check constraints that may reference old field names
      try {
        await client.query(`ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check`);
        await client.query(`ALTER TABLE duels DROP CONSTRAINT IF EXISTS no_self_challenge`);
      } catch (err) {
        console.log(`   Warning: Could not drop some check constraints: ${err.message}`);
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