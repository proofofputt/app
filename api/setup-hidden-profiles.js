import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  
  try {
    console.log('Setting up hidden player profiles system...');
    
    // Add columns to players table for hidden profiles
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS invitation_identifier VARCHAR(255),
      ADD COLUMN IF NOT EXISTS identifier_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES players(player_id),
      ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE
    `);
    
    // Create index for fast lookups of invitations by identifier
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_invitation_identifier 
      ON players(invitation_identifier, identifier_type) 
      WHERE is_hidden = true
    `);
    
    // Create index for invited players
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_players_invited_by 
      ON players(invited_by) 
      WHERE invited_by IS NOT NULL
    `);
    
    // Create invitations table for tracking pending invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        invitation_id SERIAL PRIMARY KEY,
        inviter_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        hidden_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        invitation_type VARCHAR(50) NOT NULL, -- 'duel', 'league', 'friend'
        invitation_data JSONB DEFAULT '{}', -- Store duel_id, league_id, etc.
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
        identifier VARCHAR(255) NOT NULL, -- email, phone, telegram handle
        identifier_type VARCHAR(50) NOT NULL, -- 'email', 'phone', 'telegram', etc.
        message TEXT,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Unique constraint to prevent duplicate invitations
        UNIQUE(inviter_id, identifier, identifier_type, invitation_type, invitation_data)
      )
    `);
    
    // Create indexes for invitations
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invitations_identifier 
      ON invitations(identifier, identifier_type, status);
      
      CREATE INDEX IF NOT EXISTS idx_invitations_hidden_player 
      ON invitations(hidden_player_id, status);
      
      CREATE INDEX IF NOT EXISTS idx_invitations_inviter 
      ON invitations(inviter_id, status);
      
      CREATE INDEX IF NOT EXISTS idx_invitations_expires 
      ON invitations(expires_at) 
      WHERE status = 'pending';
    `);

    return res.status(200).json({ 
      success: true,
      message: 'Hidden player profiles system setup completed successfully' 
    });

  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ 
      error: 'Failed to setup hidden profiles system',
      details: error.message 
    });
  } finally {
    client.release();
  }
}