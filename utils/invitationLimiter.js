/**
 * Invitation rate limiting system
 * Prevents spam and manages invitation quotas per player
 */

// Rate limits configuration
const RATE_LIMITS = {
  email: {
    daily: 10,
    batch: 5  // Max at one time
  },
  phone: {
    daily: 1,
    batch: 1  // Only 1 SMS at a time
  }
};

/**
 * Check if player can send invitations
 */
export const checkInvitationLimits = async (client, playerId, contactType, contactCount = 1) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  try {
    // Get current player invitation status
    const playerResult = await client.query(`
      SELECT daily_invites_sent, last_invite_date 
      FROM players 
      WHERE player_id = $1
    `, [playerId]);
    
    if (playerResult.rows.length === 0) {
      throw new Error('Player not found');
    }
    
    const player = playerResult.rows[0];
    const lastInviteDate = player.last_invite_date ? 
      new Date(player.last_invite_date).toISOString().split('T')[0] : null;
    
    // Reset counter if it's a new day
    const currentCount = lastInviteDate === today ? (player.daily_invites_sent || 0) : 0;
    
    // Get limits for contact type
    const limit = RATE_LIMITS[contactType] || RATE_LIMITS.email;
    
    // Check daily limit
    if (currentCount + contactCount > limit.daily) {
      return {
        allowed: false,
        error: `Daily ${contactType} invitation limit exceeded (${limit.daily}/day)`,
        current: currentCount,
        limit: limit.daily,
        remaining: Math.max(0, limit.daily - currentCount)
      };
    }
    
    // Check batch limit (how many at once)
    if (contactCount > limit.batch) {
      return {
        allowed: false,
        error: `Too many ${contactType} invitations at once (max ${limit.batch} per request)`,
        current: contactCount,
        limit: limit.batch,
        remaining: limit.batch
      };
    }
    
    return {
      allowed: true,
      current: currentCount,
      limit: limit.daily,
      remaining: limit.daily - currentCount - contactCount,
      willUse: contactCount
    };
    
  } catch (error) {
    console.error('Error checking invitation limits:', error);
    return {
      allowed: false,
      error: 'Failed to check invitation limits',
      current: 0,
      limit: 0,
      remaining: 0
    };
  }
};

/**
 * Record invitations sent and update player's daily count
 */
export const recordInvitationsSent = async (client, playerId, count = 1) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Update player's invitation count
    // If it's a new day, reset the counter, otherwise increment
    await client.query(`
      UPDATE players 
      SET 
        daily_invites_sent = CASE 
          WHEN last_invite_date::date = $2::date THEN COALESCE(daily_invites_sent, 0) + $3
          ELSE $3
        END,
        last_invite_date = $2::date
      WHERE player_id = $1
    `, [playerId, today, count]);
    
    console.log(`Recorded ${count} invitation(s) sent for player ${playerId} on ${today}`);
    return { success: true };
  } catch (error) {
    console.error('Error recording invitations sent:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current invitation status for a player
 */
export const getInvitationStatus = async (client, playerId) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const playerResult = await client.query(`
      SELECT daily_invites_sent, last_invite_date 
      FROM players 
      WHERE player_id = $1
    `, [playerId]);
    
    if (playerResult.rows.length === 0) {
      return { error: 'Player not found' };
    }
    
    const player = playerResult.rows[0];
    const lastInviteDate = player.last_invite_date ? 
      new Date(player.last_invite_date).toISOString().split('T')[0] : null;
    
    const todaysCount = lastInviteDate === today ? (player.daily_invites_sent || 0) : 0;
    
    return {
      email: {
        used: todaysCount,
        limit: RATE_LIMITS.email.daily,
        remaining: Math.max(0, RATE_LIMITS.email.daily - todaysCount),
        batchLimit: RATE_LIMITS.email.batch
      },
      phone: {
        used: todaysCount,
        limit: RATE_LIMITS.phone.daily,
        remaining: Math.max(0, RATE_LIMITS.phone.daily - todaysCount),
        batchLimit: RATE_LIMITS.phone.batch
      },
      lastInviteDate,
      resetDate: today
    };
  } catch (error) {
    console.error('Error getting invitation status:', error);
    return { error: error.message };
  }
};

/**
 * Validate contact list against rate limits
 */
export const validateContactList = async (client, playerId, contacts) => {
  const emailContacts = contacts.filter(c => c.type === 'email');
  const phoneContacts = contacts.filter(c => c.type === 'phone');
  
  const errors = [];
  
  // Check email limits
  if (emailContacts.length > 0) {
    const emailCheck = await checkInvitationLimits(client, playerId, 'email', emailContacts.length);
    if (!emailCheck.allowed) {
      errors.push(`Email: ${emailCheck.error}`);
    }
  }
  
  // Check phone limits  
  if (phoneContacts.length > 0) {
    const phoneCheck = await checkInvitationLimits(client, playerId, 'phone', phoneContacts.length);
    if (!phoneCheck.allowed) {
      errors.push(`SMS: ${phoneCheck.error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      email: emailContacts.length,
      phone: phoneContacts.length,
      total: contacts.length
    }
  };
};