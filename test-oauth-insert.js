import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testOAuthInsert() {
  try {
    const email = 'test_oauth_' + Date.now() + '@example.com';
    const google_id = 'test_google_id_' + Date.now();
    const name = 'Test OAuth User';

    console.log('Testing OAuth user insert with:');
    console.log('  Email:', email);
    console.log('  Google ID:', google_id);
    console.log('  Name:', name);

    // Get next player ID
    const maxIdQuery = await pool.query('SELECT COALESCE(MAX(player_id), 999) as max_id FROM players');
    const nextPlayerId = Math.max(maxIdQuery.rows[0].max_id + 1, 1000);
    console.log('\nNext player ID:', nextPlayerId);

    // Try to insert
    console.log('\nAttempting INSERT...');
    const insertResult = await pool.query(
      `INSERT INTO players (
        player_id,
        email,
        name,
        google_id,
        membership_tier,
        subscription_status,
        timezone,
        created_at,
        updated_at
      )
       VALUES ($1, $2, $3, $4, 'basic', 'active', 'America/New_York', NOW(), NOW())
       RETURNING *`,
      [
        nextPlayerId,
        email,
        name,
        google_id
      ]
    );

    console.log('\n✅ INSERT successful!');
    console.log('Player data:', insertResult.rows[0]);

    // Initialize player stats
    console.log('\nInitializing player stats...');
    await pool.query(
      `INSERT INTO player_stats (
        player_id,
        total_sessions,
        total_putts,
        total_makes,
        total_misses,
        make_percentage,
        best_streak,
        created_at,
        updated_at
      )
      VALUES ($1, 0, 0, 0, 0, 0.0, 0, NOW(), NOW())
      ON CONFLICT (player_id) DO NOTHING`,
      [nextPlayerId]
    );

    console.log('✅ Player stats initialized!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testOAuthInsert();
