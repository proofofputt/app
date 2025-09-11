import { Pool } from 'pg';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add a safety confirmation
  const { confirm } = req.body || {};
  if (confirm !== 'DELETE_ALL_DUELS') {
    return res.status(400).json({ 
      error: 'Safety confirmation required',
      message: 'Send { "confirm": "DELETE_ALL_DUELS" } to proceed'
    });
  }

  const client = await pool.connect();
  
  try {
    console.log('Starting deletion of all duels...');
    
    // Count duels before deletion
    const countBefore = await client.query('SELECT COUNT(*) as count FROM duels');
    const duelsBefore = parseInt(countBefore.rows[0].count);
    
    // Delete all duel invitations if the table exists
    try {
      await client.query('DELETE FROM duel_invitations WHERE 1=1');
      console.log('Deleted all duel invitations');
    } catch (err) {
      console.log('No duel_invitations table or already empty');
    }
    
    // Delete all duels
    const deleteResult = await client.query('DELETE FROM duels WHERE 1=1');
    console.log(`Deleted ${deleteResult.rowCount} duels`);
    
    // Reset the sequence (optional - comment out if you want to keep incrementing)
    try {
      await client.query('ALTER SEQUENCE duels_duel_id_seq RESTART WITH 1');
      console.log('Reset duel_id sequence to 1');
    } catch (err) {
      console.log('Could not reset sequence:', err.message);
    }
    
    // Count duels after deletion (should be 0)
    const countAfter = await client.query('SELECT COUNT(*) as count FROM duels');
    const duelsAfter = parseInt(countAfter.rows[0].count);
    
    return res.status(200).json({ 
      success: true,
      message: 'All duels deleted successfully',
      stats: {
        duels_before: duelsBefore,
        duels_deleted: deleteResult.rowCount,
        duels_remaining: duelsAfter,
        sequence_reset: true
      }
    });

  } catch (error) {
    console.error('Error deleting duels:', error);
    return res.status(500).json({ 
      error: 'Failed to delete duels',
      details: error.message 
    });
  } finally {
    client.release();
  }
}