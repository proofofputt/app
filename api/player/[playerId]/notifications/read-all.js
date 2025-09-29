import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  const { playerId } = req.query;
  const { method } = req;

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const client = await pool.connect();

  try {
    // Mark all notifications as read for the player
    const updateQuery = `
      UPDATE notifications
      SET read_status = true
      WHERE player_id = $1 AND read_status = false
      RETURNING COUNT(*)
    `;

    const result = await client.query(updateQuery, [playerId]);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updated_count: result.rowCount
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  } finally {
    client.release();
  }
}