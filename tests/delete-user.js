#!/usr/bin/env node

/**
 * Delete User Script
 * Queries and optionally deletes a user from the database
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function findUser(email) {
  console.log(`\n🔍 Searching for user: ${email}\n`);

  const result = await pool.query(
    'SELECT player_id, email, name, google_id, created_at, updated_at FROM players WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    console.log('❌ User not found\n');
    return null;
  }

  const user = result.rows[0];
  console.log('✅ User found:');
  console.log(`   Player ID: ${user.player_id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Google ID: ${user.google_id || '(not set)'}`);
  console.log(`   Created: ${user.created_at}`);
  console.log(`   Updated: ${user.updated_at}\n`);

  return user;
}

async function deleteUser(playerId) {
  console.log(`\n🗑️  Deleting user ${playerId}...\n`);

  // Delete related records first
  await pool.query('DELETE FROM player_stats WHERE player_id = $1', [playerId]);
  console.log('   ✓ Deleted player_stats');

  await pool.query('DELETE FROM sessions WHERE player_id = $1', [playerId]);
  console.log('   ✓ Deleted sessions');

  await pool.query('DELETE FROM duel_participants WHERE player_id = $1', [playerId]);
  console.log('   ✓ Deleted duel_participants');

  await pool.query('DELETE FROM oauth_tokens WHERE player_id = $1', [playerId]);
  console.log('   ✓ Deleted oauth_tokens');

  await pool.query('DELETE FROM player_friends WHERE player_id = $1 OR friend_player_id = $1', [playerId]);
  console.log('   ✓ Deleted player_friends');

  await pool.query('DELETE FROM player_referrals WHERE referrer_id = $1 OR referred_player_id = $1', [playerId]);
  console.log('   ✓ Deleted player_referrals');

  // Finally delete the player
  await pool.query('DELETE FROM players WHERE player_id = $1', [playerId]);
  console.log('   ✓ Deleted player record');

  console.log('\n✅ User deleted successfully\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node delete-user.js <email>');
    console.error('Example: node delete-user.js user@example.com');
    process.exit(1);
  }

  const email = args[0];

  try {
    // Find user
    const user = await findUser(email);

    if (!user) {
      process.exit(0);
    }

    // Confirm deletion
    const answer = await question('⚠️  Delete this user? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled\n');
      process.exit(0);
    }

    // Delete user
    await deleteUser(user.player_id);

    // Verify deletion
    const verifyResult = await pool.query(
      'SELECT * FROM players WHERE player_id = $1',
      [user.player_id]
    );

    if (verifyResult.rows.length === 0) {
      console.log('✅ Verified: User no longer exists in database\n');
    } else {
      console.log('⚠️  Warning: User still exists in database\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
