// Fixed script to create the missing league_invitations table
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createLeagueInvitationsTable() {
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

    if (tableExists.rows[0].exists) {
      console.log('✅ league_invitations table already exists!');

      // Verify table structure
      console.log('🔍 Verifying table structure...');
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'league_invitations'
        ORDER BY ordinal_position
      `);

      console.log('📋 Current table structure:');
      columnsResult.rows.forEach(column => {
        console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
      });

      return;
    }

    console.log('🏗️ Creating league_invitations table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS league_invitations (
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

    console.log('✅ league_invitations table created successfully!');

    // Verify table creation
    console.log('🔍 Verifying table structure...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'league_invitations'
      ORDER BY ordinal_position
    `);

    console.log('📋 Final table structure:');
    columnsResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
    });

    // Test that the invite API dependencies exist
    console.log('🔍 Checking dependencies...');
    const dependencies = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'leagues') as leagues_table,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'players') as players_table,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'league_memberships') as memberships_table
    `);

    const deps = dependencies.rows[0];
    console.log(`📋 Dependencies: leagues(${deps.leagues_table}), players(${deps.players_table}), memberships(${deps.memberships_table})`);

    if (deps.leagues_table === '0' || deps.players_table === '0') {
      console.warn('⚠️  Warning: Missing required tables (leagues or players)');
    }

  } catch (error) {
    console.error('❌ Error creating table:', error);

    if (error.code === 'XX000' || error.message.includes('password authentication')) {
      console.error('🔐 Database authentication failed. Check your DATABASE_URL in .env file');
    } else if (error.code === '42P01') {
      console.error('🏗️  Missing referenced table. Ensure leagues and players tables exist first.');
    }

    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

createLeagueInvitationsTable();