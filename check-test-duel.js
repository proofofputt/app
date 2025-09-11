// Script to check if our test duel exists in the database
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTestDuel() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking for existing duels...');
    
    const duelsResult = await client.query(`
      SELECT 
        d.duel_id,
        d.challenger_id,
        d.challengee_id,
        d.status,
        d.created_at,
        d.expires_at,
        challenger.name as challenger_name,
        challengee.name as challengee_name
      FROM duels d
      LEFT JOIN players challenger ON d.challenger_id = challenger.player_id
      LEFT JOIN players challengee ON d.challengee_id = challengee.player_id
      ORDER BY d.created_at DESC
    `);
    
    console.log(`📊 Found ${duelsResult.rows.length} duels in database:`);
    duelsResult.rows.forEach(duel => {
      console.log(`   Duel ${duel.duel_id}: ${duel.challenger_name} vs ${duel.challengee_name} (${duel.status})`);
      console.log(`   Created: ${duel.created_at}, Expires: ${duel.expires_at}`);
    });
    
    // Also check players
    const playersResult = await client.query('SELECT player_id, name FROM players ORDER BY player_id');
    console.log('\n👥 Available players:');
    playersResult.rows.forEach(player => {
      console.log(`   ID: ${player.player_id}, Name: ${player.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking duels:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkTestDuel();