import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addOAuthModeColumn() {
  try {
    console.log('Adding mode column to oauth_sessions table...');
    
    await pool.query(`
      ALTER TABLE oauth_sessions
      ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'login';
    `);
    
    console.log('✓ Successfully added mode column to oauth_sessions');
    
  } catch (error) {
    console.error('Error adding mode column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addOAuthModeColumn().catch(console.error);
