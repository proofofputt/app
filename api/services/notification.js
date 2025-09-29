import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class NotificationService {
  constructor() {
    this.pool = pool;
  }

  async createNotification({ playerId, type, title, message, linkPath = null, data = {} }) {
    const client = await this.pool.connect();

    try {
      // Ensure notifications table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          link_path VARCHAR(500),
          data JSONB DEFAULT '{}',
          read_status BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_player_created
        ON notifications(player_id, created_at DESC)
      `);

      // Insert notification
      const insertQuery = `
        INSERT INTO notifications (player_id, type, title, message, link_path, data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        playerId,
        type,
        title,
        message,
        linkPath,
        JSON.stringify(data)
      ]);

      console.log(`✅ Notification created for player ${playerId}: ${title}`);
      return { success: true, notification: result.rows[0] };

    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Create duel challenge notification
  async createDuelChallengeNotification({ playerId, challengerName, duelId }) {
    return await this.createNotification({
      playerId,
      type: 'duel_challenge',
      title: 'New Duel Challenge',
      message: `${challengerName} has challenged you to a duel!`,
      linkPath: `/duels/${duelId}`,
      data: { duelId, challengerName }
    });
  }

  // Create league invitation notification
  async createLeagueInvitationNotification({ playerId, inviterName, leagueName, leagueId }) {
    return await this.createNotification({
      playerId,
      type: 'league_invitation',
      title: 'League Invitation',
      message: `${inviterName} has invited you to join the "${leagueName}" league`,
      linkPath: `/leagues/${leagueId}`,
      data: { leagueId, inviterName, leagueName }
    });
  }

  // Create friend request notification
  async createFriendRequestNotification({ playerId, requesterName, requestId }) {
    return await this.createNotification({
      playerId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${requesterName} wants to be your friend`,
      linkPath: `/friends?request=${requestId}`,
      data: { requestId, requesterName }
    });
  }

  // Create session reminder notification
  async createSessionReminderNotification({ playerId, activityType, activityId, dueDate }) {
    return await this.createNotification({
      playerId,
      type: 'session_reminder',
      title: 'Session Reminder',
      message: `Your ${activityType} session is due soon`,
      linkPath: `/sessions/${activityId}`,
      data: { activityType, activityId, dueDate }
    });
  }

  // Create achievement notification
  async createAchievementNotification({ playerId, achievementName, description }) {
    return await this.createNotification({
      playerId,
      type: 'achievement',
      title: 'New Achievement Unlocked!',
      message: `You've earned: ${achievementName}`,
      linkPath: '/achievements',
      data: { achievementName, description }
    });
  }

  // Create match result notification
  async createMatchResultNotification({ playerId, matchType, result, opponentName, matchId }) {
    const resultText = result === 'win' ? 'won' : result === 'lose' ? 'lost' : 'tied';
    const emoji = result === 'win' ? '🏆' : result === 'lose' ? '😞' : '🤝';

    return await this.createNotification({
      playerId,
      type: 'match_result',
      title: `${emoji} Match ${result.charAt(0).toUpperCase() + result.slice(1)}`,
      message: `You ${resultText} your ${matchType} against ${opponentName}`,
      linkPath: `/matches/${matchId}`,
      data: { matchType, result, opponentName, matchId }
    });
  }

  // Create general system notification
  async createSystemNotification({ playerId, title, message, linkPath = null }) {
    return await this.createNotification({
      playerId,
      type: 'system',
      title,
      message,
      linkPath,
      data: {}
    });
  }

  // Bulk create notifications for multiple players
  async createBulkNotifications(notifications) {
    const results = [];

    for (const notification of notifications) {
      const result = await this.createNotification(notification);
      results.push(result);
    }

    return results;
  }

  // Get notification statistics
  async getNotificationStats(playerId) {
    const client = await this.pool.connect();

    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_notifications,
          COUNT(CASE WHEN read_status = false THEN 1 END) as unread_count,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_count
        FROM notifications
        WHERE player_id = $1
      `;

      const result = await client.query(statsQuery, [playerId]);
      return { success: true, stats: result.rows[0] };

    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Clean up old notifications (keep last 100 per player)
  async cleanupOldNotifications(playerId, keepCount = 100) {
    const client = await this.pool.connect();

    try {
      const cleanupQuery = `
        DELETE FROM notifications
        WHERE player_id = $1
        AND id NOT IN (
          SELECT id FROM notifications
          WHERE player_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        )
      `;

      const result = await client.query(cleanupQuery, [playerId, keepCount]);
      console.log(`🗑️ Cleaned up ${result.rowCount} old notifications for player ${playerId}`);
      return { success: true, deletedCount: result.rowCount };

    } catch (error) {
      console.error('Failed to cleanup old notifications:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }
}

export default new NotificationService();