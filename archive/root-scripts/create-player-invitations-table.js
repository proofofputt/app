// Script to create the missing player_invitations table
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createPlayerInvitationsTable() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🏗️ Creating player_invitations table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_invitations (
        invitation_id SERIAL PRIMARY KEY,
        inviter_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('email', 'phone', 'username')),
        contact_value VARCHAR(255) NOT NULL,
        invitation_type VARCHAR(20) NOT NULL CHECK (invitation_type IN ('duel', 'league', 'friend')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
        
        -- Optional reference to the invited player (if they exist)
        invited_player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
        
        -- Optional reference to specific competition
        duel_id INTEGER REFERENCES duels(duel_id) ON DELETE CASCADE,
        league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
        
        -- Invitation metadata
        invitation_message TEXT,
        invitation_data JSONB DEFAULT '{}',
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        responded_at TIMESTAMP WITH TIME ZONE,
        
        -- Ensure contact_value is unique per inviter for active invitations
        UNIQUE(inviter_id, contact_value, invitation_type, status)
      )
    `);
    
    // Create indexes for performance
    console.log('🔍 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_player_invitations_inviter ON player_invitations(inviter_id, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_player_invitations_contact ON player_invitations(contact_type, contact_value)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_player_invitations_type ON player_invitations(invitation_type, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_player_invitations_expires ON player_invitations(expires_at)');
    
    console.log('✅ player_invitations table created successfully!');
    
    // Verify table creation
    console.log('🔍 Verifying table structure...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'player_invitations'
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

createPlayerInvitationsTable();