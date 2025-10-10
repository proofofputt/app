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

async function fixForeignKeys() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔧 Fixing league_invitations foreign keys to reference players table...');

    // Read the SQL file
    const sqlFile = join(__dirname, 'database', 'fix-league-invitations-foreign-keys.sql');
    const sql = readFileSync(sqlFile, 'utf8');

    // Execute the SQL
    await client.query(sql);

    console.log('✅ Successfully updated foreign keys!');
    console.log('📝 league_invitations now correctly references players table');

  } catch (error) {
    console.error('❌ Error fixing foreign keys:', error.message);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

fixForeignKeys();
