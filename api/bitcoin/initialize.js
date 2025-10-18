/**
 * ArkadeOS Initialization API Endpoint
 *
 * Initializes the ArkadeOS wallet connection for testing
 * DISABLED in production - only works when ARKADE_ENABLED=true
 */

import { arkadeService, ARKADE_FEATURES_ENABLED } from '../../utils/arkade-service.js';

export default async function handler(req, res) {
  // Feature gate - always returns 501 when disabled
  if (!ARKADE_FEATURES_ENABLED) {
    return res.status(501).json({
      error: 'Bitcoin features not enabled',
      message: 'ArkadeOS integration is disabled in production. Set ARKADE_ENABLED=true for local testing only.',
      enabled: false
    });
  }

  // Only allow in development/testing
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Forbidden in production',
      message: 'Bitcoin features cannot be initialized in production environment'
    });
  }

  try {
    const initialized = await arkadeService.initialize();

    if (initialized) {
      const address = await arkadeService.getAddress();

      return res.json({
        status: 'initialized',
        network: process.env.ARKADE_NETWORK || 'local',
        serverUrl: process.env.ARKADE_SERVER_URL,
        address,
        message: 'ArkadeOS wallet initialized successfully'
      });
    } else {
      return res.status(500).json({
        error: 'Initialization failed',
        message: 'Failed to initialize ArkadeOS wallet. Check server logs.'
      });
    }
  } catch (error) {
    console.error('[API] ArkadeOS initialization error:', error);
    return res.status(500).json({
      error: error.message,
      message: 'ArkadeOS initialization error'
    });
  }
}
