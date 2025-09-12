import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let client;
  try {
    client = await pool.connect();
    
    console.log('Finding drawn duels for Pop@proofofputt...');
    
    // Find the problematic duel(s)
    const findQuery = `
      SELECT 
        d.duel_id,
        d.status,
        d.creator_score,
        d.invited_player_score,
        d.created_at,
        creator.email as creator_email,
        invited.email as invited_email
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      JOIN players invited ON d.duel_invited_player_id = invited.player_id
      WHERE (creator.email = 'pop@proofofputt.com' OR invited.email = 'pop@proofofputt.com')
        AND d.status = 'completed'
        AND d.creator_score = 0 
        AND d.invited_player_score = 0
      ORDER BY d.created_at DESC;
    `;
    
    const duelsResult = await client.query(findQuery);
    
    if (duelsResult.rows.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No drawn duels found for Pop@proofofputt',
        deleted: 0
      });
    }
    
    console.log('Found drawn duels:', duelsResult.rows);
    
    // Delete all drawn duels (0-0 score)
    const deleteQuery = `
      DELETE FROM duels 
      WHERE duel_id IN (
        SELECT d.duel_id
        FROM duels d
        JOIN players creator ON d.duel_creator_id = creator.player_id
        JOIN players invited ON d.duel_invited_player_id = invited.player_id
        WHERE (creator.email = 'pop@proofofputt.com' OR invited.email = 'pop@proofofputt.com')
          AND d.status = 'completed'
          AND d.creator_score = 0 
          AND d.invited_player_score = 0
      )
      RETURNING duel_id;
    `;
    
    const deleteResult = await client.query(deleteQuery);
    
    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.rows.length} drawn duel(s)`,
      deleted: deleteResult.rows.length,
      duelIds: deleteResult.rows.map(row => row.duel_id),
      foundDuels: duelsResult.rows
    });
    
  } catch (error) {
    console.error('Error deleting drawn duel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete drawn duel',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
}