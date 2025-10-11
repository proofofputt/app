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

    console.log('🔍 Checking if league_invitations table exists...');

    // Check if table already exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'league_invitations'
      )
    `);

    let tableCreated = false;
    let tableStructure = [];

    if (!tableExists.rows[0].exists) {
      console.log('🏗️ Creating league_invitations table...');

      await client.query(`
        CREATE TABLE league_invitations (
          invitation_id SERIAL PRIMARY KEY,
          league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
          league_inviter_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          league_invited_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          invitation_status VARCHAR(20) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'expired')),
          invitation_message TEXT,
          invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
          responded_at TIMESTAMP WITH TIME ZONE,

          -- Ensure no duplicate pending invitations
          UNIQUE(league_id, league_invited_player_id, invitation_status)
        )
      `);

      // Create indexes for performance
      console.log('🔍 Creating indexes...');
      await client.query('CREATE INDEX IF NOT EXISTS idx_league_invitations_league ON league_invitations(league_id, invitation_status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_league_invitations_invitee ON league_invitations(league_invited_player_id, invitation_status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_league_invitations_expires ON league_invitations(expires_at)');

      tableCreated = true;
      console.log('✅ league_invitations table created successfully!');
    } else {
      console.log('✅ league_invitations table already exists!');
    }

    // Get table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'league_invitations'
      ORDER BY ordinal_position
    `);

    tableStructure = columnsResult.rows;

    // Check dependencies
    const dependencies = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'leagues') as leagues_table,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'players') as players_table,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'league_memberships') as memberships_table
    `);

    const deps = dependencies.rows[0];

    // Test the invitation creation flow
    let testResult = 'not_tested';
    if (req.method === 'POST' && req.body?.test_invitation === true) {
      try {
        // This would test the actual invitation flow, but we'll just check the query structure
        const testQuery = `
          SELECT COUNT(*) FROM league_invitations
          WHERE league_id = 1 AND league_invited_player_id = 1 AND invitation_status = 'pending'
        `;
        await client.query(testQuery);
        testResult = 'query_structure_valid';
      } catch (error) {
        testResult = `query_test_failed: ${error.message}`;
      }
    }

    return res.status(200).json({
      success: true,
      table_created: tableCreated,
      table_exists: tableExists.rows[0].exists || tableCreated,
      table_structure: tableStructure,
      dependencies: {
        leagues: deps.leagues_table > 0,
        players: deps.players_table > 0,
        league_memberships: deps.memberships_table > 0
      },
      test_result: testResult,
      message: tableCreated
        ? 'league_invitations table created successfully'
        : 'league_invitations table already exists'
    });

  } catch (error) {
    console.error('❌ Error with league_invitations table:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      message: 'Failed to create or verify league_invitations table'
    });
  } finally {
    if (client) client.release();
  }
}