/**
 * League Prize Pool Section Component
 *
 * Bitcoin entry fee and prize pool UI for leagues - HIDDEN by default
 * Only renders when isBitcoinEnabled() returns true
 *
 * IMPORTANT: This component will never show in production as long as
 * BITCOIN_CONFIG.ENABLED and BITCOIN_CONFIG.SHOW_UI remain false
 */

import React, { useState } from 'react';
import { isBitcoinEnabled, isFeatureEnabled, getPlatformFee, calculateFee, formatSats } from '../../config/bitcoin';
import './LeaguePrizePoolSection.css';

const LeaguePrizePoolSection = ({
  prizePoolEnabled,
  setPrizePoolEnabled,
  prizePoolType,
  setPrizePoolType,
  entryFeeSats,
  setEntryFeeSats,
  creatorPrizeSats,
  setCreatorPrizeSats,
  prizeDistribution,
  setPrizeDistribution,
  estimatedParticipants = 10,
}) => {
  // Hard gate - never renders if bitcoin features disabled
  if (!isBitcoinEnabled() || !isFeatureEnabled('LEAGUE_ENTRY_FEES')) {
    return null;
  }

  const [showDistributionEditor, setShowDistributionEditor] = useState(false);
  const platformFeePercent = getPlatformFee('LEAGUES');

  // Calculate prize pool
  const calculatePrizePool = () => {
    if (prizePoolType === 'entry_fees') {
      const totalCollected = entryFeeSats * estimatedParticipants;
      const fee = calculateFee(totalCollected, 'LEAGUES');
      return totalCollected - fee;
    } else if (prizePoolType === 'creator_funded') {
      return creatorPrizeSats || 0;
    } else if (prizePoolType === 'hybrid') {
      const entryTotal = entryFeeSats * estimatedParticipants;
      const entryFee = calculateFee(entryTotal, 'LEAGUES');
      return (entryTotal - entryFee) + (creatorPrizeSats || 0);
    }
    return 0;
  };

  const totalPrizePool = calculatePrizePool();

  // Default distribution: 1st=50%, 2nd=30%, 3rd=20%
  const defaultDistribution = prizeDistribution || { 1: 50, 2: 30, 3: 20 };

  const handleDistributionChange = (position, percentage) => {
    setPrizeDistribution({
      ...defaultDistribution,
      [position]: parseInt(percentage, 10),
    });
  };

  // Calculate payout amounts
  const payouts = {};
  Object.entries(defaultDistribution).forEach(([position, percentage]) => {
    payouts[position] = Math.floor((totalPrizePool * percentage) / 100);
  });

  return (
    <div className="league-prize-pool-section">
      <div className="prize-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={prizePoolEnabled}
            onChange={(e) => setPrizePoolEnabled(e.target.checked)}
          />
          <span className="toggle-text">💰 Enable Bitcoin Prize Pool</span>
          <span className="beta-badge">BETA</span>
        </label>
      </div>

      {prizePoolEnabled && (
        <div className="prize-config">
          <div className="form-group">
            <label>Prize Pool Type</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  value="entry_fees"
                  checked={prizePoolType === 'entry_fees'}
                  onChange={(e) => setPrizePoolType(e.target.value)}
                />
                <div>
                  <strong>Entry Fees</strong>
                  <small>Players pay entry fee → prize pool</small>
                </div>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  value="creator_funded"
                  checked={prizePoolType === 'creator_funded'}
                  onChange={(e) => setPrizePoolType(e.target.value)}
                />
                <div>
                  <strong>Creator Funded</strong>
                  <small>You provide entire prize pool</small>
                </div>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  value="hybrid"
                  checked={prizePoolType === 'hybrid'}
                  onChange={(e) => setPrizePoolType(e.target.value)}
                />
                <div>
                  <strong>Hybrid</strong>
                  <small>Entry fees + your contribution</small>
                </div>
              </label>
            </div>
          </div>

          {(prizePoolType === 'entry_fees' || prizePoolType === 'hybrid') && (
            <div className="form-group">
              <label htmlFor="entry-fee">Entry Fee per Player (sats)</label>
              <input
                id="entry-fee"
                type="number"
                min="1000"
                step="1000"
                value={entryFeeSats}
                onChange={(e) => setEntryFeeSats(parseInt(e.target.value, 10) || 0)}
                placeholder="e.g., 10000"
                className="prize-input"
              />
              <small className="input-help">
                {estimatedParticipants} estimated participants = {formatSats(entryFeeSats * estimatedParticipants)} total
              </small>
            </div>
          )}

          {(prizePoolType === 'creator_funded' || prizePoolType === 'hybrid') && (
            <div className="form-group">
              <label htmlFor="creator-prize">Your Prize Contribution (sats)</label>
              <input
                id="creator-prize"
                type="number"
                min="1000"
                step="1000"
                value={creatorPrizeSats}
                onChange={(e) => setCreatorPrizeSats(parseInt(e.target.value, 10) || 0)}
                placeholder="e.g., 50000"
                className="prize-input"
              />
            </div>
          )}

          {totalPrizePool > 0 && (
            <>
              <div className="prize-pool-summary">
                <h4>Prize Pool Summary</h4>
                {prizePoolType === 'entry_fees' && (
                  <>
                    <div className="summary-row">
                      <span>Total Entry Fees:</span>
                      <span>{formatSats(entryFeeSats * estimatedParticipants)}</span>
                    </div>
                    <div className="summary-row fee">
                      <span>Platform Fee ({platformFeePercent}%):</span>
                      <span>-{formatSats(calculateFee(entryFeeSats * estimatedParticipants, 'LEAGUES'))}</span>
                    </div>
                  </>
                )}
                {prizePoolType === 'creator_funded' && (
                  <div className="summary-row">
                    <span>Your Contribution:</span>
                    <span>{formatSats(creatorPrizeSats)}</span>
                  </div>
                )}
                {prizePoolType === 'hybrid' && (
                  <>
                    <div className="summary-row">
                      <span>Entry Fees (after {platformFeePercent}% fee):</span>
                      <span>{formatSats((entryFeeSats * estimatedParticipants) - calculateFee(entryFeeSats * estimatedParticipants, 'LEAGUES'))}</span>
                    </div>
                    <div className="summary-row">
                      <span>Your Contribution:</span>
                      <span>{formatSats(creatorPrizeSats)}</span>
                    </div>
                  </>
                )}
                <div className="summary-row total">
                  <strong>Total Prize Pool:</strong>
                  <strong className="highlight">{formatSats(totalPrizePool)}</strong>
                </div>
              </div>

              <div className="distribution-section">
                <div className="distribution-header">
                  <h4>Prize Distribution</h4>
                  <button
                    type="button"
                    onClick={() => setShowDistributionEditor(!showDistributionEditor)}
                    className="edit-button"
                  >
                    {showDistributionEditor ? 'Hide' : 'Customize'}
                  </button>
                </div>

                {showDistributionEditor && (
                  <div className="distribution-editor">
                    <div className="editor-row">
                      <label>1st Place (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultDistribution[1] || 50}
                        onChange={(e) => handleDistributionChange(1, e.target.value)}
                      />
                    </div>
                    <div className="editor-row">
                      <label>2nd Place (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultDistribution[2] || 30}
                        onChange={(e) => handleDistributionChange(2, e.target.value)}
                      />
                    </div>
                    <div className="editor-row">
                      <label>3rd Place (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultDistribution[3] || 20}
                        onChange={(e) => handleDistributionChange(3, e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="payout-preview">
                  {Object.entries(payouts).map(([position, amount]) => (
                    <div key={position} className="payout-row">
                      <span>{position === '1' ? '🥇' : position === '2' ? '🥈' : '🥉'} {position}{position === '1' ? 'st' : position === '2' ? 'nd' : 'rd'} Place ({defaultDistribution[position]}%):</span>
                      <strong>{formatSats(amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="escrow-notice">
                <span className="lock-icon">🔒</span>
                <div>
                  <strong>Self-Custodial Escrow</strong>
                  <p>
                    All funds held in ArkadeOS multi-party VTXO. Prize distribution
                    executes automatically when league completes. Proof of Putt never
                    takes custody.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaguePrizePoolSection;
