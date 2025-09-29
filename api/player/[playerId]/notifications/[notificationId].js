import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  const { playerId, notificationId } = req.query;
  const { method } = req;

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!playerId || !notificationId) {
    return res.status(400).json({ error: 'Player ID and Notification ID are required' });
  }

  const client = await pool.connect();

  try {
    // Delete notification
    const deleteQuery = `
      DELETE FROM notifications
      WHERE id = $1 AND player_id = $2
      RETURNING id
    `;

    const result = await client.query(deleteQuery, [notificationId, playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found or not owned by player' });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      deleted_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  } finally {
    client.release();
  }
}