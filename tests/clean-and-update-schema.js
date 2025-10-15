// Script to clean database and update schema for consistency
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function cleanAndUpdateSchema() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🧹 Cleaning database and updating schema...');
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // 1. Clear existing duels and leagues data
      console.log('📝 Clearing existing duels and leagues data...');
      await client.query('DELETE FROM duels');
      await client.query('DELETE FROM leagues');
      await client.query('DELETE FROM league_memberships');
      await client.query('DELETE FROM league_rounds');
      await client.query('DELETE FROM league_round_sessions');
      await client.query('DELETE FROM player_invitations');
      
      console.log('✅ Existing data cleared');
      
      // 2. Update leagues table to add creator/invited player fields
      console.log('📝 Adding league_creator_id and league_invited_player_id to leagues table...');
      
      // Check if columns already exist
      const existingCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'leagues' 
        AND column_name IN ('league_creator_id', 'league_invited_player_id')
      `);
      
      if (existingCols.rows.length === 0) {
        await client.query(`
          ALTER TABLE leagues 
          ADD COLUMN league_creator_id INTEGER REFERENCES players(player_id),
          ADD COLUMN league_invited_player_id INTEGER REFERENCES players(player_id)
        `);
        console.log('✅ Added league creator/invited player fields');
      } else {
        console.log('✅ League creator/invited player fields already exist');
      }
      
      // 3. Create temporary players table for invited users
      console.log('📝 Setting up temporary players system...');
      
      // Check if is_temporary column exists in players table
      const tempColExists = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'players' 
        AND column_name = 'is_temporary'
      `);
      
      if (tempColExists.rows.length === 0) {
        await client.query(`
          ALTER TABLE players 
          ADD COLUMN is_temporary BOOLEAN DEFAULT false,
          ADD COLUMN contact_info JSONB DEFAULT '{}'
        `);
        console.log('✅ Added temporary player tracking to players table');
      } else {
        console.log('✅ Temporary player fields already exist');
      }
      
      // 4. Update player_invitations table to link to created players
      console.log('📝 Updating player_invitations table...');
      
      const invitedPlayerCol = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'player_invitations' 
        AND column_name = 'invited_player_id'
      `);
      
      if (invitedPlayerCol.rows.length === 0) {
        await client.query(`
          ALTER TABLE player_invitations 
          ADD COLUMN invited_player_id INTEGER REFERENCES players(player_id)
        `);
        console.log('✅ Added invited_player_id to player_invitations');
      } else {
        console.log('✅ invited_player_id already exists in player_invitations');
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Schema update completed successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify the updates
    console.log('🔍 Verifying schema updates...');
    
    const duelsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND (column_name LIKE '%creator%' OR column_name LIKE '%invited%')
      ORDER BY column_name
    `);
    
    console.log('📋 Duels table fields:');
    duelsColumns.rows.forEach(row => console.log(`   ✓ ${row.column_name}`));
    
    const leaguesColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'leagues' 
      AND (column_name LIKE '%creator%' OR column_name LIKE '%invited%')
      ORDER BY column_name
    `);
    
    console.log('📋 Leagues table fields:');
    leaguesColumns.rows.forEach(row => console.log(`   ✓ ${row.column_name}`));
    
    const playersColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('is_temporary', 'contact_info')
      ORDER BY column_name
    `);
    
    console.log('📋 Players table new fields:');
    playersColumns.rows.forEach(row => console.log(`   ✓ ${row.column_name}`));
    
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

cleanAndUpdateSchema();