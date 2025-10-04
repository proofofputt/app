import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!id) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const client = await pool.connect();

  try {
    switch (method) {
      case 'GET':
        return await getNotifications(req, res, client, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function getNotifications(req, res, client, id) {
  const { limit = 20, offset = 0 } = req.query;

  try {
    // First, verify the player exists
    const playerCheck = await client.query('SELECT player_id FROM players WHERE player_id = $1', [id]);
    if (playerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Create notifications table if it doesn't exist
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

    // Get notifications for the player
    const notificationsQuery = `
      SELECT id, type, title, message, link_path, data, read_status, created_at
      FROM notifications
      WHERE player_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const notificationsResult = await client.query(notificationsQuery, [id, limit, offset]);

    // Get unread count
    const unreadCountQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE player_id = $1 AND read_status = false
    `;

    const unreadCountResult = await client.query(unreadCountQuery, [id]);
    const unreadCount = parseInt(unreadCountResult.rows[0].count);

    return res.status(200).json({
      notifications: notificationsResult.rows,
      unread_count: unreadCount,
      total_count: notificationsResult.rows.length,
      has_more: notificationsResult.rows.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}