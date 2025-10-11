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

    console.log('🔍 Analyzing current league_invitations table schema...');

    // Get current table structure
    const currentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'league_invitations'
      ORDER BY ordinal_position
    `);

    const columnNames = currentColumns.rows.map(col => col.column_name);
    const changes = [];

    // Check if we need to migrate column names
    const needsMigration = (
      columnNames.includes('inviting_user_id') ||
      columnNames.includes('invited_user_id') ||
      columnNames.includes('status')
    );

    if (!needsMigration) {
      return res.status(200).json({
        success: true,
        message: 'Schema is already correct',
        current_columns: columnNames,
        changes_needed: []
      });
    }

    console.log('🏗️ Starting schema migration...');

    // Start transaction for safety
    await client.query('BEGIN');

    try {
      // Step 1: Add new columns if they don't exist
      if (columnNames.includes('inviting_user_id') && !columnNames.includes('league_inviter_id')) {
        await client.query(`
          ALTER TABLE league_invitations
          ADD COLUMN league_inviter_id INTEGER
        `);
        changes.push('Added league_inviter_id column');
      }

      if (columnNames.includes('invited_user_id') && !columnNames.includes('league_invited_player_id')) {
        await client.query(`
          ALTER TABLE league_invitations
          ADD COLUMN league_invited_player_id INTEGER
        `);
        changes.push('Added league_invited_player_id column');
      }

      if (columnNames.includes('status') && !columnNames.includes('invitation_status')) {
        await client.query(`
          ALTER TABLE league_invitations
          ADD COLUMN invitation_status VARCHAR(20) DEFAULT 'pending'
        `);
        changes.push('Added invitation_status column');
      }

      // Step 2: Copy data from old columns to new columns
      if (columnNames.includes('inviting_user_id')) {
        await client.query(`
          UPDATE league_invitations
          SET league_inviter_id = inviting_user_id
          WHERE league_inviter_id IS NULL
        `);
        changes.push('Copied data from inviting_user_id to league_inviter_id');
      }

      if (columnNames.includes('invited_user_id')) {
        await client.query(`
          UPDATE league_invitations
          SET league_invited_player_id = invited_user_id
          WHERE league_invited_player_id IS NULL
        `);
        changes.push('Copied data from invited_user_id to league_invited_player_id');
      }

      if (columnNames.includes('status')) {
        await client.query(`
          UPDATE league_invitations
          SET invitation_status = status
          WHERE invitation_status IS NULL OR invitation_status = 'pending'
        `);
        changes.push('Copied data from status to invitation_status');
      }

      // Step 3: Add NOT NULL constraints to new columns
      await client.query(`
        ALTER TABLE league_invitations
        ALTER COLUMN league_inviter_id SET NOT NULL
      `);

      await client.query(`
        ALTER TABLE league_invitations
        ALTER COLUMN league_invited_player_id SET NOT NULL
      `);

      changes.push('Added NOT NULL constraints');

      // Step 4: Add check constraint for invitation_status
      await client.query(`
        ALTER TABLE league_invitations
        ADD CONSTRAINT check_invitation_status
        CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'expired'))
      `);
      changes.push('Added status validation constraint');

      // Step 5: Add foreign key constraints if they don't exist
      try {
        await client.query(`
          ALTER TABLE league_invitations
          ADD CONSTRAINT fk_league_inviter
          FOREIGN KEY (league_inviter_id) REFERENCES players(player_id) ON DELETE CASCADE
        `);
        changes.push('Added foreign key constraint for league_inviter_id');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }

      try {
        await client.query(`
          ALTER TABLE league_invitations
          ADD CONSTRAINT fk_league_invited_player
          FOREIGN KEY (league_invited_player_id) REFERENCES players(player_id) ON DELETE CASCADE
        `);
        changes.push('Added foreign key constraint for league_invited_player_id');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }

      // Step 6: Add missing columns if needed
      if (!columnNames.includes('invitation_message')) {
        await client.query(`
          ALTER TABLE league_invitations
          ADD COLUMN invitation_message TEXT
        `);
        changes.push('Added invitation_message column');
      }

      if (!columnNames.includes('invited_at')) {
        await client.query(`
          ALTER TABLE league_invitations
          ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        `);
        changes.push('Added invited_at column');
      }

      // Step 7: Create unique constraint for preventing duplicate invitations
      try {
        await client.query(`
          ALTER TABLE league_invitations
          ADD CONSTRAINT unique_pending_invitation
          UNIQUE (league_id, league_invited_player_id, invitation_status)
        `);
        changes.push('Added unique constraint for duplicate prevention');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn('Warning: Could not add unique constraint:', error.message);
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Schema migration completed successfully!');

      // Get final table structure
      const finalColumns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'league_invitations'
        ORDER BY ordinal_position
      `);

      return res.status(200).json({
        success: true,
        message: 'Schema migration completed successfully',
        changes_made: changes,
        final_schema: finalColumns.rows.map(col => ({
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
    console.error('❌ Schema migration error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      message: 'Failed to migrate league_invitations schema'
    });
  } finally {
    if (client) client.release();
  }
}