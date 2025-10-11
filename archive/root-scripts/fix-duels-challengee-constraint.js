// Script to fix duels table challengee_id constraint for email invitations
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function fixDuelsConstraint() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔧 Fixing duels table challengee_id constraint...');
    
    // Drop the NOT NULL constraint on challengee_id to allow email invitations
    console.log('📝 Dropping NOT NULL constraint on challengee_id...');
    await client.query(`
      ALTER TABLE duels 
      ALTER COLUMN challengee_id DROP NOT NULL
    `);
    
    // Also need to drop the foreign key constraint and recreate it to allow NULL
    console.log('📝 Dropping and recreating foreign key constraint...');
    
    // First, find the constraint name
    const constraintResult = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'duels' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%challengee%'
    `);
    
    if (constraintResult.rows.length > 0) {
      const constraintName = constraintResult.rows[0].constraint_name;
      console.log(`📝 Found constraint: ${constraintName}`);
      
      await client.query(`
        ALTER TABLE duels DROP CONSTRAINT ${constraintName}
      `);
      
      console.log('📝 Recreating foreign key constraint to allow NULL...');
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT duels_challengee_id_fkey 
        FOREIGN KEY (challengee_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
    }
    
    // Update the check constraint to include the new status
    console.log('📝 Updating status constraint to include pending_new_player...');
    
    // Drop old constraint
    const statusConstraintResult = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'duels' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
    `);
    
    if (statusConstraintResult.rows.length > 0) {
      const statusConstraintName = statusConstraintResult.rows[0].constraint_name;
      console.log(`📝 Found status constraint: ${statusConstraintName}`);
      
      await client.query(`
        ALTER TABLE duels DROP CONSTRAINT ${statusConstraintName}
      `);
    }
    
    // Add new constraint with pending_new_player status
    await client.query(`
      ALTER TABLE duels 
      ADD CONSTRAINT duels_status_check 
      CHECK (status IN ('pending', 'pending_new_player', 'active', 'completed', 'expired', 'declined', 'cancelled'))
    `);
    
    // Also update the self-challenge constraint to handle NULL challengee_id
    console.log('📝 Updating self-challenge constraint...');
    
    const selfChallengeResult = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'duels' 
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%self%'
    `);
    
    if (selfChallengeResult.rows.length > 0) {
      const selfConstraintName = selfChallengeResult.rows[0].constraint_name;
      console.log(`📝 Found self-challenge constraint: ${selfConstraintName}`);
      
      await client.query(`
        ALTER TABLE duels DROP CONSTRAINT ${selfConstraintName}
      `);
    }
    
    // Add new constraint that allows NULL challengee_id but prevents self-challenge when not NULL
    await client.query(`
      ALTER TABLE duels 
      ADD CONSTRAINT no_self_challenge 
      CHECK (challengee_id IS NULL OR challenger_id != challengee_id)
    `);
    
    console.log('✅ Duels table constraints fixed successfully!');
    
    // Verify the changes
    console.log('🔍 Verifying updated table structure...');
    const verifyResult = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'duels'
      AND column_name IN ('challenger_id', 'challengee_id')
      ORDER BY column_name
    `);
    
    console.log('📋 Updated constraints:');
    verifyResult.rows.forEach(column => {
      console.log(`   ${column.column_name}: nullable = ${column.is_nullable}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing duels constraints:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

fixDuelsConstraint();