import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('Checking user_gift_subscriptions table schema...\n');

try {
  // Check if table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'user_gift_subscriptions'
    );
  `);

  if (!tableCheck.rows[0].exists) {
    console.log('❌ Table "user_gift_subscriptions" does not exist!');
    console.log('\nChecking for similar tables:');

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%gift%'
      ORDER BY table_name;
    `);

    console.log('Tables with "gift" in name:');
    tablesResult.rows.forEach(row => console.log('  -', row.table_name));
  } else {
    console.log('✅ Table exists!\n');

    // Get column information
    const columnsResult = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'user_gift_subscriptions'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in user_gift_subscriptions table:');
    console.log('='.repeat(80));
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}`);
      if (col.column_default) {
        console.log(`    Default: ${col.column_default}`);
      }
    });

    // Check constraints
    console.log('\n\nConstraints:');
    console.log('='.repeat(80));
    const constraintsResult = await pool.query(`
      SELECT
        conname AS constraint_name,
        contype AS constraint_type,
        pg_get_constraintdef(c.oid) AS constraint_definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'user_gift_subscriptions'::regclass
      ORDER BY contype, conname;
    `);

    constraintsResult.rows.forEach(con => {
      console.log(`  ${con.constraint_name}`);
      console.log(`    Type: ${con.constraint_type}`);
      console.log(`    Definition: ${con.constraint_definition}`);
      console.log();
    });
  }

} catch (error) {
  console.error('Error:', error.message);
  console.error('\nFull error:', error);
} finally {
  await pool.end();
}
