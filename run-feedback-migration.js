import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'database', 'create_user_feedback_system.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Running feedback system migration...');

    await client.query(sql);

    console.log('Migration completed successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('feedback_threads', 'feedback_messages')
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check columns
    const columnsResult = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN ('feedback_threads', 'feedback_messages')
      ORDER BY table_name, ordinal_position
    `);

    console.log('\nTable structure:');
    let currentTable = '';
    columnsResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n${row.table_name}:`);
      }
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
