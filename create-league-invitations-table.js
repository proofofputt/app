// Script to create the missing league_invitations table
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DBTZhnuE3S7F@ep-wandering-sunset-adkfomii-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function createLeagueInvitationsTable() {
  let client;
  try {
    client = await pool.connect();
    
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
        
        -- Ensure no duplicate invitations
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
    
    console.log('📋 Table structure:');
    columnsResult.rows.forEach(column => {
      console.log(`   ${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

createLeagueInvitationsTable();