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

// Rate limiting configuration
const RATE_LIMITS = {
  lookups_per_minute: 5,
  lookups_per_hour: 20,
  lookups_per_day: 100
};

/**
 * Check if user has exceeded lookup rate limits
 */
async function checkRateLimit(client, userId) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Count recent lookups
  const recentLookups = await client.query(`
    SELECT 
      COUNT(CASE WHEN created_at > $1 THEN 1 END) as last_minute,
      COUNT(CASE WHEN created_at > $2 THEN 1 END) as last_hour,
      COUNT(CASE WHEN created_at > $3 THEN 1 END) as last_day
    FROM user_lookup_logs 
    WHERE inviting_user_id = $4
  `, [oneMinuteAgo, oneHourAgo, oneDayAgo, userId]);

  const counts = recentLookups.rows[0];

  if (parseInt(counts.last_minute) >= RATE_LIMITS.lookups_per_minute) {
    throw new Error('Rate limit exceeded: Too many lookups per minute');
  }
  if (parseInt(counts.last_hour) >= RATE_LIMITS.lookups_per_hour) {
    throw new Error('Rate limit exceeded: Too many lookups per hour');
  }
  if (parseInt(counts.last_day) >= RATE_LIMITS.lookups_per_day) {
    throw new Error('Rate limit exceeded: Too many lookups per day');
  }

  return true;
}

/**
 * Log lookup attempt for rate limiting and abuse detection
 */
async function logLookupAttempt(client, invitingUserId, lookupType, success) {
  await client.query(`
    INSERT INTO user_lookup_logs (inviting_user_id, lookup_method, lookup_success, created_at)
    VALUES ($1, $2, $3, NOW())
  `, [invitingUserId, lookupType, success]);
}

/**
 * Find user by exact identifier match
 */
async function findExactUser(client, identifier, lookupType) {
  let query, params;

  switch (lookupType) {
    case 'username':
      query = 'SELECT * FROM users WHERE username = $1';
      params = [identifier];
      break;
    case 'email':
      query = 'SELECT * FROM users WHERE email = $1';
      params = [identifier.toLowerCase()];
      break;
    case 'phone':
      // Normalize phone number (remove spaces, dashes, parentheses)
      const normalizedPhone = identifier.replace(/[\s\-\(\)]/g, '');
      query = 'SELECT * FROM users WHERE phone_number = $1';
      params = [normalizedPhone];
      break;
    default:
      return null;
  }

  const result = await client.query(query, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Check if user can receive invitations from another user
 */
async function checkInvitationPermissions(client, targetUser, invitingUserId) {
  // Get target user's privacy settings
  const privacyResult = await client.query(`
    SELECT * FROM user_privacy_settings WHERE user_id = $1
  `, [targetUser.id]);

  // Default privacy settings if none exist
  const privacy = privacyResult.rows[0] || {
    accepts_duel_invitations: true,
    accepts_from_strangers: false,
    blocked_users: []
  };

  // Check if invitations are disabled
  if (!privacy.accepts_duel_invitations) {
    return false;
  }

  // Check if inviting user is blocked
  if (privacy.blocked_users && privacy.blocked_users.includes(invitingUserId)) {
    return false;
  }

  // Check if they're strangers and stranger invitations are disabled
  if (!privacy.accepts_from_strangers) {
    // Check if they're friends
    const friendshipResult = await client.query(`
      SELECT * FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
      AND status = 'accepted'
    `, [targetUser.id, invitingUserId]);

    if (friendshipResult.rows.length === 0) {
      return false; // Not friends and doesn't accept stranger invitations
    }
  }

  return true;
}

/**
 * Detect potentially abusive lookup patterns
 */
async function detectAbusiveLookup(client, userId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentActivity = await client.query(`
    SELECT 
      COUNT(*) as total_lookups,
      COUNT(CASE WHEN lookup_success = false THEN 1 END) as failed_lookups,
      COUNT(DISTINCT 
        CASE 
          WHEN lookup_method = 'email' THEN substring(lookup_identifier from '@(.*)$')
          WHEN lookup_method = 'phone' THEN substring(lookup_identifier from '^\\+?[1-9]\\d{0,3}')
          ELSE lookup_identifier
        END
      ) as unique_domains_or_prefixes
    FROM user_lookup_logs 
    WHERE inviting_user_id = $1 AND created_at > $2
  `, [userId, oneHourAgo]);

  const activity = recentActivity.rows[0];
  const totalLookups = parseInt(activity.total_lookups);
  const failedLookups = parseInt(activity.failed_lookups);

  // Red flags for abuse
  if (totalLookups > 15 && failedLookups / totalLookups > 0.8) {
    return 'HIGH_FAILURE_RATE'; // Likely scanning for users
  }

  if (totalLookups > 10 && parseInt(activity.unique_domains_or_prefixes) < 3) {
    return 'REPEATED_PATTERNS'; // Targeting specific domains/areas
  }

  return 'NORMAL';
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authentication required
  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const client = await pool.connect();
  
  try {
    const { lookup_type, identifier, purpose = 'duel_invitation' } = req.body;
    const invitingUserId = parseInt(user.playerId);

    // Validate input
    if (!lookup_type || !identifier) {
      return res.status(400).json({ 
        success: false, 
        message: 'lookup_type and identifier are required' 
      });
    }

    if (!['username', 'email', 'phone'].includes(lookup_type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid lookup_type. Must be username, email, or phone' 
      });
    }

    // Only support duel invitations for now
    if (purpose !== 'duel_invitation') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only duel_invitation purpose is currently supported' 
      });
    }

    // Check rate limits
    try {
      await checkRateLimit(client, invitingUserId);
    } catch (rateLimitError) {
      await logLookupAttempt(client, invitingUserId, lookup_type, false);
      return res.status(429).json({ 
        success: false, 
        message: rateLimitError.message 
      });
    }

    // Check for abusive patterns
    const abuseCheck = await detectAbusiveLookup(client, invitingUserId);
    if (abuseCheck !== 'NORMAL') {
      await logLookupAttempt(client, invitingUserId, lookup_type, false);
      return res.status(429).json({ 
        success: false, 
        message: 'Suspicious activity detected. Please try again later.' 
      });
    }

    // Perform exact user lookup
    const targetUser = await findExactUser(client, identifier, lookup_type);

    if (!targetUser) {
      // Log failed lookup
      await logLookupAttempt(client, invitingUserId, lookup_type, false);
      
      // Return generic "not found" response
      return res.status(200).json({
        success: true,
        user_found: false,
        message: 'User not found or cannot receive invitations'
      });
    }

    // Check invitation permissions
    const canInvite = await checkInvitationPermissions(client, targetUser, invitingUserId);

    if (!canInvite) {
      // Log failed lookup (privacy blocked)
      await logLookupAttempt(client, invitingUserId, lookup_type, false);
      
      // Return same response as "not found" for privacy
      return res.status(200).json({
        success: true,
        user_found: false,
        message: 'User not found or cannot receive invitations'
      });
    }

    // User found and can receive invitations
    await logLookupAttempt(client, invitingUserId, lookup_type, true);

    return res.status(200).json({
      success: true,
      user_found: true,
      user_id: targetUser.id,
      display_name: targetUser.display_name || targetUser.username,
      can_receive_invitations: true,
      invitation_preferences: {
        accepts_duels: true,
        preferred_method: 'in_app' // Could be expanded with user preferences
      }
    });

  } catch (error) {
    console.error('[user-lookup] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An internal server error occurred.' 
    });
  } finally {
    client.release();
  }
}