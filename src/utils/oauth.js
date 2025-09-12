// OAuth utility functions for frontend

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Initiate Google OAuth flow
 * @returns {Promise<{authUrl: string, sessionId: string}>}
 */
export async function initiateGoogleOAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/google/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to initialize Google OAuth');
    }

    return {
      authUrl: data.authUrl,
      sessionId: data.sessionId
    };
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    throw error;
  }
}

/**
 * Initiate LinkedIn OAuth flow  
 * @returns {Promise<{authUrl: string, sessionId: string}>}
 */
export async function initiateLinkedInOAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/linkedin/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to initialize LinkedIn OAuth');
    }

    return {
      authUrl: data.authUrl,
      sessionId: data.sessionId
    };
  } catch (error) {
    console.error('LinkedIn OAuth initiation error:', error);
    throw error;
  }
}

/**
 * Unlink an OAuth provider from the current user's account
 * @param {string} provider - 'google', 'linkedin', or 'nostr'
 * @returns {Promise<boolean>}
 */
export async function unlinkOAuthProvider(provider) {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/auth/unlink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ provider })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || `Failed to unlink ${provider}`);
    }

    return true;
  } catch (error) {
    console.error(`OAuth ${provider} unlink error:`, error);
    throw error;
  }
}

/**
 * Handle OAuth success callback from URL parameters
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {Promise<{success: boolean, token?: string, provider?: string, error?: string}>}
 */
export function handleOAuthCallback(searchParams) {
  const oauthSuccess = searchParams.get('oauth_success');
  const oauthError = searchParams.get('oauth_error');
  const token = searchParams.get('token');
  const provider = searchParams.get('provider');

  if (oauthError) {
    return {
      success: false,
      error: decodeURIComponent(oauthError)
    };
  }

  if (oauthSuccess === 'true' && token && provider) {
    return {
      success: true,
      token: token,
      provider: provider
    };
  }

  return { success: false };
}

/**
 * Open OAuth popup window and handle the authorization flow
 * @param {string} authUrl - OAuth authorization URL
 * @param {string} provider - Provider name for logging
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export function openOAuthPopup(authUrl, provider) {
  return new Promise((resolve) => {
    const popup = window.open(
      authUrl,
      `${provider}OAuth`,
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      resolve({
        success: false,
        error: 'Popup blocked. Please allow popups and try again.'
      });
      return;
    }

    // Poll for popup closure or success
    const pollTimer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollTimer);
          resolve({
            success: false,
            error: 'Authentication cancelled'
          });
          return;
        }

        // Check if popup has navigated to our success page
        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.includes('/login')) {
          const url = new URL(popupUrl);
          const result = handleOAuthCallback(url.searchParams);
          
          clearInterval(pollTimer);
          popup.close();
          
          resolve(result);
        }
      } catch (e) {
        // Cross-origin errors are expected during OAuth flow
        // Continue polling until popup closes or succeeds
      }
    }, 1000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollTimer);
      if (!popup.closed) {
        popup.close();
      }
      resolve({
        success: false,
        error: 'Authentication timeout'
      });
    }, 5 * 60 * 1000);
  });
}

/**
 * Get OAuth provider display names
 */
export const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    displayName: 'Continue with Google',
    icon: '🔍', // Could be replaced with actual Google icon
    color: '#4285f4'
  },
  linkedin: {
    name: 'LinkedIn',
    displayName: 'Continue with LinkedIn', 
    icon: '💼', // Could be replaced with actual LinkedIn icon
    color: '#0077b5'
  },
  nostr: {
    name: 'Nostr',
    displayName: 'Connect with Nostr',
    icon: '⚡', // Could be replaced with actual Nostr icon
    color: '#8b5cf6'
  }
};

/**
 * Validate OAuth provider name
 * @param {string} provider 
 * @returns {boolean}
 */
export function isValidProvider(provider) {
  return ['google', 'linkedin', 'nostr'].includes(provider);
}