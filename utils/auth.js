/**
 * Authentication Utilities
 * ============================================================================
 * Shared authentication functions for JWT verification and user validation
 * ============================================================================
 */

import jwt from 'jsonwebtoken';

/**
 * Verify JWT token from request header
 * Returns decoded user data or null if invalid
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
 * Express middleware to require authentication
 * Usage: app.get('/api/protected', requireAuth, handler)
 */
export async function requireAuth(req, res, next) {
  const user = await verifyToken(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Attach user data to request
  req.user = user;
  next();
}

/**
 * Express middleware to require admin authentication
 * Usage: app.get('/api/admin/users', requireAdmin, handler)
 */
export async function requireAdmin(req, res, next) {
  const user = await verifyToken(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Check if user is admin (requires database query)
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      'SELECT is_admin FROM players WHERE player_id = $1',
      [user.playerId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Attach user data to request
    req.user = user;
    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed',
    });
  } finally {
    await pool.end();
  }
}
