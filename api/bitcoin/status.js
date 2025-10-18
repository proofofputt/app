/**
 * Bitcoin Integration Status API Endpoint
 *
 * Returns current status of bitcoin payment features
 * Safe to call in production - just reports configuration
 */

import { arkadeService } from '../../utils/arkade-service.js';
import { escrowManager } from '../../utils/bitcoin-escrow.js';

export default async function handler(req, res) {
  try {
    const arkadeStatus = arkadeService.getStatus();
    const escrowStatus = escrowManager.getStatus();

    return res.json({
      bitcoin_features: {
        enabled: arkadeStatus.enabled,
        initialized: arkadeStatus.initialized,
        network: arkadeStatus.network,
      },
      escrow_manager: {
        enabled: escrowStatus.enabled,
        fee_percentages: escrowStatus.feePercentages,
      },
      environment: process.env.NODE_ENV,
      message: arkadeStatus.enabled
        ? 'Bitcoin features enabled (testing mode)'
        : 'Bitcoin features disabled'
    });
  } catch (error) {
    console.error('[API] Bitcoin status error:', error);
    return res.status(500).json({ error: error.message });
  }
}
