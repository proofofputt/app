#!/usr/bin/env node
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkConstraints() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Checking foreign key constraints on league_invitations...\n');

    const result = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'league_invitations'
    `);

    console.log('📋 Foreign keys:');
    result.rows.forEach(fk => {
      console.log(`  ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    console.log('\n🔍 Checking if users or players table exists...\n');

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'players')
    `);

    console.log('📋 Tables found:');
    tablesResult.rows.forEach(t => {
      console.log(`  - ${t.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkConstraints();
