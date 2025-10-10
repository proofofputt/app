import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { setCORSHeaders } from '../utils/cors.js';

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

/**
 * Calculate handicap based on Makes Per Minute (MPM) from qualifying sessions
 *
 * Qualifying session criteria:
 * - Must be 'timed' or 'practice' session type
 * - Must be at least 5 minutes duration
 * - Must have valid makes_per_minute data
 *
 * Handicap calculation:
 * - Requires minimum 21 qualifying sessions
 * - Uses 50th-75th percentile of MPM values (middle-upper performance)
 * - Averages those values to get the handicap
 * - Rounds to 2 decimal places for timed sessions
 * - Rounds to nearest whole number for shootout display
 *
 * @param {Array} sessions - Array of session data objects
 * @returns {Object} - { handicap, qualifyingSessions, percentileData }
 */
function calculateHandicapFromSessions(sessions) {
  console.log(`[HANDICAP] Starting calculation with ${sessions.length} total sessions`);

  // Filter for qualifying sessions
  const qualifyingSessions = sessions.filter(session => {
    const data = session.data;

    // Must be timed or practice session
    const sessionType = data.session_type || 'practice';
    if (!['timed', 'practice'].includes(sessionType)) {
      return false;
    }

    // Must have duration >= 5 minutes (300 seconds)
    const duration = parseInt(data.session_duration) || 0;
    if (duration < 300) {
      return false;
    }

    // Must have valid MPM
    const mpm = parseFloat(data.makes_per_minute);
    if (!mpm || mpm <= 0 || isNaN(mpm)) {
      return false;
    }

    return true;
  });

  console.log(`[HANDICAP] Found ${qualifyingSessions.length} qualifying sessions`);

  // Need at least 21 sessions
  if (qualifyingSessions.length < 21) {
    return {
      handicap: null,
      qualifyingSessions: qualifyingSessions.length,
      message: `Need ${21 - qualifyingSessions.length} more qualifying sessions (5+ minutes, timed/practice)`
    };
  }

  // Extract and sort MPM values
  const mpmValues = qualifyingSessions
    .map(s => parseFloat(s.data.makes_per_minute))
    .filter(val => !isNaN(val) && val > 0)
    .sort((a, b) => a - b);

  if (mpmValues.length === 0) {
    return {
      handicap: null,
      qualifyingSessions: 0,
      message: 'No valid MPM data found'
    };
  }

  // Calculate 50th-75th percentile indices
  const p50Index = Math.floor(mpmValues.length * 0.50);
  const p75Index = Math.ceil(mpmValues.length * 0.75);

  // Get values in that range
  const middleUpperValues = mpmValues.slice(p50Index, p75Index);

  // Calculate average
  const handicap = middleUpperValues.reduce((sum, val) => sum + val, 0) / middleUpperValues.length;

  console.log(`[HANDICAP] Calculated handicap: ${handicap.toFixed(2)} MPM from ${middleUpperValues.length} values (50-75th percentile)`);

  return {
    handicap: Math.round(handicap * 100) / 100, // Round to 2 decimal places
    qualifyingSessions: qualifyingSessions.length,
    percentileData: {
      p50: mpmValues[p50Index],
      p75: mpmValues[p75Index - 1],
      valuesUsed: middleUpperValues.length,
      range: [Math.min(...middleUpperValues), Math.max(...middleUpperValues)]
    }
  };
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      // Get handicap for a specific player
      const { player_id } = req.query;

      if (!player_id) {
        return res.status(400).json({ success: false, message: 'player_id is required' });
      }

      const playerIdInt = parseInt(player_id);

      // Get current handicap from database
      const playerResult = await client.query(
        'SELECT handicap, handicap_last_calculated, handicap_qualifying_sessions FROM users WHERE id = $1',
        [playerIdInt]
      );

      if (playerResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Player not found' });
      }

      const player = playerResult.rows[0];

      return res.status(200).json({
        success: true,
        handicap: player.handicap,
        lastCalculated: player.handicap_last_calculated,
        qualifyingSessions: player.handicap_qualifying_sessions || 0
      });
    }

    if (req.method === 'POST') {
      // Recalculate handicap for a player
      const user = await verifyToken(req);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const playerId = parseInt(user.playerId);
      const { force = false } = req.body;

      // Check if recalculation is needed (skip if calculated within last 24 hours unless forced)
      if (!force) {
        const lastCalcResult = await client.query(
          'SELECT handicap_last_calculated FROM users WHERE id = $1',
          [playerId]
        );

        if (lastCalcResult.rows.length > 0 && lastCalcResult.rows[0].handicap_last_calculated) {
          const lastCalc = new Date(lastCalcResult.rows[0].handicap_last_calculated);
          const hoursSinceCalc = (Date.now() - lastCalc.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCalc < 24) {
            return res.status(200).json({
              success: true,
              message: 'Handicap was recently calculated. Use force=true to recalculate.',
              handicap: lastCalcResult.rows[0].handicap,
              hoursSinceLastCalc: Math.round(hoursSinceCalc * 10) / 10
            });
          }
        }
      }

      // Get all sessions for the player
      const sessionsResult = await client.query(
        `SELECT data, created_at FROM sessions
         WHERE player_id = $1 AND data IS NOT NULL
         ORDER BY created_at ASC`,
        [playerId]
      );

      // Calculate handicap
      const result = calculateHandicapFromSessions(sessionsResult.rows);

      if (result.handicap === null) {
        // Not enough qualifying sessions - update count but keep handicap NULL
        await client.query(
          `UPDATE users
           SET handicap_qualifying_sessions = $1,
               handicap_last_calculated = NOW()
           WHERE id = $2`,
          [result.qualifyingSessions, playerId]
        );

        return res.status(200).json({
          success: true,
          handicap: null,
          qualifyingSessions: result.qualifyingSessions,
          message: result.message
        });
      }

      // Update player handicap
      await client.query(
        `UPDATE users
         SET handicap = $1,
             handicap_last_calculated = NOW(),
             handicap_qualifying_sessions = $2
         WHERE id = $3`,
        [result.handicap, result.qualifyingSessions, playerId]
      );

      // Record in history
      await client.query(
        `INSERT INTO handicap_history (player_id, handicap_value, qualifying_sessions, calculation_data)
         VALUES ($1, $2, $3, $4)`,
        [playerId, result.handicap, result.qualifyingSessions, JSON.stringify(result.percentileData)]
      );

      return res.status(200).json({
        success: true,
        handicap: result.handicap,
        qualifyingSessions: result.qualifyingSessions,
        percentileData: result.percentileData,
        message: 'Handicap calculated successfully'
      });
    }

    if (req.method === 'PUT') {
      // Update profile information (picture, bio, social links)
      const user = await verifyToken(req);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const playerId = parseInt(user.playerId);
      const { profile_picture_url, bio, social_links } = req.body;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (profile_picture_url !== undefined) {
        updates.push(`profile_picture_url = $${paramIndex++}`);
        values.push(profile_picture_url);
      }

      if (bio !== undefined) {
        updates.push(`bio = $${paramIndex++}`);
        values.push(bio);
      }

      if (social_links !== undefined) {
        updates.push(`social_links = $${paramIndex++}`);
        values.push(JSON.stringify(social_links));
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(playerId);
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

      await client.query(query, values);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[calculate-handicap] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An internal server error occurred.',
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
}
