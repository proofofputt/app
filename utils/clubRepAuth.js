/**
 * Club Representative Authentication & Authorization Utilities
 * ============================================================================
 * Provides middleware and helper functions for club representative
 * role verification and permission checking.
 *
 * Roles:
 * - Club Rep: Basic representative role
 * - Club Admin: Advanced role (unlocked with association pricing)
 *
 * Usage:
 * import { verifyClubRep, verifyClubAdmin, getClubsForRep } from '../utils/clubRepAuth.js';
 * ============================================================================
 */

import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Verify user is authenticated and has club rep permissions
 * Returns player data with club rep status
 */
export async function verifyClubRep(req) {
  try {
    // First verify JWT token
    const user = await verifyToken(req);

    if (!user || !user.playerId) {
      return { authorized: false, message: 'Authentication required' };
    }

    // Check if user is a club rep
    const result = await pool.query(
      `SELECT player_id, email, is_club_rep, is_admin
       FROM players
       WHERE player_id = $1 AND is_club_rep = TRUE`,
      [user.playerId]
    );

    if (result.rows.length === 0) {
      return { authorized: false, message: 'Club representative access required' };
    }

    return {
      authorized: true,
      player: result.rows[0],
    };
  } catch (error) {
    console.error('Club rep verification error:', error);
    return { authorized: false, message: 'Verification failed' };
  }
}

/**
 * Verify user is a club admin (higher tier rep)
 */
export async function verifyClubAdmin(req) {
  try {
    const repCheck = await verifyClubRep(req);

    if (!repCheck.authorized) {
      return repCheck;
    }

    // Check if rep has admin role in any club
    const adminCheck = await pool.query(
      `SELECT cr.rep_id, cr.club_id, c.name as club_name
       FROM club_representatives cr
       JOIN clubs c ON cr.club_id = c.club_id
       WHERE cr.player_id = $1 AND cr.role = 'admin' AND cr.is_active = TRUE
       LIMIT 1`,
      [repCheck.player.player_id]
    );

    if (adminCheck.rows.length === 0) {
      return { authorized: false, message: 'Club admin access required' };
    }

    return {
      authorized: true,
      player: repCheck.player,
      adminClubs: adminCheck.rows,
    };
  } catch (error) {
    console.error('Club admin verification error:', error);
    return { authorized: false, message: 'Verification failed' };
  }
}

/**
 * Get all clubs where player is a representative
 */
