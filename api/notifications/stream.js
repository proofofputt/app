import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Keep track of active connections
const activeConnections = new Map();

/**
 * Server-Sent Events (SSE) endpoint for real-time notifications
 * Clients connect and receive instant updates when new notifications arrive
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication - support both header and query param for EventSource compatibility
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('[notifications-stream] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const playerId = decoded.player_id || decoded.playerId;
  if (!playerId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  console.log(`[notifications-stream] Player ${playerId} connected`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', playerId })}\n\n`);

  // Store connection
  activeConnections.set(playerId, res);

  // Set up heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000); // Every 30 seconds

  // Poll for new notifications every 5 seconds
  const pollInterval = setInterval(async () => {
    try {
      const client = await pool.connect();

      try {
        const result = await client.query(`
          SELECT id, type, title, message, link_path, data, created_at
          FROM notifications
          WHERE player_id = $1
            AND read_status = false
            AND created_at > NOW() - INTERVAL '5 seconds'
          ORDER BY created_at DESC
        `, [playerId]);

        if (result.rows.length > 0) {
          for (const notification of result.rows) {
            res.write(`data: ${JSON.stringify({
              type: 'notification',
              notification: {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                link_path: notification.link_path,
                data: notification.data,
                created_at: notification.created_at
              }
            })}\n\n`);
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[notifications-stream] Poll error:', error);
    }
  }, 5000); // Poll every 5 seconds

  // Clean up on connection close
  req.on('close', () => {
    console.log(`[notifications-stream] Player ${playerId} disconnected`);
    clearInterval(heartbeat);
    clearInterval(pollInterval);
    activeConnections.delete(playerId);
    res.end();
  });
}

/**
 * Helper function to broadcast a notification to a specific player
 * Can be called from NotificationService after creating a notification
 */
export function broadcastNotification(playerId, notification) {
  const connection = activeConnections.get(playerId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify({
        type: 'notification',
        notification
      })}\n\n`);
      console.log(`[notifications-stream] Broadcast notification to player ${playerId}`);
    } catch (error) {
      console.error('[notifications-stream] Broadcast error:', error);
      activeConnections.delete(playerId);
    }
  }
}

/**
 * Get count of active SSE connections
 */
export function getActiveConnectionCount() {
  return activeConnections.size;
}
