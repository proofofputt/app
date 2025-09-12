// Nostr authentication utilities

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Check if Nostr extension is available in the browser
 * @returns {boolean}
 */
export function isNostrAvailable() {
  return typeof window !== 'undefined' && window.nostr;
}

/**
 * Get supported Nostr extensions
 * @returns {string[]}
 */
export function getNostrExtensions() {
  const extensions = [];
  
  if (typeof window === 'undefined') return extensions;
  
  // Check for common Nostr browser extensions
  if (window.nostr) {
    // Generic nostr support
    extensions.push('nostr');
  }
  
  // Check for specific extensions by their window properties
  if (window.webln) extensions.push('Alby'); // Alby wallet
  if (window.nos2x) extensions.push('nos2x'); // nos2x extension
  
  return extensions;
}

/**
 * Request user's Nostr public key
 * @returns {Promise<string>} - Public key in hex format
 */
export async function getNostrPublicKey() {
  if (!window.nostr) {
    throw new Error('Nostr extension not found. Please install Alby, nos2x, or another Nostr extension.');
  }

  try {
    const pubkey = await window.nostr.getPublicKey();
    return pubkey;
  } catch (error) {
    throw new Error('Failed to get public key from Nostr extension: ' + error.message);
  }
}

/**
 * Sign an event with the user's Nostr private key
 * @param {Object} event - Nostr event to sign
 * @returns {Promise<Object>} - Signed event
 */
export async function signNostrEvent(event) {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  try {
    const signedEvent = await window.nostr.signEvent(event);
    return signedEvent;
  } catch (error) {
    throw new Error('Failed to sign event: ' + error.message);
  }
}

/**
 * Get user's Nostr profile metadata
 * @param {string} pubkey - User's public key
 * @returns {Promise<Object|null>} - Profile metadata or null
 */
export async function getNostrProfile(pubkey) {
  // This would typically require connecting to Nostr relays
  // For now, we'll return basic information or let the user provide it
  try {
    // Check if extension supports profile retrieval
    if (window.nostr?.getProfile) {
      return await window.nostr.getProfile();
    }
    
    // Fallback: return minimal profile
    return {
      pubkey,
      name: `nostr-${pubkey.slice(0, 8)}`,
      display_name: `Nostr User`,
      about: 'Authenticated via Nostr'
    };
  } catch (error) {
    console.warn('Could not retrieve Nostr profile:', error);
    return {
      pubkey,
      name: `nostr-${pubkey.slice(0, 8)}`,
      display_name: `Nostr User`,
      about: 'Authenticated via Nostr'
    };
  }
}

/**
 * Authenticate with Nostr
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export async function authenticateWithNostr() {
  try {
    if (!isNostrAvailable()) {
      throw new Error('Nostr extension not found. Please install a Nostr browser extension like Alby or nos2x.');
    }

    // Get user's public key
    const pubkey = await getNostrPublicKey();
    
    // Get user's profile
    const profile = await getNostrProfile(pubkey);
    
    // Create authentication event
    const authEvent = {
      kind: 1, // Text note
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['client', 'Proof of Putt'],
        ['challenge', 'auth']
      ],
      content: `Authenticate with Proof of Putt at ${Date.now()}`
    };

    // Sign the event
    const signedEvent = await signNostrEvent(authEvent);

    // Send to backend for verification
    const response = await fetch(`${API_BASE_URL}/auth/nostr/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: signedEvent,
        profile: profile
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Nostr authentication failed');
    }

    return {
      success: true,
      token: data.token,
      provider: 'nostr',
      player: data.player
    };

  } catch (error) {
    console.error('Nostr authentication error:', error);
    return {
      success: false,
      error: error.message || 'Nostr authentication failed'
    };
  }
}

/**
 * Format public key as npub (user-friendly format)
 * @param {string} pubkey - Public key in hex format
 * @returns {string} - npub format
 */
export function formatNpub(pubkey) {
  try {
    // This would require nostr-tools in the frontend
    // For now, return a simplified format
    return `npub1${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  } catch (error) {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }
}

/**
 * Get Nostr extension installation URLs
 * @returns {Object}
 */
export function getNostrExtensionUrls() {
  return {
    alby: 'https://getalby.com/',
    nos2x: 'https://github.com/fiatjaf/nos2x',
    flamingo: 'https://flamingo.me/',
    spring: 'https://spring.site/'
  };
}