/**
 * Admin Authentication and Authorization Middleware
 * Protects admin endpoints and verifies permissions
 */

import pg from 'pg';
import jwt from 'jsonwebtoken';
import { logAuthEvent, warn as logWarn, error as logError } from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Admin roles with their permissions
 */
export const ADMIN_ROLES = {
  MAIN_ADMIN: 'main_admin',
  CUSTOMER_SUPPORT: 'customer_support'
};

/**
 * Permission definitions
 */
export const PERMISSIONS = {
  GRANT_SUBSCRIPTIONS: 'can_grant_subscriptions',
  GRANT_BUNDLES: 'can_grant_bundles',
  VIEW_USERS: 'can_view_users',
  VIEW_ACTIVITY_LOG: 'can_view_activity_log',
  GRANT_ADMIN_ROLES: 'can_grant_admin_roles',
  REVOKE_SUBSCRIPTIONS: 'can_revoke_subscriptions',
  VIEW_ALL_SUBSCRIPTIONS: 'can_view_all_subscriptions'
};

/**
 * Default permissions for each role
 */
const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.MAIN_ADMIN]: {
    [PERMISSIONS.GRANT_SUBSCRIPTIONS]: true,
    [PERMISSIONS.GRANT_BUNDLES]: true,
    [PERMISSIONS.VIEW_USERS]: true,
    [PERMISSIONS.VIEW_ACTIVITY_LOG]: true,
    [PERMISSIONS.GRANT_ADMIN_ROLES]: true,
    [PERMISSIONS.REVOKE_SUBSCRIPTIONS]: true,
    [PERMISSIONS.VIEW_ALL_SUBSCRIPTIONS]: true
  },
  [ADMIN_ROLES.CUSTOMER_SUPPORT]: {
    [PERMISSIONS.GRANT_SUBSCRIPTIONS]: true,
    [PERMISSIONS.GRANT_BUNDLES]: true,
    [PERMISSIONS.VIEW_USERS]: true,
    [PERMISSIONS.VIEW_ACTIVITY_LOG]: true,
    [PERMISSIONS.GRANT_ADMIN_ROLES]: false,
    [PERMISSIONS.REVOKE_SUBSCRIPTIONS]: false,
    [PERMISSIONS.VIEW_ALL_SUBSCRIPTIONS]: true
  }
};

/**
 * Extract user from JWT token
 */
async function getUserFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.playerId || decoded.id;

    const userResult = await pool.query(
      `SELECT
        player_id,
        email,
        display_name,
        admin_role,
        admin_permissions,
        admin_granted_at
      FROM players
      WHERE player_id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    return userResult.rows[0];
  } catch (error) {
    logError('Error extracting user from token', error);
    return null;
  }
}

/**
 * Check if user has admin role
 */
function isAdmin(user) {
  return user && user.admin_role && [ADMIN_ROLES.MAIN_ADMIN, ADMIN_ROLES.CUSTOMER_SUPPORT].includes(user.admin_role);
}

/**
 * Check if user has specific permission
 */
function hasPermission(user, permission) {
  if (!isAdmin(user)) {
    return false;
  }

  // Check custom permissions first
  if (user.admin_permissions && user.admin_permissions[permission] !== undefined) {
    return user.admin_permissions[permission];
  }

  // Fall back to role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.admin_role];
  return rolePermissions ? rolePermissions[permission] === true : false;
}

/**
 * Log admin activity to database
 */
async function logAdminActivity(admin, actionType, targetPlayerId, actionData, reason, req, status = 'completed', errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO admin_activity_log (
        admin_player_id,
        admin_role,
        action_type,
        target_player_id,
        target_email,
        action_data,
        reason,
        notes,
        ip_address,
        user_agent,
        status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        admin.player_id,
        admin.admin_role,
        actionType,
        targetPlayerId,
        actionData.targetEmail || null,
        JSON.stringify(actionData),
        reason,
        actionData.notes || null,
        req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
        req.headers['user-agent'] || null,
        status,
        errorMessage
      ]
    );

    logAuthEvent('admin_action_logged', {
      adminId: admin.player_id,
      actionType,
      targetPlayerId,
      status
    });
  } catch (error) {
    logError('Failed to log admin activity', error, {
      adminId: admin.player_id,
      actionType
    });
  }
}

/**
 * Middleware: Require any admin role
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logWarn('Admin endpoint accessed without auth token', {
      path: req.path,
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
    });
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Admin access requires authentication'
    });
  }

  const token = authHeader.substring(7);

  getUserFromToken(token)
    .then(user => {
      if (!user) {
        logWarn('Admin endpoint accessed with invalid token', {
          path: req.path
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication',
          message: 'Could not verify admin credentials'
        });
      }

      if (!isAdmin(user)) {
        logWarn('Non-admin user attempted to access admin endpoint', {
          userId: user.player_id,
          email: user.email,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'This endpoint requires admin privileges'
        });
      }

      // Attach admin user to request
      req.admin = user;
      logAuthEvent('admin_authenticated', {
        adminId: user.player_id,
        role: user.admin_role,
        path: req.path
      });

      next();
    })
    .catch(error => {
      logError('Error in admin authentication middleware', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'Failed to verify admin credentials'
      });
    });
}

/**
 * Middleware: Require specific admin role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Admin authentication required'
      });
    }

    if (!roles.includes(req.admin.admin_role)) {
      logWarn('Admin with insufficient role attempted action', {
        adminId: req.admin.player_id,
        currentRole: req.admin.admin_role,
        requiredRoles: roles,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        currentRole: req.admin.admin_role,
        requiredRoles: roles
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Admin authentication required'
      });
    }

    if (!hasPermission(req.admin, permission)) {
      logWarn('Admin with insufficient permissions attempted action', {
        adminId: req.admin.player_id,
        role: req.admin.admin_role,
        requiredPermission: permission,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires the permission: ${permission}`,
        currentRole: req.admin.admin_role,
        requiredPermission: permission
      });
    }

    next();
  };
}

/**
 * Helper: Check if request has admin authentication
 */
export function isAdminRequest(req) {
  return req.admin && isAdmin(req.admin);
}

/**
 * Helper: Get admin from request
 */
export function getAdmin(req) {
  return req.admin || null;
}

/**
 * Export logging function for use in admin endpoints
 */
export { logAdminActivity };

export default {
  requireAdmin,
  requireRole,
  requirePermission,
  isAdminRequest,
  getAdmin,
  logAdminActivity,
  ADMIN_ROLES,
  PERMISSIONS,
  hasPermission
};
