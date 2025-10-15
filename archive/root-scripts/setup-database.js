// Script to set up duels and leagues tables
import { Pool } from 'pg';
import { readFileSync } from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🏗️ Setting up duels and leagues database tables...');
    
    // Read the SQL setup file
    const sqlSetup = readFileSync('/Users/nw/proofofputt-repos/proofofputt/Handover-Reports/DUELS_LEAGUES_NEONDB_SETUP.sql', 'utf8');
    
    // Split the SQL into individual statements (basic approach)
    const statements = sqlSetup
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement);
        } catch (error) {
          // Skip errors for statements that might already exist or are optional
          if (error.code === '42P07' || error.code === '42P01') {
            console.log(`⚠️  Skipping statement ${i + 1} (already exists or optional): ${error.message}`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            // Continue with other statements
          }
        }
      }
    }
    
    console.log('✅ Database setup completed!');
    
    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%duel%' OR table_name LIKE '%league%')
      ORDER BY table_name
    `);
    
    console.log('🏆 Competition tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
setupDatabase()
  .then(() => {
    console.log('Database setup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });