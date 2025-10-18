/**
 * ArkadeOS Webhook Handler
 *
 * Receives payment notifications from ArkadeOS server
 * - Escrow funding confirmations
 * - Payout completions
 * - Transaction status updates
 *
 * IMPORTANT: Not implemented yet - requires ArkadeOS webhook setup
 */

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Feature not implemented yet
  console.log('[Webhook] ArkadeOS webhook called (not implemented)');
  console.log('[Webhook] Body:', req.body);

  // TODO: Implement webhook handling:
  // 1. Verify webhook signature (ARKADE_WEBHOOK_SECRET)
  // 2. Parse event type (escrow_funded, payout_complete, etc.)
  // 3. Update database records accordingly
  // 4. Trigger notifications to players
  // 5. Return 200 OK to acknowledge receipt

  return res.status(501).json({
    error: 'Not implemented',
    message: 'ArkadeOS webhook handling not yet implemented',
    received: true,
    timestamp: new Date().toISOString()
  });
}
