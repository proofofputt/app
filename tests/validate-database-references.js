#!/usr/bin/env node
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function validateDatabaseReferences() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Validating database schema references...\n');

    // Get all columns for critical tables
    const tables = ['league_invitations', 'league_memberships', 'leagues', 'players'];
    const schemas = {};

    for (const table of tables) {
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      schemas[table] = result.rows.map(r => r.column_name);
      console.log(`📋 ${table}:`, schemas[table].join(', '));
    }

    console.log('\n🔍 Checking for problematic references in code...\n');

    // Check for wrong column names in API files
    const wrongPatterns = [
      { pattern: 'inviting_user_id', correct: 'inviting_player_id', table: 'league_invitations' },
      { pattern: 'invited_user_id', correct: 'invited_player_id', table: 'league_invitations' },
      { pattern: 'membership_id', correct: 'league_id, player_id', table: 'league_memberships' },
    ];

    let hasIssues = false;

    for (const { pattern, correct, table } of wrongPatterns) {
      try {
        const result = execSync(
          `grep -r "${pattern}" api/ --include="*.js" | grep -v node_modules | grep -v ".git" || true`,
          { encoding: 'utf-8' }
        );

        if (result.trim()) {
          console.log(`❌ Found references to wrong column "${pattern}" (should be "${correct}" in ${table}):`);
          console.log(result);
          hasIssues = true;
        }
      } catch (error) {
        // grep returns non-zero if no matches, which is fine
      }
    }

    if (!hasIssues) {
      console.log('✅ No problematic column references found!');
    }

    console.log('\n📊 Summary:');
    console.log('- league_invitations uses: inviting_player_id, invited_player_id');
    console.log('- league_memberships has no membership_id (use league_id + player_id)');
    console.log('- All foreign keys should reference players.player_id');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

validateDatabaseReferences();
