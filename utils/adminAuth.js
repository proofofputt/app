import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

/**
 * Verify JWT token from request
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} - Decoded token payload or null
 */
export function verifyToken(req) {
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
 * Verify user has admin privileges
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - { isAdmin: boolean, user: Object|null, error: String|null }
 */
export async function verifyAdmin(req) {
  const user = await verifyToken(req);

  if (!user) {
    return {
      isAdmin: false,
      user: null,
      error: 'Authentication required'
    };
  }

  let client;
  try {
    client = await pool.connect();

    // Check if user has admin role
    const result = await client.query(
      'SELECT player_id, is_admin, name, email FROM players WHERE player_id = $1',
      [user.playerId]
    );

    if (result.rows.length === 0) {
      return {
        isAdmin: false,
        user: null,
        error: 'User not found'
      };
    }

    const player = result.rows[0];

    if (!player.is_admin) {
      return {
        isAdmin: false,
        user: player,
        error: 'Admin privileges required'
      };
    }

    return {
      isAdmin: true,
      user: player,
      error: null
    };
  } catch (error) {
    console.error('Admin verification error:', error);
    return {
      isAdmin: false,
      user: null,
      error: 'Verification failed'
    };
  } finally {
    if (client) client.release();
  }
}

/**
 * Middleware to protect admin-only routes
 * @param {Function} handler - API route handler
 * @returns {Function} - Wrapped handler with admin check
 */
export function requireAdmin(handler) {
  return async (req, res) => {
    const adminCheck = await verifyAdmin(req);

    if (!adminCheck.isAdmin) {
      return res.status(adminCheck.error === 'Authentication required' ? 401 : 403).json({
        success: false,
        message: adminCheck.error
      });
    }

    // Attach admin user to request for handler use
    req.adminUser = adminCheck.user;

    return handler(req, res);
  };
}
