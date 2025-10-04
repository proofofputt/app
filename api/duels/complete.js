import { Pool } from 'pg';
import notificationService from '../services/notification.js';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Check if a duel is complete and determine winner
 * Called automatically when a session is submitted for a duel
 */
export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { duel_id } = req.body;

  if (!duel_id) {
    return res.status(400).json({ success: false, message: 'duel_id is required' });
  }

  const client = await pool.connect();

  try {
    // Get duel details with session data
    const duelResult = await client.query(`
      SELECT
        d.duel_id,
        d.duel_creator_id,
        d.duel_invited_player_id,
        d.status,
        d.duel_creator_session_data,
        d.duel_invited_player_session_data,
        d.duel_creator_score,
        d.duel_invited_player_score,
        creator.name as creator_name,
        invited.name as invited_name
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      JOIN players invited ON d.duel_invited_player_id = invited.player_id
      WHERE d.duel_id = $1
    `, [duel_id]);

    if (duelResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Duel not found' });
    }

    const duel = duelResult.rows[0];

    // Check if duel is already completed
    if (duel.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Duel already completed',
        duel_id: duel.duel_id,
        already_completed: true
      });
    }

    // Check if both players have submitted sessions
    const bothSubmitted = duel.duel_creator_session_data && duel.duel_invited_player_session_data;

    if (!bothSubmitted) {
      return res.status(200).json({
        success: true,
        message: 'Waiting for both players to submit',
        duel_id: duel.duel_id,
        creator_submitted: !!duel.duel_creator_session_data,
        invited_submitted: !!duel.duel_invited_player_session_data
      });
    }

    // Calculate scores from session data
    const creatorScore = duel.duel_creator_session_data?.total_makes || 0;
    const invitedScore = duel.duel_invited_player_session_data?.total_makes || 0;

    // Determine winner
    let winnerId = null;
    let result = 'tie';

    if (creatorScore > invitedScore) {
      winnerId = duel.duel_creator_id;
      result = 'win';
    } else if (invitedScore > creatorScore) {
      winnerId = duel.duel_invited_player_id;
      result = 'win';
    } else {
      result = 'tie';
    }

    // Update duel status to completed
    await client.query(`
      UPDATE duels
      SET
        status = 'completed',
        winner_id = $1,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE duel_id = $2
    `, [winnerId, duel_id]);

    console.log(`[duel-complete] Duel ${duel_id} completed - Winner: ${winnerId || 'tie'}`);

    // Send match result notifications to both players
    try {
      // Notify creator
      const creatorResult = winnerId === duel.duel_creator_id ? 'win' : winnerId === null ? 'tie' : 'lose';
      await notificationService.createMatchResultNotification({
        playerId: duel.duel_creator_id,
        matchType: 'duel',
        result: creatorResult,
        opponentName: duel.invited_name,
        matchId: duel.duel_id
      });

      // Notify invited player
      const invitedResult = winnerId === duel.duel_invited_player_id ? 'win' : winnerId === null ? 'tie' : 'lose';
      await notificationService.createMatchResultNotification({
        playerId: duel.duel_invited_player_id,
        matchType: 'duel',
        result: invitedResult,
        opponentName: duel.creator_name,
        matchId: duel.duel_id
      });

      console.log(`[duel-complete] Match result notifications sent for duel ${duel_id}`);
    } catch (notifError) {
      console.error('[duel-complete] Failed to send match result notifications:', notifError);
      // Non-blocking: continue even if notifications fail
    }

    return res.status(200).json({
      success: true,
      message: 'Duel completed successfully',
      duel: {
        duel_id: duel.duel_id,
        status: 'completed',
        winner_id: winnerId,
        result,
        creator_score: creatorScore,
        invited_score: invitedScore,
        creator_name: duel.creator_name,
        invited_name: duel.invited_name
      }
    });

  } catch (error) {
    console.error('[duel-complete] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete duel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}

/**
 * Helper function to check and complete duel (can be called from session upload)
 */
export async function checkAndCompleteDuel(client, duelId) {
  try {
    const duelResult = await client.query(`
      SELECT
        d.duel_id,
        d.duel_creator_id,
        d.duel_invited_player_id,
        d.status,
        d.duel_creator_session_data,
        d.duel_invited_player_session_data,
        creator.name as creator_name,
        invited.name as invited_name
      FROM duels d
      JOIN players creator ON d.duel_creator_id = creator.player_id
      JOIN players invited ON d.duel_invited_player_id = invited.player_id
      WHERE d.duel_id = $1 AND d.status = 'active'
    `, [duelId]);

    if (duelResult.rows.length === 0) return;

    const duel = duelResult.rows[0];
    const bothSubmitted = duel.duel_creator_session_data && duel.duel_invited_player_session_data;

    if (!bothSubmitted) return;

    // Calculate scores
    const creatorScore = duel.duel_creator_session_data?.total_makes || 0;
    const invitedScore = duel.duel_invited_player_session_data?.total_makes || 0;

    // Determine winner
    let winnerId = null;
    if (creatorScore > invitedScore) {
      winnerId = duel.duel_creator_id;
    } else if (invitedScore > creatorScore) {
      winnerId = duel.duel_invited_player_id;
    }

    // Update duel
    await client.query(`
      UPDATE duels
      SET
        status = 'completed',
        winner_id = $1,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE duel_id = $2
    `, [winnerId, duelId]);

    // Send notifications
    const creatorResult = winnerId === duel.duel_creator_id ? 'win' : winnerId === null ? 'tie' : 'lose';
    await notificationService.createMatchResultNotification({
      playerId: duel.duel_creator_id,
      matchType: 'duel',
      result: creatorResult,
      opponentName: duel.invited_name,
      matchId: duel.duel_id
    });

    const invitedResult = winnerId === duel.duel_invited_player_id ? 'win' : winnerId === null ? 'tie' : 'lose';
    await notificationService.createMatchResultNotification({
      playerId: duel.duel_invited_player_id,
      matchType: 'duel',
      result: invitedResult,
      opponentName: duel.creator_name,
      matchId: duel.duel_id
    });

    console.log(`[checkAndCompleteDuel] Duel ${duelId} auto-completed with winner: ${winnerId || 'tie'}`);
  } catch (error) {
    console.error('[checkAndCompleteDuel] Error:', error);
    // Don't throw - this is called from session upload and should be non-blocking
  }
}