export async function getClubsForRep(playerId) {
  try {
    const result = await pool.query(
      `SELECT
        cr.rep_id,
        cr.club_id,
        cr.role,
        cr.can_invite_players,
        cr.can_create_leagues,
        cr.can_grant_subscriptions,
        cr.can_manage_reps,
        cr.is_active,
        c.name,
        c.slug,
        c.address_city,
        c.address_state,
        c.website,
        c.subscription_bundle_balance
       FROM club_representatives cr
       JOIN clubs c ON cr.club_id = c.club_id
       WHERE cr.player_id = $1 AND cr.is_active = TRUE
       ORDER BY c.name`,
      [playerId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching clubs for rep:', error);
    return [];
  }
}

/**
 * Check if player is rep for specific club
 */
export async function isRepForClub(playerId, clubId) {
  try {
    const result = await pool.query(
      `SELECT rep_id, role, can_invite_players, can_create_leagues, can_grant_subscriptions, can_manage_reps
       FROM club_representatives
       WHERE player_id = $1 AND club_id = $2 AND is_active = TRUE
       LIMIT 1`,
      [playerId, clubId]
    );

    if (result.rows.length === 0) {
      return { isRep: false };
    }

    return {
      isRep: true,
      role: result.rows[0].role,
      permissions: {
        canInvitePlayers: result.rows[0].can_invite_players,
        canCreateLeagues: result.rows[0].can_create_leagues,
        canGrantSubscriptions: result.rows[0].can_grant_subscriptions,
        canManageReps: result.rows[0].can_manage_reps,
      },
    };
  } catch (error) {
    console.error('Error checking club rep status:', error);
    return { isRep: false };
  }
}

/**
 * Get club subscription bundle balance
 */
export async function getClubBundleBalance(clubId) {
  try {
    const result = await pool.query(
      `SELECT subscription_bundle_balance FROM clubs WHERE club_id = $1`,
      [clubId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    return parseInt(result.rows[0].subscription_bundle_balance) || 0;
  } catch (error) {
    console.error('Error fetching club bundle balance:', error);
    return 0;
  }
}

/**
 * Check if club has available subscription grants
 */
export async function clubHasAvailableGrants(clubId, requiredCount = 1) {
  const balance = await getClubBundleBalance(clubId);
  return balance >= requiredCount;
}

/**
 * Get all players affiliated with a club
 */
export async function getClubPlayers(clubId, options = {}) {
  try {
    const {
      affiliationType = null,
      includeInactive = false,
      limit = 100,
      offset = 0,
    } = options;

    let query = `
      SELECT
        pca.affiliation_id,
        pca.player_id,
        pca.affiliation_type,
        pca.affiliated_at,
        pca.last_activity_at,
        p.name,
        p.email,
        p.membership_tier,
        u.username,
        u.display_name
      FROM player_club_affiliations pca
      JOIN players p ON pca.player_id = p.player_id
      LEFT JOIN users u ON p.player_id = u.id
      WHERE pca.club_id = $1
    `;

    const params = [clubId];
    let paramCount = 1;

    if (!includeInactive) {
      query += ` AND pca.is_active = TRUE`;
    }

    if (affiliationType) {
      paramCount++;
      query += ` AND pca.affiliation_type = $${paramCount}`;
      params.push(affiliationType);
    }

    query += ` ORDER BY pca.affiliated_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching club players:', error);
    return [];
  }
}

/**
 * Get club statistics (leagues, players, subscriptions)
 */
export async function getClubStats(clubId) {
  try {
    const stats = {};

    // Total active representatives
    const repsResult = await pool.query(
      `SELECT COUNT(*) as count FROM club_representatives WHERE club_id = $1 AND is_active = TRUE`,
      [clubId]
    );
    stats.totalReps = parseInt(repsResult.rows[0].count) || 0;

    // Total affiliated players
    const playersResult = await pool.query(
      `SELECT COUNT(*) as count FROM player_club_affiliations WHERE club_id = $1 AND is_active = TRUE`,
      [clubId]
    );
    stats.totalPlayers = parseInt(playersResult.rows[0].count) || 0;

    // Total hosted leagues
    const leaguesResult = await pool.query(
      `SELECT COUNT(*) as count FROM leagues WHERE host_club_id = $1`,
      [clubId]
    );
    stats.totalLeagues = parseInt(leaguesResult.rows[0].count) || 0;

    // Subscription grants (total and redeemed)
    const grantsResult = await pool.query(
      `SELECT
        COUNT(*) as total_granted,
        COUNT(*) FILTER (WHERE is_redeemed = TRUE) as total_redeemed
       FROM club_subscription_grants
       WHERE club_id = $1`,
      [clubId]
    );
    stats.subscriptionsGranted = parseInt(grantsResult.rows[0].total_granted) || 0;
    stats.subscriptionsRedeemed = parseInt(grantsResult.rows[0].total_redeemed) || 0;

    // Bundle balance
    stats.bundleBalance = await getClubBundleBalance(clubId);

    return stats;
  } catch (error) {
    console.error('Error fetching club stats:', error);
    return {
      totalReps: 0,
      totalPlayers: 0,
      totalLeagues: 0,
      subscriptionsGranted: 0,
      subscriptionsRedeemed: 0,
      bundleBalance: 0,
    };
  }
}

/**
 * Express middleware to require club rep authentication
 * Usage: app.get('/api/club-rep/dashboard', requireClubRep, handler)
 */
export async function requireClubRep(req, res, next) {
  const verification = await verifyClubRep(req);

  if (!verification.authorized) {
    return res.status(403).json({
      success: false,
      message: verification.message,
    });
  }

  // Attach player data to request
  req.clubRep = verification.player;
  next();
}

/**
 * Express middleware to require club admin authentication
 * Usage: app.get('/api/club-admin/settings', requireClubAdmin, handler)
 */
export async function requireClubAdmin(req, res, next) {
  const verification = await verifyClubAdmin(req);

  if (!verification.authorized) {
    return res.status(403).json({
      success: false,
      message: verification.message,
    });
  }

  // Attach player and admin clubs to request
  req.clubRep = verification.player;
  req.adminClubs = verification.adminClubs;
  next();
}

/**
 * Express middleware to verify rep belongs to specific club
 * Usage: app.get('/api/clubs/:clubId/players', requireRepForClub, handler)
 */
export async function requireRepForClub(req, res, next) {
  const verification = await verifyClubRep(req);

  if (!verification.authorized) {
    return res.status(403).json({
      success: false,
      message: verification.message,
    });
  }

  const clubId = parseInt(req.params.clubId);
  const repStatus = await isRepForClub(verification.player.player_id, clubId);

  if (!repStatus.isRep) {
    return res.status(403).json({
      success: false,
      message: 'You are not a representative of this club',
    });
  }

  // Attach player and club rep status to request
  req.clubRep = verification.player;
  req.clubRepStatus = repStatus;
  next();
}
