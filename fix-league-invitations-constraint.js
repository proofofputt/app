#!/usr/bin/env node
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixLeagueInvitationsConstraint() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 Fixing league_invitations unique constraint...');

    // Read the SQL file
    const sqlFile = join(__dirname, 'database', 'fix-league-invitations-unique-constraint.sql');
    const sql = readFileSync(sqlFile, 'utf8');

    // Execute the SQL
    await client.query(sql);

    console.log('✅ Successfully fixed league_invitations unique constraint!');
    console.log('📝 Players can now be re-invited after declining/expiring invitations');

  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

fixLeagueInvitationsConstraint();
