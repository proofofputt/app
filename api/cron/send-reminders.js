import { Pool } from 'pg';
import notificationService from '../services/notification.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Cron job to send session reminders for expiring duels and leagues
 * Runs every 6 hours
 * Sends reminders at 24h, 6h, and 1h before expiration
 */
export default async function handler(req, res) {
  // Verify this is a cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  const results = {
    duel_reminders: 0,
    league_reminders: 0,
    errors: []
  };

  try {
    const now = new Date();

    // Define reminder windows (in hours before expiration)
    const reminderWindows = [
      { hours: 24, label: '24 hours' },
      { hours: 6, label: '6 hours' },
      { hours: 1, label: '1 hour' }
    ];

    // Send duel expiration reminders
    for (const window of reminderWindows) {
      const windowStart = new Date(now.getTime() + (window.hours * 60 - 15) * 60 * 1000); // 15 min before window
      const windowEnd = new Date(now.getTime() + (window.hours * 60 + 15) * 60 * 1000);   // 15 min after window

      try {
        // Find duels expiring in this window where invited player hasn't submitted
        const expiringDuels = await client.query(`
          SELECT
            d.duel_id,
            d.duel_invited_player_id as player_id,
            d.expires_at,
            d.duel_invited_player_session_data,
            creator.name as creator_name
          FROM duels d
          JOIN players creator ON d.duel_creator_id = creator.player_id
          WHERE d.status = 'active'
            AND d.duel_invited_player_session_data IS NULL
            AND d.expires_at BETWEEN $1 AND $2
        `, [windowStart, windowEnd]);

        for (const duel of expiringDuels.rows) {
          await notificationService.createSessionReminderNotification({
            playerId: duel.player_id,
            activityType: 'duel',
            activityId: duel.duel_id,
            dueDate: duel.expires_at
          });
          results.duel_reminders++;
        }

        console.log(`[send-reminders] Sent ${expiringDuels.rows.length} duel reminders for ${window.label} window`);

      } catch (duelError) {
        results.errors.push({
          type: 'duel_reminder',
          window: window.label,
          error: duelError.message
        });
        console.error(`[send-reminders] Error sending duel reminders for ${window.label}:`, duelError);
      }
    }

    // Send league round expiration reminders
    for (const window of reminderWindows) {
      const windowStart = new Date(now.getTime() + (window.hours * 60 - 15) * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (window.hours * 60 + 15) * 60 * 1000);

      try {
        // Find league rounds expiring in this window
        const expiringRounds = await client.query(`
          SELECT DISTINCT
            lr.league_id,
            lr.round_id,
            lr.round_number,
            lr.end_time,
            l.name as league_name,
            lm.player_id
          FROM league_rounds lr
          JOIN leagues l ON lr.league_id = l.league_id
          JOIN league_memberships lm ON lr.league_id = lm.league_id
          LEFT JOIN league_round_sessions lrs ON (
            lr.round_id = lrs.round_id AND lm.player_id = lrs.player_id
          )
          WHERE lr.status = 'active'
            AND lm.is_active = true
            AND lrs.session_id IS NULL
            AND lr.end_time BETWEEN $1 AND $2
        `, [windowStart, windowEnd]);

        for (const round of expiringRounds.rows) {
          await notificationService.createSessionReminderNotification({
            playerId: round.player_id,
            activityType: 'league round',
            activityId: round.league_id,
            dueDate: round.end_time
          });
          results.league_reminders++;
        }

        console.log(`[send-reminders] Sent ${expiringRounds.rows.length} league reminders for ${window.label} window`);

      } catch (leagueError) {
        results.errors.push({
          type: 'league_reminder',
          window: window.label,
          error: leagueError.message
        });
        console.error(`[send-reminders] Error sending league reminders for ${window.label}:`, leagueError);
      }
    }

    console.log('[send-reminders] Reminder job completed:', {
      duel_reminders: results.duel_reminders,
      league_reminders: results.league_reminders,
      errors: results.errors.length
    });

    return res.status(200).json({
      success: true,
      message: 'Reminder job completed',
      results
    });

  } catch (error) {
    console.error('[send-reminders] Fatal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Reminder job failed',
      error: error.message
    });
  } finally {
    client.release();
  }
}
