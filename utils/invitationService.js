/**
 * Unified invitation service for email and SMS
 * Handles rate limiting, validation, and sending invitations
 */

import { sendDuelInviteEmail, sendLeagueInviteEmail } from './emailService.js';
import { sendDuelInviteSMS, sendLeagueInviteSMS, validateUSPhoneNumber, isSMSServiceAvailable } from './smsService.js';
import { checkInvitationLimits, recordInvitationsSent, validateContactList } from './invitationLimiter.js';

/**
 * Send a single invitation (email or SMS)
 */
export const sendSingleInvitation = async (contact, inviterName, details, type = 'duel') => {
  try {
    // Validate contact type and format
    if (contact.type === 'email') {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.value)) {
        return { success: false, error: 'Invalid email format' };
      }
      
      // Send email invitation
      if (type === 'duel') {
        return await sendDuelInviteEmail(contact.value, inviterName, details);
      } else if (type === 'league') {
        return await sendLeagueInviteEmail(contact.value, inviterName, details);
      }
      
    } else if (contact.type === 'phone') {
      // Check if SMS service is available
      if (!isSMSServiceAvailable()) {
        return { success: false, error: 'SMS service not configured' };
      }
      
      // Validate US phone number
      const validatedPhone = validateUSPhoneNumber(contact.value);
      if (!validatedPhone) {
        return { success: false, error: 'Invalid US phone number format' };
      }
      
      // Send SMS invitation
      if (type === 'duel') {
        return await sendDuelInviteSMS(validatedPhone, inviterName, details);
      } else if (type === 'league') {
        return await sendLeagueInviteSMS(validatedPhone, inviterName, details);
      }
    }
    
    return { success: false, error: `Unsupported contact type: ${contact.type}` };
    
  } catch (error) {
    console.error(`Failed to send ${type} invitation to ${contact.type}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send multiple invitations with rate limiting
 */
export const sendInvitations = async (client, playerId, contacts, inviterName, details, type = 'duel') => {
  try {
    // Validate all contacts against rate limits first
    const validation = await validateContactList(client, playerId, contacts);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        details: validation.errors,
        summary: validation.summary
      };
    }
    
    const results = {
      success: true,
      sent: 0,
      failed: 0,
      details: [],
      summary: validation.summary
    };
    
    // Send invitations one by one
    for (const contact of contacts) {
      // Check individual limits before each send
      const limitCheck = await checkInvitationLimits(client, playerId, contact.type, 1);
      if (!limitCheck.allowed) {
        results.failed++;
        results.details.push({
          contact: contact.value,
          type: contact.type,
          success: false,
          error: limitCheck.error
        });
        continue;
      }
      
      // Send the invitation
      const result = await sendSingleInvitation(contact, inviterName, details, type);
      
      if (result.success) {
        // Record successful invitation
        await recordInvitationsSent(client, playerId, 1);
        results.sent++;
        results.details.push({
          contact: contact.value,
          type: contact.type,
          success: true,
          messageId: result.messageId || 'email-sent',
          cost: result.cost || 'free'
        });
      } else {
        results.failed++;
        results.details.push({
          contact: contact.value,
          type: contact.type,
          success: false,
          error: result.error
        });
      }
    }
    
    // Update overall success status
    results.success = results.sent > 0;
    if (results.failed > 0 && results.sent === 0) {
      results.success = false;
      results.error = 'All invitations failed to send';
    } else if (results.failed > 0) {
      results.error = `${results.failed} of ${contacts.length} invitations failed`;
    }
    
    return results;
    
  } catch (error) {
    console.error('Error sending invitations:', error);
    return {
      success: false,
      error: 'Failed to send invitations',
      sent: 0,
      failed: contacts.length,
      details: [],
      summary: { email: 0, phone: 0, total: contacts.length }
    };
  }
};

/**
 * Convenience function for duel invitations
 */
export const sendDuelInvitations = async (client, playerId, contacts, inviterName, duelDetails) => {
  return await sendInvitations(client, playerId, contacts, inviterName, duelDetails, 'duel');
};

/**
 * Convenience function for league invitations
 */
export const sendLeagueInvitations = async (client, playerId, contacts, inviterName, leagueDetails) => {
  return await sendInvitations(client, playerId, contacts, inviterName, leagueDetails, 'league');
};

/**
 * Preview invitation limits for a contact list (without sending)
 */
export const previewInvitationLimits = async (client, playerId, contacts) => {
  return await validateContactList(client, playerId, contacts);
};