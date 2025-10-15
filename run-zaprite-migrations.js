#!/usr/bin/env node

/**
 * Run Zaprite subscription migrations
 *
 * This script runs the necessary migrations to set up subscription tables.
 * Run with: node run-zaprite-migrations.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Zaprite subscription migrations...\n');

    // Read the combined migration file
    const migrationPath = path.join(__dirname, 'database', 'zaprite_migration_combined.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚙️  Executing migration...');
    await client.query(migrationSQL);

    // Verify tables were created
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Verifying tables...');

    const tables = [
      'zaprite_payment_events',
      'subscription_bundles',
      'user_gift_subscriptions'
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM information_schema.tables
         WHERE table_name = $1`,
        [table]
      );

      if (result.rows[0].count > 0) {
        console.log(`  ✓ ${table} exists`);
      } else {
        console.log(`  ✗ ${table} NOT FOUND`);
      }
    }

    // Check subscription columns on players table
    console.log('\n📊 Checking players table columns...');
    const columnsResult = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'players'
       AND column_name LIKE '%subscription%'
       OR column_name LIKE '%zaprite%'
       ORDER BY column_name`
    );

    columnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });

    console.log('\n✅ All migrations applied successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
