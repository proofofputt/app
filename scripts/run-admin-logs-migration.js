/**
 * Run admin action logs migration
 */
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('Running admin_action_logs migration...\n');

  try {
    const migrationPath = join(__dirname, '../database/add_admin_action_logs.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('Executing SQL...');
    await pool.query(sql);

    console.log('✅ Migration complete!\n');

    // Verify table was created
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'admin_action_logs'
      );
    `);

    if (check.rows[0].exists) {
      console.log('✅ admin_action_logs table created successfully');

      // Check columns
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'admin_action_logs'
        ORDER BY ordinal_position;
      `);

      console.log('\nTable structure:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️  Table check failed - table may not have been created');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
