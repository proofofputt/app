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
 * Automatically advance expired league rounds
 */
async function processExpiredRounds(client) {
  const results = {
    processed_leagues: 0,
    advanced_rounds: 0,
    completed_leagues: 0,
    notifications_sent: 0,
    errors: []
  };

  try {
    // Get leagues with expired active rounds that allow auto-advancement
    const expiredRoundsQuery = `
      SELECT DISTINCT
        l.league_id,
        l.name as league_name,
        l.auto_start_rounds,
        lr.round_id,
        lr.round_number,
        lr.end_time,
        (SELECT COUNT(*) FROM league_rounds lr2 
         WHERE lr2.league_id = l.league_id AND lr2.round_number > lr.round_number) as remaining_rounds
      FROM leagues l
      JOIN league_rounds lr ON l.league_id = lr.league_id
      WHERE l.status = 'active'
        AND lr.status = 'active'
        AND lr.end_time < NOW()
        AND l.auto_start_rounds = true
      ORDER BY l.league_id, lr.round_number
    `;

    const expiredRounds = await client.query(expiredRoundsQuery);

    for (const round of expiredRounds.rows) {
      try {
        results.processed_leagues++;

        // Advance the league round using the stored function
        const advanceResult = await client.query('SELECT advance_league_round($1) as success', [round.league_id]);
        
        if (advanceResult.rows[0].success) {
          results.advanced_rounds++;

          // Check if this was the final round
          if (round.remaining_rounds === 0) {
            results.completed_leagues++;
            
            // Send league completion notifications
            await client.query(`
              INSERT INTO league_notifications (league_id, user_id, notification_type, title, message, data, expires_at)
              SELECT $1, lm.player_id, $2, $3, $4, $5, $6
              FROM league_memberships lm 
              WHERE lm.league_id = $1 AND lm.is_active = true
            `, [
              round.league_id,
              'league_completed',
              `${round.league_name} Complete!`,
              'The league has finished. Check the final standings and results.',
              JSON.stringify({
                league_id: round.league_id,
                final_round: round.round_number,
                completed_at: new Date().toISOString()
              }),
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            ]);

            const completionNotifications = await client.query('SELECT COUNT(*) as count FROM league_memberships WHERE league_id = $1 AND is_active = true', [round.league_id]);
            results.notifications_sent += parseInt(completionNotifications.rows[0].count);

          } else {
            // Send round advancement notifications
            await client.query(`
              INSERT INTO league_notifications (league_id, user_id, notification_type, title, message, data, expires_at)
              SELECT $1, lm.player_id, $2, $3, $4, $5, $6
              FROM league_memberships lm 
              WHERE lm.league_id = $1 AND lm.is_active = true
            `, [
              round.league_id,
              'round_advanced',
              `${round.league_name} - New Round!`,
              `Round ${round.round_number + 1} has started. Submit your sessions now!`,
              JSON.stringify({
                league_id: round.league_id,
                previous_round: round.round_number,
                current_round: round.round_number + 1
              }),
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            ]);

            const advancementNotifications = await client.query('SELECT COUNT(*) as count FROM league_memberships WHERE league_id = $1 AND is_active = true', [round.league_id]);
            results.notifications_sent += parseInt(advancementNotifications.rows[0].count);
          }
        }

      } catch (roundError) {
        results.errors.push({
          league_id: round.league_id,
          round_id: round.round_id,
          error: roundError.message
        });
        console.error(`Error processing round ${round.round_id} for league ${round.league_id}:`, roundError);
      }
    }

  } catch (error) {
    results.errors.push({
      operation: 'process_expired_rounds',
      error: error.message
    });
    console.error('Error in processExpiredRounds:', error);
  }

  return results;
}

/**
 * Clean up expired invitations and old notifications
 */
async function cleanupExpiredData(client) {
  const results = {
    expired_invitations: 0,
    deleted_notifications: 0,
    archived_sessions: 0
  };

  try {
    // Expire old league invitations
    const expiredInvitations = await client.query(`
      UPDATE league_invitations 
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()
    `);
    results.expired_invitations = expiredInvitations.rowCount;

    // Delete old notifications (older than 90 days)
    const oldNotifications = await client.query(`
      DELETE FROM league_notifications 
      WHERE created_at < NOW() - INTERVAL '90 days'
        OR (expires_at IS NOT NULL AND expires_at < NOW())
    `);
    results.deleted_notifications = oldNotifications.rowCount;

    // Archive old session data (older than 1 year) - just mark as archived, don't delete
    const oldSessions = await client.query(`
      UPDATE league_round_sessions 
      SET validation_notes = COALESCE(validation_notes, '') || ' [ARCHIVED]'
      WHERE submitted_at < NOW() - INTERVAL '1 year'
        AND validation_notes NOT LIKE '%[ARCHIVED]%'
    `);
    results.archived_sessions = oldSessions.rowCount;

  } catch (error) {
    console.error('Error in cleanupExpiredData:', error);
    throw error;
  }

  return results;
}

