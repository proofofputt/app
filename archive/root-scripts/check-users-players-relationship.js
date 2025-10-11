#!/usr/bin/env node
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkRelationship() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Checking users table structure...\n');
    const usersColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('📋 Users columns:');
    usersColumns.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

    console.log('\n🔍 Checking players table structure...\n');
    const playersColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);
    console.log('📋 Players columns:');
    playersColumns.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

    console.log('\n🔍 Sample data from users table...\n');
    const usersData = await client.query('SELECT id, player_id FROM users LIMIT 5');
    console.log('📋 Users sample:');
    console.table(usersData.rows);

    console.log('\n🔍 Sample data from players table...\n');
    const playersData = await client.query('SELECT player_id, user_id, name FROM players LIMIT 5');
    console.log('📋 Players sample:');
    console.table(playersData.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkRelationship();
