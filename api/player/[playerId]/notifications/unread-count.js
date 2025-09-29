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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  const client = await pool.connect();

  try {
    // First, verify the player exists
    const playerCheck = await client.query('SELECT id FROM players WHERE id = $1', [playerId]);
    if (playerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get unread notifications count
    const unreadCountQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE player_id = $1 AND read_status = false
    `;

    const result = await client.query(unreadCountQuery, [playerId]);
    const unreadCount = parseInt(result.rows[0].count);

    return res.status(200).json({
      unread_count: unreadCount
    });

  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  } finally {
    client.release();
  }
}