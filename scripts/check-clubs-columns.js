import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const result = await pool.query(`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'clubs'
  ORDER BY ordinal_position
`);

console.log('Columns in clubs table:');
result.rows.forEach(row => console.log('  -', row.column_name));

await pool.end();
