#!/usr/bin/env node

/**
 * Database Migration Runner
 * ============================================================================
 * Executes SQL migration files using Node.js pg library
 *
 * Usage:
 * node scripts/run-migration.js database/migration-file.sql
 * ============================================================================
 */

import fs from 'fs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: Please specify a migration file');
  console.log('Usage: node scripts/run-migration.js database/migration-file.sql');
  process.exit(1);
}

// Resolve path relative to project root
const projectRoot = path.join(__dirname, '..');
const migrationPath = path.join(projectRoot, migrationFile);

// Check if file exists
if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('🔄 Database Migration Runner');
  console.log('==========================================');
  console.log(`📄 Migration: ${path.basename(migrationFile)}`);
  console.log(`📁 Path: ${migrationPath}\n`);

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    // Read migration file
    console.log('📄 Reading migration file...');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Read ${sql.length} characters\n`);

    // Execute migration
    console.log('🚀 Executing migration...');
    const startTime = Date.now();

    await pool.query(sql);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Migration completed in ${duration}s\n`);

    console.log('==========================================');
    console.log('✅ Migration Successful!');
    console.log('==========================================');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
