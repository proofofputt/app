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
    console.log('Starting duels schema migration...');
    
    // Check if the old columns exist
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND column_name IN ('challenger_id', 'challengee_id', 'duel_creator_id', 'duel_invited_player_id')
    `);
    
    const existingColumns = columnsCheck.rows.map(row => row.column_name);
    console.log('Existing columns:', existingColumns);
    
    // If we have the old challenger/challengee columns, migrate to new names
    if (existingColumns.includes('challenger_id') && existingColumns.includes('challengee_id')) {
      console.log('Found old column names, migrating to clearer names...');
      
      // Add new columns
      await client.query(`
        ALTER TABLE duels 
        ADD COLUMN IF NOT EXISTS duel_creator_id INTEGER,
        ADD COLUMN IF NOT EXISTS duel_invited_player_id INTEGER
      `);
      
      // Copy data from old columns to new columns
      await client.query(`
        UPDATE duels 
        SET duel_creator_id = challenger_id,
            duel_invited_player_id = challengee_id
        WHERE duel_creator_id IS NULL OR duel_invited_player_id IS NULL
      `);
      
      // Add foreign key constraints
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT fk_duels_creator 
        FOREIGN KEY (duel_creator_id) REFERENCES players(player_id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_duels_invited_player 
        FOREIGN KEY (duel_invited_player_id) REFERENCES players(player_id) ON DELETE CASCADE
      `);
      
      // Add constraint to prevent self-challenges
      await client.query(`
        ALTER TABLE duels 
        ADD CONSTRAINT no_self_duel_challenge 
        CHECK (duel_creator_id != duel_invited_player_id)
      `);
      
      // Update indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_duels_creator ON duels(duel_creator_id, status);
        CREATE INDEX IF NOT EXISTS idx_duels_invited_player ON duels(duel_invited_player_id, status);
      `);
      
      // Drop old columns
      await client.query(`
        ALTER TABLE duels 
        DROP COLUMN IF EXISTS challenger_id,
        DROP COLUMN IF EXISTS challengee_id
      `);
      
      console.log('Migration completed: challenger_id -> duel_creator_id, challengee_id -> duel_invited_player_id');
      
    } else if (existingColumns.includes('duel_creator_id') && existingColumns.includes('duel_invited_player_id')) {
      console.log('Schema already uses clear column names - no migration needed');
    } else {
      // Create the table with the correct schema if it doesn't exist
      console.log('Creating duels table with clear column names...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS duels (
          duel_id SERIAL PRIMARY KEY,
          duel_creator_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          duel_invited_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined', 'cancelled')),
          rules JSONB DEFAULT '{}',
          settings JSONB DEFAULT '{}',
          
          -- Session tracking
          duel_creator_session_id INTEGER,
          duel_invited_player_session_id INTEGER,
          duel_creator_session_data JSONB,
          duel_invited_player_session_data JSONB,
          
          -- Scoring and results
          duel_creator_score INTEGER DEFAULT 0,
          duel_invited_player_score INTEGER DEFAULT 0,
          winner_id INTEGER REFERENCES players(player_id),
          
          -- Timing
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          accepted_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
          
          -- Metadata
          duel_type VARCHAR(50) DEFAULT 'practice',
          invite_message TEXT,
          completion_reason VARCHAR(100),
          
          -- Prevent users from challenging themselves
          CONSTRAINT no_self_duel_challenge CHECK (duel_creator_id != duel_invited_player_id)
        )
      `);
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_duels_creator ON duels(duel_creator_id, status);
        CREATE INDEX IF NOT EXISTS idx_duels_invited_player ON duels(duel_invited_player_id, status);
        CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
        CREATE INDEX IF NOT EXISTS idx_duels_created ON duels(created_at DESC);
      `);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Duels schema migration completed successfully',
      existingColumns
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      error: 'Failed to migrate duels schema',
      details: error.message 
    });
  } finally {
    client.release();
  }
}