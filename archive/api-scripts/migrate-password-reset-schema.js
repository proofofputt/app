import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Analyzing current players table schema for password reset fields...');

    // Get current table structure
    const currentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name IN ('reset_token', 'reset_token_expiry')
      ORDER BY ordinal_position
    `);

    const columnNames = currentColumns.rows.map(col => col.column_name);
    const changes = [];

    console.log('🏗️ Starting password reset schema migration...');

    // Start transaction for safety
    await client.query('BEGIN');

    try {
      // Add reset_token column if it doesn't exist
      if (!columnNames.includes('reset_token')) {
        await client.query(`
          ALTER TABLE players
          ADD COLUMN reset_token VARCHAR(255)
        `);
        changes.push('Added reset_token column');
        console.log('✅ Added reset_token column');
      } else {
        console.log('ℹ️ reset_token column already exists');
      }

      // Add reset_token_expiry column if it doesn't exist
      if (!columnNames.includes('reset_token_expiry')) {
        await client.query(`
          ALTER TABLE players
          ADD COLUMN reset_token_expiry TIMESTAMP WITH TIME ZONE
        `);
        changes.push('Added reset_token_expiry column');
        console.log('✅ Added reset_token_expiry column');
      } else {
        console.log('ℹ️ reset_token_expiry column already exists');
      }

      // Add index for faster reset token lookups if it doesn't exist
      try {
        await client.query(`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_reset_token
          ON players (reset_token)
          WHERE reset_token IS NOT NULL
        `);
        changes.push('Added index for reset_token lookups');
        console.log('✅ Added index for reset_token lookups');
      } catch (indexError) {
        if (!indexError.message.includes('already exists')) {
          console.warn('⚠️ Could not create index:', indexError.message);
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Password reset schema migration completed successfully!');

      // Get final table structure
      const finalColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'players'
        AND column_name IN ('reset_token', 'reset_token_expiry', 'password_hash')
        ORDER BY ordinal_position
      `);

      return res.status(200).json({
        success: true,
        message: changes.length > 0 ? 'Password reset schema migration completed successfully' : 'Password reset schema is already up to date',
        changes_made: changes,
        current_schema: finalColumns.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES'
        }))
      });

    } catch (migrationError) {
      await client.query('ROLLBACK');
      throw migrationError;
    }

  } catch (error) {
    console.error('❌ Password reset schema migration error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      message: 'Failed to migrate password reset schema'
    });
  } finally {
    if (client) client.release();
  }
}