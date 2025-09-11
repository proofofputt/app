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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for duels with missing or invalid player data...');
    
    // Check recent duels and their associated players
    const duelsCheck = await client.query(`
      SELECT 
        d.duel_id,
        d.duel_creator_id,
        d.duel_invited_player_id,
        d.status,
        d.created_at,
        creator.name as creator_name,
        creator.email as creator_email,
        invited.name as invited_name,
        invited.email as invited_email
      FROM duels d
      LEFT JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited ON d.duel_invited_player_id = invited.player_id
      WHERE d.created_at > NOW() - INTERVAL '2 hours'
      ORDER BY d.created_at DESC
    `);
    
    console.log('Recent duels found:', duelsCheck.rows.length);
    
    // Find duels with missing player references or test data
    const problematicDuels = duelsCheck.rows.filter(duel => 
      !duel.creator_name || !duel.invited_name || 
      duel.creator_name.includes('Invited') || 
      duel.invited_name?.includes('Invited') ||
      duel.creator_email?.includes('temp_') ||
      duel.invited_email?.includes('temp_')
    );
    
    const results = {
      totalDuelsChecked: duelsCheck.rows.length,
      problematicDuelsFound: problematicDuels.length,
      cleanedUp: [],
      remaining: []
    };
    
    if (problematicDuels.length > 0) {
      console.log('🧹 Found problematic duels to clean up:', problematicDuels.length);
      
      // Delete problematic duels
      for (const duel of problematicDuels) {
        console.log(`🗑️  Deleting duel ${duel.duel_id}...`);
        await client.query('DELETE FROM duels WHERE duel_id = $1', [duel.duel_id]);
        
        results.cleanedUp.push({
          duel_id: duel.duel_id,
          creator_name: duel.creator_name,
          invited_name: duel.invited_name,
          reason: 'Test data or missing player reference'
        });
        
        // Also clean up any temporary players created for testing
        if (duel.creator_name?.includes('Invited') || duel.creator_email?.includes('temp_')) {
          console.log(`🗑️  Deleting temporary creator player ${duel.duel_creator_id}...`);
          await client.query('DELETE FROM players WHERE player_id = $1 AND (name LIKE \'%Invited%\' OR email LIKE \'%temp_%\')', [duel.duel_creator_id]);
        }
        
        if (duel.invited_name?.includes('Invited') || duel.invited_email?.includes('temp_')) {
          console.log(`🗑️  Deleting temporary invited player ${duel.duel_invited_player_id}...`);
          await client.query('DELETE FROM players WHERE player_id = $1 AND (name LIKE \'%Invited%\' OR email LIKE \'%temp_%\')', [duel.duel_invited_player_id]);
        }
      }
      
      console.log('✅ Cleanup completed!');
    } else {
      console.log('✅ No problematic duels found.');
    }
    
    // Show current valid duels
    console.log('📋 Checking remaining valid duels...');
    const validDuels = await client.query(`
      SELECT 
        d.duel_id,
        d.status,
        creator.name as creator_name,
        invited.name as invited_name,
        d.created_at
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited ON d.duel_invited_player_id = invited.player_id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);
    
    results.remaining = validDuels.rows.map(duel => ({
      duel_id: duel.duel_id,
      creator_name: duel.creator_name,
      invited_name: duel.invited_name || 'Unknown',
      status: duel.status,
      created_at: duel.created_at
    }));
    
    return res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      results: results
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  } finally {
    client.release();
  }
}