// Script to check what tables exist in the database
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🔍 Checking available tables...');
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Also check for any competition-related tables
    console.log('\n🔍 Searching for competition-related tables...');
    const competitionTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%duel%' OR table_name LIKE '%league%' OR table_name LIKE '%competition%')
      ORDER BY table_name
    `);
    
    if (competitionTablesResult.rows.length > 0) {
      console.log('🏆 Competition-related tables found:');
      competitionTablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('❌ No competition-related tables found');
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
checkTables()
  .then(() => {
    console.log('Table check completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Table check failed:', error);
    process.exit(1);
  });