/**
 * Generate league activity reports
 */
async function generateActivityReports(client, leagueId = null) {
  const reports = {};

  try {
    let whereClause = '';
    let params = [];

    if (leagueId) {
      whereClause = 'WHERE l.league_id = $1';
      params = [leagueId];
    }

    // League overview report
    const leagueOverview = await client.query(`
      SELECT 
        l.league_id,
        l.name,
        l.league_type,
        l.status,
        l.current_round,
        l.total_rounds,
        l.created_at,
        COUNT(DISTINCT lm.player_id) as total_members,
        COUNT(DISTINCT CASE WHEN lm.is_active THEN lm.player_id END) as active_members,
        COUNT(DISTINCT lrs.session_id) as total_sessions,
        COUNT(DISTINCT CASE WHEN lrs.submitted_at >= NOW() - INTERVAL '7 days' THEN lrs.session_id END) as recent_sessions,
        AVG(lrs.round_score) as avg_score,
        MAX(lrs.round_score) as highest_score
      FROM leagues l
      LEFT JOIN league_memberships lm ON l.league_id = lm.league_id
      LEFT JOIN league_round_sessions lrs ON l.league_id = lrs.league_id
      ${whereClause}
      GROUP BY l.league_id, l.name, l.league_type, l.status, l.current_round, l.total_rounds, l.created_at
      ORDER BY l.created_at DESC
    `, params);

    reports.league_overview = leagueOverview.rows;

    // Member activity report
    if (leagueId) {
      const memberActivity = await client.query(`
        SELECT 
          u.id as player_id,
          u.display_name,
          u.username,
          lm.member_role,
          lm.joined_at,
          lm.sessions_this_round,
          lm.total_score,
          lm.current_rank,
          lm.last_activity,
          COUNT(lrs.session_id) as lifetime_sessions,
          COUNT(CASE WHEN lrs.submitted_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_sessions,
          AVG(lrs.round_score) as avg_score,
          MAX(lrs.round_score) as best_score,
          MIN(lrs.submitted_at) as first_session,
          MAX(lrs.submitted_at) as latest_session
        FROM league_memberships lm
        JOIN users u ON lm.player_id = u.id
        LEFT JOIN league_round_sessions lrs ON lm.league_id = lrs.league_id AND lm.player_id = lrs.player_id
        WHERE lm.league_id = $1 AND lm.is_active = true
        GROUP BY u.id, u.display_name, u.username, lm.member_role, lm.joined_at, 
                 lm.sessions_this_round, lm.total_score, lm.current_rank, lm.last_activity
        ORDER BY lm.current_rank ASC NULLS LAST, lm.total_score DESC
      `, [leagueId]);

      reports.member_activity = memberActivity.rows;
    }

    // Round progress report
    const roundProgress = await client.query(`
      SELECT 
        l.league_id,
        l.name as league_name,
        lr.round_id,
        lr.round_number,
        lr.status,
        lr.start_time,
        lr.end_time,
        COUNT(lrs.session_id) as session_count,
        COUNT(DISTINCT lrs.player_id) as participating_players,
        AVG(lrs.round_score) as avg_round_score,
        MAX(lrs.round_score) as top_round_score
      FROM leagues l
      JOIN league_rounds lr ON l.league_id = lr.league_id
      LEFT JOIN league_round_sessions lrs ON lr.round_id = lrs.round_id
      ${whereClause}
      GROUP BY l.league_id, l.name, lr.round_id, lr.round_number, lr.status, lr.start_time, lr.end_time
      ORDER BY l.league_id, lr.round_number
    `, params);

    reports.round_progress = roundProgress.rows;

  } catch (error) {
    console.error('Error generating activity reports:', error);
    throw error;
  }

  return reports;
}

