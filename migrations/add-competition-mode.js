import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting competition mode migration...');

    // Start transaction
    await client.query('BEGIN');

    // Add competition_mode column to duels table
    console.log('Adding competition_mode column to duels table...');
    await client.query(`
      ALTER TABLE duels
      ADD COLUMN IF NOT EXISTS competition_mode VARCHAR(20) DEFAULT 'time_limit'
      CHECK (competition_mode IN ('time_limit', 'shoot_out'))
    `);

    // Update existing duels to have explicit competition_mode
    console.log('Setting default competition_mode for existing duels...');
    const updateResult = await client.query(`
      UPDATE duels
      SET competition_mode = 'time_limit'
      WHERE competition_mode IS NULL
    `);
    console.log(`Updated ${updateResult.rowCount} duels`);

    // Create index for performance
    console.log('Creating index on competition_mode...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_duels_competition_mode ON duels(competition_mode)
    `);

    // Add documentation
    console.log('Adding column documentation...');
    await client.query(`
      COMMENT ON COLUMN duels.competition_mode IS
      'Competition format: time_limit (traditional timed session) or shoot_out (fixed number of attempts)'
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });