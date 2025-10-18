/**
 * Bitcoin Payment Features Configuration
 *
 * CRITICAL: All bitcoin features are DISABLED by default for production safety
 *
 * To test locally:
 * 1. Start Nigiri: docker-compose -f docker-compose.nigiri.yml up -d
 * 2. Edit .env.development.local: ARKADE_ENABLED=true
 * 3. Temporarily set ENABLED and SHOW_UI to true (LOCAL ONLY - DO NOT COMMIT)
 * 4. Test bitcoin features at http://localhost:5173
 * 5. Revert ENABLED and SHOW_UI to false before committing
 *
 * Production Deployment:
 * - These flags MUST remain false until full security audit
 * - Database migrations must not be applied to production
 * - Feature rollout requires regulatory approval
 */

// =============================================================================
// MASTER KILL SWITCHES - MUST BE FALSE FOR PRODUCTION
// =============================================================================

export const BITCOIN_CONFIG = {
  // Master feature toggle - MUST be false for production deployment
  ENABLED: false,

  // UI visibility toggle - MUST be false to hide all bitcoin UI
  SHOW_UI: false,

  // Network configuration (local, mutinynet, signet, mainnet)
  NETWORK: process.env.NEXT_PUBLIC_ARKADE_NETWORK || 'local',

  // Feature-specific toggles (child of master ENABLED flag)
  FEATURES: {
    DUELS_WAGERS: false,        // Bitcoin wagers on duels
    LEAGUE_ENTRY_FEES: false,   // Entry fees for leagues
    LEAGUE_PRIZE_POOLS: false,  // Prize pool distribution
    FUNDRAISER_PLEDGES: false,  // Pledge-per-putt donations
  },

  // Platform fee percentages (for display purposes)
  FEES: {
    DUELS: 3,        // 3% platform fee on duels
    LEAGUES: 5,      // 5% platform fee on leagues
    FUNDRAISING: 2,  // 2% platform fee on fundraising
  },

  // Development settings
  DEBUG: process.env.NODE_ENV === 'development',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if bitcoin features are enabled and visible
 * Returns true only if BOTH enabled AND show_ui are true
 *
 * @returns {boolean}
 */
export const isBitcoinEnabled = () => {
  return BITCOIN_CONFIG.ENABLED && BITCOIN_CONFIG.SHOW_UI;
};

/**
 * Check if a specific bitcoin feature is enabled
 *
 * @param {string} feature - Feature name (DUELS_WAGERS, LEAGUE_ENTRY_FEES, etc.)
 * @returns {boolean}
 */
export const isFeatureEnabled = (feature) => {
  if (!isBitcoinEnabled()) return false;
  return BITCOIN_CONFIG.FEATURES[feature] === true;
};

/**
 * Get platform fee percentage for a transaction type
 *
 * @param {string} type - Transaction type (DUELS, LEAGUES, FUNDRAISING)
 * @returns {number} Fee percentage
 */
export const getPlatformFee = (type) => {
  return BITCOIN_CONFIG.FEES[type] || 0;
};

/**
 * Calculate platform fee in satoshis
 *
 * @param {number} amountSats - Amount in satoshis
 * @param {string} type - Transaction type
 * @returns {number} Fee amount in satoshis
 */
export const calculateFee = (amountSats, type) => {
  const feePercent = getPlatformFee(type);
  return Math.floor((amountSats * feePercent) / 100);
};

/**
 * Format satoshis for display
 *
 * @param {number} sats - Amount in satoshis
 * @param {boolean} includeUnit - Include 'sats' suffix
 * @returns {string} Formatted string
 */
export const formatSats = (sats, includeUnit = true) => {
  if (sats === null || sats === undefined) return includeUnit ? '0 sats' : '0';
  const formatted = sats.toLocaleString();
  return includeUnit ? `${formatted} sats` : formatted;
};

/**
 * Convert satoshis to BTC
 *
 * @param {number} sats - Amount in satoshis
 * @returns {number} Amount in BTC
 */
export const satsToBTC = (sats) => {
  return sats / 100000000;
};

/**
 * Convert BTC to satoshis
 *
 * @param {number} btc - Amount in BTC
 * @returns {number} Amount in satoshis
 */
export const btcToSats = (btc) => {
  return Math.floor(btc * 100000000);
};

// =============================================================================
// PRODUCTION SAFETY CHECK
// =============================================================================

// Log warning if bitcoin features are accidentally enabled
if (typeof window !== 'undefined' && BITCOIN_CONFIG.ENABLED) {
  console.warn(
    '%c⚠️ BITCOIN FEATURES ENABLED ⚠️',
    'background: #ff0000; color: #ffffff; font-size: 16px; padding: 10px;'
  );
  console.warn('Bitcoin payment features are currently enabled.');
  console.warn('This should ONLY happen in local development/testing.');
  console.warn('Network:', BITCOIN_CONFIG.NETWORK);
}

// Export default config
export default BITCOIN_CONFIG;
