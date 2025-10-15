// Script to clear all duels and leagues from the database
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearCompetitions() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🧹 Starting to clear all competitions...');
    
    console.log('🥊 Clearing duels...');
    const duelsResult = await client.query('DELETE FROM duels');
    console.log(`   Deleted ${duelsResult.rowCount} duels`);
    
    // Clear league-related data
    console.log('🏟️ Clearing league round sessions...');
    await client.query('DELETE FROM league_round_sessions');
    
    console.log('🏟️ Clearing league rounds...');
    const roundsResult = await client.query('DELETE FROM league_rounds');
    console.log(`   Deleted ${roundsResult.rowCount} league rounds`);
    
    console.log('🏟️ Clearing league memberships...');
    const membershipsResult = await client.query('DELETE FROM league_memberships');
    console.log(`   Deleted ${membershipsResult.rowCount} league memberships`);
    
    console.log('🏟️ Clearing leagues...');
    const leaguesResult = await client.query('DELETE FROM leagues');
    console.log(`   Deleted ${leaguesResult.rowCount} leagues`);
    
    // Clear invitations (only if table exists)
    try {
      console.log('📧 Clearing competition invitations...');
      const invitationsResult = await client.query('DELETE FROM player_invitations WHERE invitation_type IN (\'duel\', \'league\')');
      console.log(`   Deleted ${invitationsResult.rowCount} invitations`);
    } catch (error) {
      if (error.code === '42P01') { // Table does not exist
        console.log('   Skipping player_invitations (table does not exist)');
      } else {
        throw error;
      }
    }
    
    // Verify cleanup
    console.log('✅ Verifying cleanup...');
    const verification = await client.query(`
      SELECT 'Duels' as table_name, COUNT(*) as count FROM duels
      UNION ALL
      SELECT 'Leagues' as table_name, COUNT(*) as count FROM leagues
      UNION ALL
      SELECT 'League rounds' as table_name, COUNT(*) as count FROM league_rounds
      UNION ALL
      SELECT 'League memberships' as table_name, COUNT(*) as count FROM league_memberships
    `);
    
    console.log('📊 Final counts:');
    verification.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count}`);
    });
    
    console.log('🎉 All competitions cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing competitions:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
clearCompetitions()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });