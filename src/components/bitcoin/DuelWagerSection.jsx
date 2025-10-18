/**
 * Duel Wager Section Component
 *
 * Bitcoin wager UI for duels - HIDDEN by default
 * Only renders when isBitcoinEnabled() returns true
 *
 * IMPORTANT: This component will never show in production as long as
 * BITCOIN_CONFIG.ENABLED and BITCOIN_CONFIG.SHOW_UI remain false
 */

import React, { useState, useEffect } from 'react';
import { isBitcoinEnabled, isFeatureEnabled, getPlatformFee, calculateFee, formatSats } from '../../config/bitcoin';
import './DuelWagerSection.css';

const DuelWagerSection = ({ wagerEnabled, setWagerEnabled, wagerAmount, setWagerAmount }) => {
  // Hard gate - never renders if bitcoin features disabled
  if (!isBitcoinEnabled() || !isFeatureEnabled('DUELS_WAGERS')) {
    return null;
  }

  const [showDetails, setShowDetails] = useState(false);
  const platformFeePercent = getPlatformFee('DUELS');

  // Calculate amounts
  const totalPot = wagerAmount * 2;
  const platformFee = calculateFee(totalPot, 'DUELS');
  const winnerReceives = totalPot - platformFee;

  return (
    <div className="duel-wager-section">
      <div className="wager-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={wagerEnabled}
            onChange={(e) => setWagerEnabled(e.target.checked)}
          />
          <span className="toggle-text">⚡ Enable Bitcoin Wager</span>
          <span className="beta-badge">BETA</span>
        </label>
        <button
          type="button"
          className="info-button"
          onClick={() => setShowDetails(!showDetails)}
          aria-label="Wager information"
        >
          ℹ️
        </button>
      </div>

      {showDetails && (
        <div className="wager-info-box">
          <h4>How Bitcoin Wagers Work</h4>
          <ul>
            <li>Both players deposit equal wager amounts to escrow</li>
            <li>Funds held in self-custodial ArkadeOS VTXO (you control your keys)</li>
            <li>Winner receives pot minus {platformFeePercent}% platform fee</li>
            <li>Automatic payout when duel completes</li>
            <li>Refund if duel expires or is cancelled</li>
          </ul>
        </div>
      )}

      {wagerEnabled && (
        <div className="wager-config">
          <div className="form-group">
            <label htmlFor="wager-amount">
              Wager Amount (satoshis)
            </label>
            <input
              id="wager-amount"
              type="number"
              min="100"
              step="100"
              value={wagerAmount}
              onChange={(e) => setWagerAmount(parseInt(e.target.value, 10) || 0)}
              placeholder="e.g., 10000"
              className="wager-input"
            />
            <small className="input-help">
              Minimum: 100 sats (~$0.10 at current rates)
            </small>
          </div>

          {wagerAmount > 0 && (
            <div className="wager-breakdown">
              <h4>Payout Breakdown</h4>
              <div className="breakdown-row">
                <span>Your deposit:</span>
                <strong>{formatSats(wagerAmount)}</strong>
              </div>
              <div className="breakdown-row">
                <span>Opponent deposit:</span>
                <strong>{formatSats(wagerAmount)}</strong>
              </div>
              <div className="breakdown-row total">
                <span>Total pot:</span>
                <strong>{formatSats(totalPot)}</strong>
              </div>
              <div className="breakdown-row fee">
                <span>Platform fee ({platformFeePercent}%):</span>
                <span>-{formatSats(platformFee)}</span>
              </div>
              <div className="breakdown-row winner">
                <span>Winner receives:</span>
                <strong className="highlight">{formatSats(winnerReceives)}</strong>
              </div>
            </div>
          )}

          <div className="escrow-notice">
            <span className="lock-icon">🔒</span>
            <div>
              <strong>Self-Custodial Escrow</strong>
              <p>
                Funds held in ArkadeOS multi-signature VTXO. Proof of Putt never
                takes custody. You maintain control via your bitcoin keys.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuelWagerSection;
