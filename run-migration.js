#!/usr/bin/env node
/**
 * Database Migration Runner for Zaprite Integration
 * Runs the migration using Node.js pg library
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.production.local' });

const { Pool } = pg;

async function runMigration() {
  console.log('🚀 Starting Zaprite database migration...\n');

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected to database at:', testResult.rows[0].now);
    console.log();

    // Read migration file
    const migrationPath = path.join(__dirname, 'zaprite_migration_combined.sql');
    console.log('📄 Reading migration file:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');
    console.log();

    // Run migration
    console.log('⚙️  Executing migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log();

    // Verify tables created
    console.log('🔍 Verifying tables...');
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND (tablename LIKE '%zaprite%' OR tablename LIKE '%gift%' OR tablename LIKE '%bundle%')
      ORDER BY tablename
    `);

    console.log('\n📊 Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });

    // Verify bundles inserted
    console.log('\n📦 Checking subscription bundles...');
    const bundlesResult = await pool.query('SELECT name, quantity, discount_percentage FROM subscription_bundles ORDER BY quantity');

    console.log('\n💰 Subscription Bundles:');
    bundlesResult.rows.forEach(bundle => {
      console.log(`   ✓ ${bundle.name}: ${bundle.quantity} subscriptions @ ${bundle.discount_percentage}% discount`);
    });

    // Verify player columns
    console.log('\n👤 Checking player table columns...');
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'players'
      AND column_name LIKE '%zaprite%' OR column_name LIKE '%subscription%'
      ORDER BY column_name
    `);

    console.log('\n📋 Player columns added:');
    columnsResult.rows.forEach(col => {
      console.log(`   ✓ ${col.column_name}`);
    });

    console.log('\n✅ Migration verification complete!');
    console.log('\n🎉 Zaprite integration database setup is complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure webhook in Zaprite dashboard');
    console.log('   2. Test subscription flow');
    console.log();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
