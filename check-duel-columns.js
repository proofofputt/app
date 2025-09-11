// Script to check the duels table structure
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDuelColumns() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking duels table structure...');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'duels'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Duels table columns:');
    columnsResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking duels table:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
checkDuelColumns()
  .then(() => {
    console.log('Table structure check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Table structure check failed:', error);
    process.exit(1);
  });