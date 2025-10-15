import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { 
    type = 'received', // 'received', 'sent', 'all'
    status = 'all', // 'pending', 'accepted', 'declined', 'expired', 'all'
    invitation_type = 'all' // 'friend', 'duel', 'league', 'all'
  } = req.query;

  const client = await pool.connect();
  
  try {
    let baseQuery = `
      SELECT 
        i.invitation_id,
        i.invitation_type,
        i.invitation_data,
        i.status,
        i.identifier,
        i.identifier_type,
        i.message,
        i.expires_at,
        i.created_at,
        i.updated_at,
        inviter.player_id as inviter_id,
        inviter.name as inviter_name,
        inviter.email as inviter_email,
        target.player_id as target_player_id,
        target.name as target_name,
        target.is_hidden as target_is_hidden
      FROM invitations i
      JOIN players inviter ON i.inviter_id = inviter.player_id
      JOIN players target ON i.hidden_player_id = target.player_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by user type (received/sent)
    if (type === 'received') {
      // Invitations where user is target OR user can claim hidden profile
      baseQuery += ` AND (
        i.hidden_player_id = $${++paramCount}
        OR (
          target.is_hidden = true 
          AND (
            (i.identifier_type = 'email' AND inviter.email = (SELECT email FROM players WHERE player_id = $${paramCount}))
            OR (i.identifier_type = 'username' AND inviter.name = (SELECT name FROM players WHERE player_id = $${paramCount}))
          )
        )
      )`;
      params.push(user.playerId);
    } else if (type === 'sent') {
      baseQuery += ` AND i.inviter_id = $${++paramCount}`;
      params.push(user.playerId);
    } else if (type === 'all') {
      baseQuery += ` AND (
        i.inviter_id = $${++paramCount}
        OR i.hidden_player_id = $${paramCount}
        OR (
          target.is_hidden = true 
          AND (
            (i.identifier_type = 'email' AND inviter.email = (SELECT email FROM players WHERE player_id = $${paramCount}))
            OR (i.identifier_type = 'username' AND inviter.name = (SELECT name FROM players WHERE player_id = $${paramCount}))
          )
        )
      )`;
      params.push(user.playerId);
    }

    // Filter by status
    if (status !== 'all') {
      baseQuery += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }

    // Filter by invitation type
    if (invitation_type !== 'all') {
      baseQuery += ` AND i.invitation_type = $${++paramCount}`;
      params.push(invitation_type);
    }

    // Add ordering
    baseQuery += ` ORDER BY i.created_at DESC`;

    // Add limit
    const limit = parseInt(req.query.limit) || 50;
    baseQuery += ` LIMIT $${++paramCount}`;
    params.push(limit);

    console.log('Query:', baseQuery);
    console.log('Params:', params);

    const result = await client.query(baseQuery, params);

    // Process the invitations to add computed fields
    const invitations = result.rows.map(invitation => {
      const isReceived = invitation.target_player_id === user.playerId || 
                        (invitation.target_is_hidden && canClaimInvitation(invitation, user));
      const isSent = invitation.inviter_id === user.playerId;
      const isExpired = new Date(invitation.expires_at) < new Date();
      
      return {
        ...invitation,
        is_received: isReceived,
        is_sent: isSent,
        is_expired: isExpired,
        can_respond: isReceived && invitation.status === 'pending' && !isExpired,
        invitation_data: typeof invitation.invitation_data === 'string' 
          ? JSON.parse(invitation.invitation_data) 
          : invitation.invitation_data
      };
    });

    // Get summary counts
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW()) as pending_received,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) FILTER (WHERE status = 'expired' OR expires_at <= NOW()) as expired
      FROM invitations i
      WHERE (
        i.hidden_player_id = $1
        OR (
          i.hidden_player_id IN (
            SELECT player_id FROM players 
            WHERE is_hidden = true 
            AND (
              (invitation_identifier = (SELECT email FROM players WHERE player_id = $1) AND identifier_type = 'email')
              OR (invitation_identifier = (SELECT name FROM players WHERE player_id = $1) AND identifier_type = 'username')
            )
          )
        )
      )
    `, [user.playerId]);

    const summary = summaryResult.rows[0];

    return res.status(200).json({
      success: true,
      invitations,
      summary: {
        pending_received: parseInt(summary.pending_received) || 0,
        accepted: parseInt(summary.accepted) || 0,
        declined: parseInt(summary.declined) || 0,
        expired: parseInt(summary.expired) || 0,
        total: invitations.length
      },
      filters: {
        type,
        status,
        invitation_type,
        limit
      }
    });

  } catch (error) {
    console.error('List invitations error:', error);
    return res.status(500).json({ 
      error: 'Failed to list invitations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
}

// Helper function to check if user can claim an invitation
function canClaimInvitation(invitation, user) {
  // This would need access to the user's data to check email/username match
  // For now, we'll handle this in the main query
  return false;
}