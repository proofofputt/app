// Referral tracking utilities

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Extract referral session ID from URL parameters
 * @param {URLSearchParams} searchParams 
 * @returns {string|null}
 */
export function extractReferralSession(searchParams) {
  return searchParams.get('ref') || null;
}

/**
 * Store referral session in localStorage for later use
 * @param {string} sessionId 
 */
export function storeReferralSession(sessionId) {
  if (sessionId) {
    localStorage.setItem('referral_session', sessionId);
    localStorage.setItem('referral_stored_at', Date.now().toString());
    console.log(`[Referral] Stored session: ${sessionId}`);
  }
}

/**
 * Get stored referral session if still valid (within 7 days)
 * @returns {string|null}
 */
export function getStoredReferralSession() {
  const sessionId = localStorage.getItem('referral_session');
  const storedAt = localStorage.getItem('referral_stored_at');
  
  if (!sessionId || !storedAt) {
    return null;
  }
  
  // Check if stored referral is still valid (within 7 days)
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - parseInt(storedAt) > sevenDaysMs) {
    clearStoredReferralSession();
    return null;
  }
  
  return sessionId;
}

/**
 * Clear stored referral session
 */
export function clearStoredReferralSession() {
  localStorage.removeItem('referral_session');
  localStorage.removeItem('referral_stored_at');
}

/**
 * Create a new referral session
 * @param {Object} params
 * @param {string} params.invited_email
 * @param {string} params.invited_phone  
 * @param {string} params.invited_name
 * @param {string} params.referral_source
 * @param {Object} params.referral_context
 * @returns {Promise<Object>}
 */
export async function createReferralSession({
  invited_email,
  invited_phone,
  invited_name,
  referral_source = 'direct_link',
  referral_context = {},
  expires_hours = 168
}) {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required to create referral');
    }

    const response = await fetch(`${API_BASE_URL}/referrals/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        invited_email,
        invited_phone,
        invited_name,
        referral_source,
        referral_context,
        expires_hours
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to create referral session');
    }

    return data;

  } catch (error) {
    console.error('Create referral session error:', error);
    throw error;
  }
}

/**
 * Process referral assignment after signup
 * @param {Object} params
 * @param {number} params.player_id
 * @param {string} params.session_id
 * @param {string} params.signup_email
 * @param {string} params.signup_phone
 * @param {string} params.signup_name
 * @param {string} params.oauth_provider
 * @param {boolean} params.consent_contact_info
 * @returns {Promise<Object>}
 */
export async function assignReferral({
  player_id,
  session_id,
  signup_email,
  signup_phone,
  signup_name,
  oauth_provider,
  consent_contact_info = true
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/referrals/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player_id,
        session_id,
        signup_email,
        signup_phone,
        signup_name,
        oauth_provider,
        consent_contact_info
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Assign referral error:', error);
    throw error;
  }
}

/**
 * Automatically match and assign referral during signup
 * @param {Object} params
 * @param {number} params.player_id
 * @param {string} params.signup_email
 * @param {string} params.signup_phone
 * @param {string} params.signup_name
 * @param {string} params.oauth_provider
 * @param {boolean} params.consent_contact_info
 * @returns {Promise<Object>}
 */
export async function autoMatchReferral({
  player_id,
  signup_email,
  signup_phone,
  signup_name,
  oauth_provider,
  consent_contact_info = true
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/referrals/auto-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player_id,
        signup_email,
        signup_phone,
        signup_name,
        oauth_provider,
        consent_contact_info
      })
    });

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Auto match referral error:', error);
    // Don't throw - referral matching is optional
    return { success: false, error: error.message };
  }
}

/**
 * Handle referral tracking on app load
 * @param {URLSearchParams} searchParams 
 */
export function handleReferralTracking(searchParams) {
  const referralSession = extractReferralSession(searchParams);
  
  if (referralSession) {
    storeReferralSession(referralSession);
    
    // Clean up URL to remove referral parameter
    const url = new URL(window.location);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
    
    console.log(`[Referral] Tracking referral session: ${referralSession}`);
  }
}

/**
 * Get referral context for signup (either from URL or stored)
 * @param {URLSearchParams} searchParams 
 * @returns {Object}
 */
export function getReferralContext(searchParams) {
  const urlSession = extractReferralSession(searchParams);
  const storedSession = getStoredReferralSession();
  
  const sessionId = urlSession || storedSession;
  
  return {
    hasReferral: !!sessionId,
    sessionId: sessionId,
    isFromUrl: !!urlSession,
    isFromStorage: !!storedSession && !urlSession
  };
}

/**
 * Generate shareable referral link
 * @param {string} sessionId 
 * @param {string} baseUrl 
 * @returns {string}
 */
export function generateReferralLink(sessionId, baseUrl = window.location.origin) {
  return `${baseUrl}/register?ref=${sessionId}`;
}

/**
 * Validate referral session format
 * @param {string} sessionId 
 * @returns {boolean}
 */
export function isValidReferralSession(sessionId) {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
}