export default async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      const { action, league_id } = req.query;

      if (action === 'health_check') {
        // Simple health check for automation monitoring
        return res.status(200).json({
          success: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database_connected: true
        });
      }

      if (action === 'reports') {
        // Generate activity reports
        const reports = await generateActivityReports(client, league_id ? parseInt(league_id) : null);
        
        return res.status(200).json({
          success: true,
          generated_at: new Date().toISOString(),
          league_id: league_id ? parseInt(league_id) : null,
          reports
        });
      }

      if (action === 'check_expired') {
        // Check for expired rounds without processing them
        const expiredCheck = await client.query(`
          SELECT 
            l.league_id,
            l.name,
            lr.round_id,
            lr.round_number,
            lr.end_time,
            EXTRACT(EPOCH FROM (NOW() - lr.end_time))/3600 as hours_expired
          FROM leagues l
          JOIN league_rounds lr ON l.league_id = lr.league_id
          WHERE l.status = 'active'
            AND lr.status = 'active'
            AND lr.end_time < NOW()
          ORDER BY lr.end_time
        `);

        return res.status(200).json({
          success: true,
          expired_rounds_count: expiredCheck.rows.length,
          expired_rounds: expiredCheck.rows,
          check_time: new Date().toISOString()
        });
      }

      return res.status(400).json({ 
        success: false, 
        message: 'Invalid action. Available: health_check, reports, check_expired' 
      });
    }

    if (req.method === 'POST') {
      const { action, league_id, force = false } = req.body;

      // Check authentication for write operations
      if (!action.startsWith('health') && !action.startsWith('check')) {
        const user = await verifyToken(req);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Authentication required for automation actions' });
        }
      }

      if (action === 'process_expired_rounds') {
        // Process all expired rounds
        console.log('[League Automation] Processing expired rounds...');
        const results = await processExpiredRounds(client);
        
        return res.status(200).json({
          success: true,
          action: 'process_expired_rounds',
          processed_at: new Date().toISOString(),
          results
        });
      }

      if (action === 'cleanup_data') {
        // Clean up expired data
        console.log('[League Automation] Cleaning up expired data...');
        const results = await cleanupExpiredData(client);
        
        return res.status(200).json({
          success: true,
          action: 'cleanup_data',
          processed_at: new Date().toISOString(),
          results
        });
      }

      if (action === 'advance_league') {
        // Manually advance a specific league
        if (!league_id) {
          return res.status(400).json({ success: false, message: 'league_id required for manual advancement' });
        }

        // Check if user has admin permissions for this league
        const user = await verifyToken(req);
        const adminCheck = await client.query(
          'SELECT member_role FROM league_memberships WHERE league_id = $1 AND player_id = $2 AND is_active = true',
          [league_id, parseInt(user.playerId)]
        );

        if (adminCheck.rows.length === 0 || !['owner', 'admin'].includes(adminCheck.rows[0].member_role)) {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        // Check if current round can be advanced
        const currentRound = await client.query(`
          SELECT lr.*, l.auto_start_rounds
          FROM league_rounds lr
          JOIN leagues l ON lr.league_id = l.league_id
          WHERE lr.league_id = $1 AND lr.status = 'active'
        `, [league_id]);

        if (currentRound.rows.length === 0) {
          return res.status(400).json({ success: false, message: 'No active round to advance' });
        }

        const round = currentRound.rows[0];
        if (!force && new Date() <= new Date(round.end_time)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Round has not expired yet. Use force=true to advance early.',
            round_end_time: round.end_time,
            time_remaining: Math.max(0, (new Date(round.end_time) - new Date()) / 1000)
          });
        }

        // Advance the league
        const advanceResult = await client.query('SELECT advance_league_round($1) as success', [league_id]);
        
        if (advanceResult.rows[0].success) {
          return res.status(200).json({
            success: true,
            action: 'advance_league',
            league_id: parseInt(league_id),
            message: 'League advanced successfully',
            advanced_at: new Date().toISOString(),
            was_forced: force && new Date() <= new Date(round.end_time)
          });
        } else {
          return res.status(500).json({
            success: false,
            message: 'Failed to advance league'
          });
        }
      }

      if (action === 'update_rankings') {
        // Update rankings for a specific league
        if (!league_id) {
          return res.status(400).json({ success: false, message: 'league_id required for ranking update' });
        }

        await client.query('SELECT update_league_rankings($1)', [league_id]);
        
        return res.status(200).json({
          success: true,
          action: 'update_rankings',
          league_id: parseInt(league_id),
          message: 'Rankings updated successfully',
          updated_at: new Date().toISOString()
        });
      }

      if (action === 'full_maintenance') {
        // Run all maintenance tasks
        console.log('[League Automation] Running full maintenance...');
        
        const maintenanceResults = {
          expired_rounds: await processExpiredRounds(client),
          data_cleanup: await cleanupExpiredData(client),
          completed_at: new Date().toISOString()
        };
        
        return res.status(200).json({
          success: true,
          action: 'full_maintenance',
          results: maintenanceResults
        });
      }

      return res.status(400).json({ 
        success: false, 
        message: 'Invalid action' 
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[league-automation] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Automation task failed',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}