// Script to create a test duel for testing
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestDuel() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🥊 Creating test duel...');
    
    // First, get available players
    const playersResult = await client.query('SELECT player_id, name FROM players LIMIT 5');
    console.log('👥 Available players:');
    playersResult.rows.forEach((player, index) => {
      console.log(`   ${index + 1}. ID: ${player.player_id}, Name: ${player.name}`);
    });
    
    if (playersResult.rows.length < 2) {
      console.log('❌ Need at least 2 players to create a duel');
      return;
    }
    
    const challenger = playersResult.rows[0];
    const challengee = playersResult.rows[1];
    
    // Create a test duel
    const duelResult = await client.query(`
      INSERT INTO duels (
        challenger_id, 
        challengee_id, 
        status, 
        rules, 
        settings,
        duel_type,
        invite_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING duel_id, created_at, expires_at
    `, [
      challenger.player_id,
      challengee.player_id,
      'active',
      JSON.stringify({
        session_duration_limit_minutes: 5,
        invitation_expiry_minutes: 4320, // 3 days
        number_of_attempts: 50
      }),
      JSON.stringify({
        scoring: 'total_makes',
        invitation_expiry_minutes: 4320 // 3 days
      }),
      'practice',
      'Test duel for desktop app testing'
    ]);
    
    const createdDuel = duelResult.rows[0];
    
    console.log('✅ Test duel created successfully!');
    console.log(`   Duel ID: ${createdDuel.duel_id}`);
    console.log(`   Challenger: ${challenger.name} (ID: ${challenger.player_id})`);
    console.log(`   Challengee: ${challengee.name} (ID: ${challengee.player_id})`);
    console.log(`   Created At: ${createdDuel.created_at}`);
    console.log(`   Expires At: ${createdDuel.expires_at}`);
    console.log(`   Status: active`);
    console.log(`   Time Limit: 5 minutes`);
    console.log(`   Number of Attempts: 50`);
    
    // Verify the duel was created
    const verifyResult = await client.query(`
      SELECT 
        d.duel_id,
        d.status,
        d.created_at,
        d.expires_at,
        d.rules,
        d.settings,
        challenger.name as challenger_name,
        challengee.name as challengee_name
      FROM duels d
      JOIN players challenger ON d.challenger_id = challenger.player_id
      JOIN players challengee ON d.challengee_id = challengee.player_id
      WHERE d.duel_id = $1
    `, [createdDuel.duel_id]);
    
    const duel = verifyResult.rows[0];
    console.log('\n🔍 Verification - Duel details:');
    console.log(`   ${duel.challenger_name} vs ${duel.challengee_name}`);
    console.log(`   Status: ${duel.status}`);
    console.log(`   Rules: ${JSON.stringify(duel.rules, null, 2)}`);
    console.log(`   Settings: ${JSON.stringify(duel.settings, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Error creating test duel:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
createTestDuel()
  .then(() => {
    console.log('\n🎉 Test duel creation completed successfully');
    console.log('💡 You can now test the desktop app active competitions feature');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test duel creation failed:', error);
    process.exit(1);
  });