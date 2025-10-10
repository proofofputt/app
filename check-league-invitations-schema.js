#!/usr/bin/env node
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Checking league_invitations table schema...\n');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'league_invitations'
      ORDER BY ordinal_position
    `);

    if (result.rows.length === 0) {
      console.log('❌ Table league_invitations does not exist!');
    } else {
      console.log('📋 Columns in league_invitations:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }

    console.log('\n🔍 Checking constraints...\n');
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'league_invitations'
    `);

    console.log('📋 Constraints:');
    constraints.rows.forEach(c => {
      console.log(`  - ${c.constraint_name} (${c.constraint_type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkSchema();
