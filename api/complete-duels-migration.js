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
    console.log('Completing duels migration...');
    
    // First check current state
    const currentColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND column_name IN ('challenger_id', 'challenged_id', 'challengee_id', 'duel_creator_id', 'duel_invited_player_id')
    `);
    
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    console.log('Current columns:', existingColumns);
    
    // Check for data in old columns
    const dataCheck = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(challenger_id) as challenger_count,
        COUNT(challenged_id) as challenged_count,
        COUNT(duel_creator_id) as creator_count,
        COUNT(duel_invited_player_id) as invited_count
      FROM duels
    `);
    
    console.log('Data distribution:', dataCheck.rows[0]);
    
    // Step 1: Copy data from old columns to new columns (if any exists)
    if (existingColumns.includes('challenger_id') && existingColumns.includes('challenged_id')) {
      console.log('Copying data from old columns to new columns...');
      
      await client.query(`
        UPDATE duels 
        SET 
          duel_creator_id = challenger_id,
          duel_invited_player_id = challenged_id
        WHERE duel_creator_id IS NULL OR duel_invited_player_id IS NULL
      `);
    }
    
    // Step 2: Make new columns NOT NULL if they have data
    const finalDataCheck = await client.query(`
      SELECT COUNT(*) as count FROM duels WHERE duel_creator_id IS NOT NULL AND duel_invited_player_id IS NOT NULL
    `);
    
    if (finalDataCheck.rows[0].count > 0) {
      console.log('Making new columns NOT NULL...');
      
      await client.query(`
        ALTER TABLE duels 
        ALTER COLUMN duel_creator_id SET NOT NULL,
        ALTER COLUMN duel_invited_player_id SET NOT NULL
      `);
    }
    
    // Step 3: Drop old columns
    console.log('Dropping old columns...');
    
    if (existingColumns.includes('challenger_id')) {
      await client.query(`ALTER TABLE duels DROP COLUMN challenger_id`);
    }
    
    if (existingColumns.includes('challenged_id')) {
      await client.query(`ALTER TABLE duels DROP COLUMN challenged_id`);
    }
    
    if (existingColumns.includes('challengee_id')) {
      await client.query(`ALTER TABLE duels DROP COLUMN challengee_id`);
    }
    
    // Step 4: Ensure we have all the columns the API expects
    const missingColumns = [];
    
    const expectedColumns = [
      'duel_creator_session_id', 'duel_invited_player_session_id',
      'duel_creator_session_data', 'duel_invited_player_session_data', 
      'duel_creator_score', 'duel_invited_player_score',
      'settings', 'expires_at', 'accepted_at', 'duel_type', 'invite_message', 'completion_reason'
    ];
    
    for (const column of expectedColumns) {
      const columnExists = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'duels' AND column_name = $1
      `, [column]);
      
      if (columnExists.rows.length === 0) {
        missingColumns.push(column);
      }
    }
    
    console.log('Missing columns:', missingColumns);
    
    // Add missing columns
    if (missingColumns.length > 0) {
      const alterStatements = [];
      
      for (const column of missingColumns) {
        switch (column) {
          case 'duel_creator_session_id':
          case 'duel_invited_player_session_id':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} INTEGER`);
            break;
          case 'duel_creator_session_data':
          case 'duel_invited_player_session_data':
          case 'settings':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} JSONB DEFAULT '{}'`);
            break;
          case 'duel_creator_score':
          case 'duel_invited_player_score':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} INTEGER DEFAULT 0`);
            break;
          case 'expires_at':
          case 'accepted_at':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} TIMESTAMP WITH TIME ZONE`);
            break;
          case 'duel_type':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} VARCHAR(50) DEFAULT 'practice'`);
            break;
          case 'invite_message':
          case 'completion_reason':
            alterStatements.push(`ADD COLUMN IF NOT EXISTS ${column} TEXT`);
            break;
        }
      }
      
      if (alterStatements.length > 0) {
        await client.query(`ALTER TABLE duels ${alterStatements.join(', ')}`);
      }
    }
    
    // Final verification
    const finalColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      ORDER BY ordinal_position
    `);
    
    return res.status(200).json({ 
      success: true,
      message: 'Duels migration completed successfully',
      finalColumns: finalColumns.rows.map(row => row.column_name),
      missingColumnsAdded: missingColumns
    });

  } catch (error) {
    console.error('Migration completion error:', error);
    return res.status(500).json({ 
      error: 'Failed to complete duels migration',
      details: error.message 
    });
  } finally {
    client.release();
  }
}