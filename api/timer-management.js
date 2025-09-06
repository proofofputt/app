import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
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
 * Calculate remaining time for various objects
 */
function calculateRemainingTime(createdAt, timeLimit) {
  const created = new Date(createdAt);
  const expiresAt = new Date(created.getTime() + (timeLimit * 60 * 60 * 1000));
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  
  return {
    expires_at: expiresAt.toISOString(),
    remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000)),
    remaining_minutes: Math.max(0, Math.floor(remainingMs / (1000 * 60))),
    remaining_hours: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
    is_expired: remainingMs <= 0,
    time_limit_hours: timeLimit
  };
}

/**
 * Get duel timer information
 */
async function getDuelTimer(client, duelId) {
  const result = await client.query(`
    SELECT 
      d.*,
      challenger.display_name as challenger_name,
      challenged.display_name as challenged_name
    FROM duels d
    LEFT JOIN users challenger ON d.challenger_id = challenger.id
    LEFT JOIN users challenged ON d.challenged_id = challenged.id
    WHERE d.duel_id = $1
  `, [duelId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const duel = result.rows[0];
  const timeLimit = duel.rules?.time_limit_hours || 48;
  
  return {
    duel_id: duel.duel_id,
    status: duel.status,
    challenger_name: duel.challenger_name,
    challenged_name: duel.challenged_name,
    duel_config: duel.rules,
    ...calculateRemainingTime(duel.created_at, timeLimit)
  };
}

/**
 * Get invitation timer information
 */
async function getInvitationTimer(client, invitationId) {
  const result = await client.query(`
    SELECT 
      di.*,
      d.rules as duel_rules,
      challenger.display_name as challenger_name
    FROM duel_invitations di
    JOIN duels d ON di.duel_id = d.duel_id
    LEFT JOIN users challenger ON di.inviting_user_id = challenger.id
    WHERE di.invitation_id = $1
  `, [invitationId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const invitation = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);
  const remainingMs = expiresAt.getTime() - now.getTime();
  
  return {
    invitation_id: invitation.invitation_id,
    duel_id: invitation.duel_id,
    status: invitation.status,
    invitation_method: invitation.invitation_method,
    challenger_name: invitation.challenger_name,
    expires_at: invitation.expires_at,
    remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000)),
    remaining_minutes: Math.max(0, Math.floor(remainingMs / (1000 * 60))),
    remaining_hours: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
    is_expired: remainingMs <= 0,
    duel_config: invitation.duel_rules
  };
}

/**
 * Auto-expire old duels and invitations
 */
async function expireOldItems(client) {
  const now = new Date();
  let expiredCount = 0;
  
  // Expire old duels
  const expiredDuels = await client.query(`
    UPDATE duels 
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'active')
      AND created_at + INTERVAL '1 hour' * CAST((rules->>'time_limit_hours')::int AS integer) < NOW()
    RETURNING duel_id, rules->>'time_limit_hours' as time_limit
  `);
  
  expiredCount += expiredDuels.rows.length;
  
  // Expire old invitations
  const expiredInvitations = await client.query(`
    UPDATE duel_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW()
    RETURNING invitation_id
  `);
  
  expiredCount += expiredInvitations.rows.length;
  
  return {
    expired_duels: expiredDuels.rows.length,
    expired_invitations: expiredInvitations.rows.length,
    total_expired: expiredCount
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      const { type, id, action } = req.query;
      
      // Auto-expire old items on every GET request
      const expiration_results = await expireOldItems(client);
      
      if (action === 'cleanup') {
        // Just return expiration results
        return res.status(200).json({
          success: true,
          message: 'Cleanup completed',
          ...expiration_results
        });
      }
      
      if (type === 'duel' && id) {
        // Get duel timer information
        const duelTimer = await getDuelTimer(client, parseInt(id));
        
        if (!duelTimer) {
          return res.status(404).json({
            success: false,
            message: 'Duel not found'
          });
        }
        
        return res.status(200).json({
          success: true,
          timer_type: 'duel',
          ...duelTimer,
          cleanup_results: expiration_results
        });
      }
      
      if (type === 'invitation' && id) {
        // Get invitation timer information
        const invitationTimer = await getInvitationTimer(client, parseInt(id));
        
        if (!invitationTimer) {
          return res.status(404).json({
            success: false,
            message: 'Invitation not found'
          });
        }
        
        return res.status(200).json({
          success: true,
          timer_type: 'invitation',
          ...invitationTimer,
          cleanup_results: expiration_results
        });
      }
      
      if (type === 'user') {
        // Get all timers for authenticated user
        const user = await verifyToken(req);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        const playerId = parseInt(user.playerId);
        
        // Get user's active duels
        const duelsResult = await client.query(`
          SELECT 
            d.duel_id,
            d.status,
            d.created_at,
            d.rules,
            challenger.display_name as challenger_name,
            challenged.display_name as challenged_name,
            CASE 
              WHEN d.challenger_id = $1 THEN 'challenger'
              WHEN d.challenged_id = $1 THEN 'challenged'
              ELSE 'unknown'
            END as user_role
          FROM duels d
          LEFT JOIN users challenger ON d.challenger_id = challenger.id
          LEFT JOIN users challenged ON d.challenged_id = challenged.id
          WHERE (d.challenger_id = $1 OR d.challenged_id = $1)
            AND d.status IN ('pending', 'active')
          ORDER BY d.created_at DESC
        `, [playerId]);
        
        // Get user's pending invitations (sent and received)
        const invitationsResult = await client.query(`
          SELECT 
            di.invitation_id,
            di.status,
            di.expires_at,
            di.invitation_method,
            di.duel_id,
            d.rules as duel_rules,
            challenger.display_name as challenger_name,
            CASE 
              WHEN di.inviting_user_id = $1 THEN 'sender'
              WHEN di.invited_user_id = $1 THEN 'recipient'
              ELSE 'unknown'
            END as user_role
          FROM duel_invitations di
          JOIN duels d ON di.duel_id = d.duel_id
          LEFT JOIN users challenger ON di.inviting_user_id = challenger.id
          WHERE (di.inviting_user_id = $1 OR di.invited_user_id = $1)
            AND di.status = 'pending'
          ORDER BY di.created_at DESC
        `, [playerId]);
        
        // Process duels with timer information
        const activeTimers = duelsResult.rows.map(duel => {
          const timeLimit = duel.rules?.time_limit_hours || 48;
          return {
            timer_type: 'duel',
            duel_id: duel.duel_id,
            status: duel.status,
            user_role: duel.user_role,
            challenger_name: duel.challenger_name,
            challenged_name: duel.challenged_name,
            duel_config: duel.rules,
            ...calculateRemainingTime(duel.created_at, timeLimit)
          };
        });
        
        // Process invitations with timer information
        const pendingInvitations = invitationsResult.rows.map(invitation => {
          const now = new Date();
          const expiresAt = new Date(invitation.expires_at);
          const remainingMs = expiresAt.getTime() - now.getTime();
          
          return {
            timer_type: 'invitation',
            invitation_id: invitation.invitation_id,
            duel_id: invitation.duel_id,
            status: invitation.status,
            user_role: invitation.user_role,
            invitation_method: invitation.invitation_method,
            challenger_name: invitation.challenger_name,
            expires_at: invitation.expires_at,
            remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000)),
            remaining_minutes: Math.max(0, Math.floor(remainingMs / (1000 * 60))),
            remaining_hours: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
            is_expired: remainingMs <= 0,
            duel_config: invitation.duel_rules
          };
        });
        
        return res.status(200).json({
          success: true,
          active_duel_timers: activeTimers,
          pending_invitation_timers: pendingInvitations,
          total_active_timers: activeTimers.length + pendingInvitations.length,
          cleanup_results: expiration_results
        });
      }
      
      // Default: return cleanup results only
      return res.status(200).json({
        success: true,
        message: 'Timer management endpoint',
        cleanup_results: expiration_results
      });
    }
    
    if (req.method === 'POST') {
      const { action, timer_type, timer_id } = req.body;
      
      if (action === 'extend_timer') {
        // Extend a timer (admin function - requires special permissions)
        const user = await verifyToken(req);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        // TODO: Check admin permissions
        
        return res.status(501).json({
          success: false,
          message: 'Timer extension not yet implemented'
        });
      }
      
      if (action === 'cancel_timer') {
        // Cancel a timer (owner only)
        const user = await verifyToken(req);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        const playerId = parseInt(user.playerId);
        
        if (timer_type === 'duel') {
          // Cancel duel (challenger only, and only if pending)
          const cancelResult = await client.query(`
            UPDATE duels 
            SET status = 'cancelled', updated_at = NOW()
            WHERE duel_id = $1 
              AND challenger_id = $2 
              AND status = 'pending'
            RETURNING duel_id
          `, [timer_id, playerId]);
          
          if (cancelResult.rows.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'Cannot cancel duel - either not found, not yours, or already started'
            });
          }
          
          return res.status(200).json({
            success: true,
            message: 'Duel cancelled successfully',
            cancelled_duel_id: timer_id
          });
        }
        
        if (timer_type === 'invitation') {
          // Cancel invitation (sender only, and only if pending)
          const cancelResult = await client.query(`
            UPDATE duel_invitations 
            SET status = 'cancelled', updated_at = NOW()
            WHERE invitation_id = $1 
              AND inviting_user_id = $2 
              AND status = 'pending'
            RETURNING invitation_id, duel_id
          `, [timer_id, playerId]);
          
          if (cancelResult.rows.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'Cannot cancel invitation - either not found, not yours, or already responded to'
            });
          }
          
          // Also cancel the associated duel if no other invitations exist
          const otherInvitations = await client.query(`
            SELECT invitation_id FROM duel_invitations 
            WHERE duel_id = $1 AND status = 'pending' AND invitation_id != $2
          `, [cancelResult.rows[0].duel_id, timer_id]);
          
          if (otherInvitations.rows.length === 0) {
            await client.query(`
              UPDATE duels 
              SET status = 'cancelled', updated_at = NOW()
              WHERE duel_id = $1
            `, [cancelResult.rows[0].duel_id]);
          }
          
          return res.status(200).json({
            success: true,
            message: 'Invitation cancelled successfully',
            cancelled_invitation_id: timer_id,
            cancelled_duel_id: cancelResult.rows[0].duel_id
          });
        }
        
        return res.status(400).json({
          success: false,
          message: 'Invalid timer type for cancellation'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }
    
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  } catch (error) {
    console.error('[timer-management] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process timer request',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}