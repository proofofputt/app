import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify authentication
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { duelId } = req.query;
  
  if (!duelId) {
    return res.status(400).json({ success: false, message: 'Duel ID is required' });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('Cancel Duel API: Database connected successfully');

    // First, get the duel details and verify permissions
    const duelResult = await client.query(`
      SELECT 
        duel_id,
        duel_creator_id,
        duel_invited_player_id,
        status,
        creator.name as creator_name,
        invited_player.name as invited_player_name
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      LEFT JOIN players invited_player ON d.duel_invited_player_id = invited_player.player_id
      WHERE d.duel_id = $1
    `, [duelId]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Duel not found' });
    }

    const duel = duelResult.rows[0];

    // Check if user is the creator (only creators can cancel their own duels)
    if (duel.duel_creator_id !== user.playerId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only the duel creator can cancel the invitation' 
      });
    }

    // Check if duel can be cancelled (only pending duels)
    if (!['pending', 'pending_new_player'].includes(duel.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel duel with status: ${duel.status}` 
      });
    }

    // Cancel the duel by updating status to 'cancelled'
    const cancelResult = await client.query(`
      UPDATE duels 
      SET status = 'cancelled', updated_at = NOW()
      WHERE duel_id = $1
      RETURNING duel_id, status, updated_at
    `, [duelId]);

    console.log(`✅ Duel ${duelId} cancelled by user ${user.playerId}`);

    // Also clean up any temporary players created for email/phone invitations
    if (duel.status === 'pending_new_player' && duel.duel_invited_player_id) {
      try {
        // Check if the invited player is temporary (has no sessions/activity)
        const tempPlayerCheck = await client.query(`
          SELECT COUNT(*) as session_count 
          FROM sessions 
          WHERE player_id = $1
        `, [duel.duel_invited_player_id]);

        const sessionCount = parseInt(tempPlayerCheck.rows[0].session_count);
        
        if (sessionCount === 0) {
          // Safe to delete temporary player since they have no activity
          await client.query(`
            DELETE FROM players 
            WHERE player_id = $1 
            AND email LIKE '%@phone.local' OR email LIKE 'temp_%'
          `, [duel.duel_invited_player_id]);
          
          console.log(`🧹 Cleaned up temporary player ${duel.duel_invited_player_id}`);
        }
      } catch (cleanupError) {
        console.warn('Could not clean up temporary player:', cleanupError.message);
        // Don't fail the cancellation if cleanup fails
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Duel invitation cancelled successfully',
      duel: {
        duel_id: duel.duel_id,
        status: 'cancelled',
        creator_name: duel.creator_name,
        invited_player_name: duel.invited_player_name,
        cancelled_at: cancelResult.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('Cancel duel error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel duel invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
}