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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed - use POST' });
  }

  let client;
  try {
    client = await pool.connect();

    console.log('[Migration] Fixing ALL users -> players foreign key references...');
    const fixes = [];
    const errors = [];

    // Tables with user_id columns that should point to players
    const tablesToFix = [
      { table: 'league_invitations', column: 'invited_user_id', rename_to: 'invited_player_id' },
      { table: 'league_invitations', column: 'inviting_user_id', rename_to: 'inviting_player_id' },
      { table: 'league_notifications', column: 'user_id', rename_to: 'player_id' },
      { table: 'league_round_sessions', column: 'player_id', rename_to: null }, // Already named correctly
    ];

    for (const { table, column, rename_to } of tablesToFix) {
      try {
        // Drop old constraint
        const constraintName = `${table}_${column}_fkey`;
        await client.query(`
          ALTER TABLE ${table}
          DROP CONSTRAINT IF EXISTS ${constraintName}
        `);

        // Rename column if needed
        if (rename_to && rename_to !== column) {
          try {
            await client.query(`
              ALTER TABLE ${table}
              RENAME COLUMN ${column} TO ${rename_to}
            `);
            console.log(`[Migration] Renamed ${table}.${column} to ${rename_to}`);
          } catch (renameError) {
            console.log(`[Migration] Column ${table}.${column} might already be renamed:`, renameError.message);
          }
        }

        const finalColumn = rename_to || column;

        // Add new constraint pointing to players
        await client.query(`
          ALTER TABLE ${table}
          ADD CONSTRAINT ${table}_${finalColumn}_fkey
          FOREIGN KEY (${finalColumn}) REFERENCES players(player_id) ON DELETE CASCADE
        `);

        fixes.push(`${table}.${finalColumn} -> players.player_id`);
        console.log(`[Migration] Fixed ${table}.${finalColumn}`);
      } catch (error) {
        console.error(`[Migration] Error fixing ${table}.${column}:`, error.message);
        errors.push(`${table}.${column}: ${error.message}`);
      }
    }

    // Verify all foreign keys
    const verification = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name LIKE '%league%' OR ccu.table_name = 'users')
      ORDER BY tc.table_name, kcu.column_name
    `);

    const stillWrong = verification.rows.filter(fk => fk.foreign_table_name === 'users');

    return res.status(200).json({
      success: true,
      message: 'Users to players foreign key migration complete',
      fixes_applied: fixes,
      errors: errors,
      remaining_users_references: stillWrong,
      all_league_foreign_keys: verification.rows
    });

  } catch (error) {
    console.error('[Migration] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
