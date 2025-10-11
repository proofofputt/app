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
    console.log('Starting duel session column type fix...');
    
    // Check current column types
    const currentColumnsResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND column_name IN ('duel_creator_session_id', 'duel_invited_player_session_id')
    `);
    
    console.log('Current column types:', currentColumnsResult.rows);
    
    // Drop the existing columns if they exist
    await client.query(`
      ALTER TABLE duels 
      DROP COLUMN IF EXISTS duel_creator_session_id,
      DROP COLUMN IF EXISTS duel_invited_player_session_id
    `);
    
    console.log('Dropped existing columns');
    
    // Add the columns back with the correct VARCHAR type
    await client.query(`
      ALTER TABLE duels 
      ADD COLUMN duel_creator_session_id VARCHAR(255),
      ADD COLUMN duel_invited_player_session_id VARCHAR(255)
    `);
    
    console.log('Added columns with VARCHAR type');
    
    // Add foreign key constraints (only if sessions table exists)
    try {
      await client.query(`
        ALTER TABLE duels
        ADD CONSTRAINT fk_duel_creator_session 
        FOREIGN KEY (duel_creator_session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_duel_invited_player_session 
        FOREIGN KEY (duel_invited_player_session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
      `);
      console.log('Added foreign key constraints');
    } catch (fkError) {
      console.log('Could not add foreign key constraints (sessions table may not exist):', fkError.message);
    }
    
    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_duel_creator_session ON duels(duel_creator_session_id);
      CREATE INDEX IF NOT EXISTS idx_duel_invited_player_session ON duels(duel_invited_player_session_id);
    `);
    
    console.log('Created indexes');
    
    // Verify the changes
    const newColumnsResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND column_name IN ('duel_creator_session_id', 'duel_invited_player_session_id')
    `);
    
    return res.status(200).json({ 
      success: true,
      message: 'Duel session column types fixed successfully',
      before: currentColumnsResult.rows,
      after: newColumnsResult.rows
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      error: 'Failed to fix duel session column types',
      details: error.message 
    });
  } finally {
    client.release();
  }
}