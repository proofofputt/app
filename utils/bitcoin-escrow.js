/**
 * Bitcoin Escrow Management Service
 *
 * Handles escrow creation and management for Duels, Leagues, and Fundraisers.
 * Uses ArkadeOS VTXOs for self-custodial bitcoin payments with smart contract logic.
 *
 * IMPORTANT: This service is disabled by default. Only enable for testing.
 *
 * Escrow Types:
 * 1. Duels: 2-of-2 multi-sig (both players deposit, winner takes pot)
 * 2. Leagues: N-party escrow (entry fees → prize pool distribution)
 * 3. Fundraisers: Pledge collection (time-locked until campaign ends)
 *
 * Platform Fees:
 * - Duels: 3% of wager amount
 * - Leagues: 5% of entry fee
 * - Fundraisers: 2% of donations
 *
 * @see utils/arkade-service.js for low-level ArkadeOS integration
 */

import { arkadeService, ARKADE_FEATURES_ENABLED } from './arkade-service.js';

/**
 * Escrow Manager
 * Handles all bitcoin escrow operations for competitions and fundraising
 */
export class EscrowManager {
  constructor() {
    this.feePercentages = {
      duel: parseInt(process.env.PLATFORM_FEE_DUELS || '3', 10),
      league: parseInt(process.env.PLATFORM_FEE_LEAGUES || '5', 10),
      fundraiser: parseInt(process.env.PLATFORM_FEE_FUNDRAISING || '2', 10),
    };
  }

  /**
   * Create escrow for a duel with wager
   *
   * @param {number} duelId - Database ID of the duel
   * @param {number} wagerAmountSats - Wager amount per player in satoshis
   * @param {number} player1Id - Creator player ID
   * @param {number} player2Id - Opponent player ID
   * @returns {Promise<object>} Escrow configuration
   */
  async createDuelEscrow(duelId, wagerAmountSats, player1Id, player2Id) {
    if (!ARKADE_FEATURES_ENABLED) {
      console.log('[EscrowManager] Duel escrow disabled (ArkadeOS not enabled)');
      return {
        escrowAddress: null,
        status: 'disabled',
        message: 'Bitcoin payment features are currently disabled',
      };
    }

    try {
      // Initialize ArkadeOS if not already done
      if (!arkadeService.initialized) {
        const initialized = await arkadeService.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize ArkadeOS');
        }
      }

      // Create escrow address
      // TODO: Implement 2-of-2 multi-sig VTXO with:
      // - Collaborative path: Both players sign to release funds to winner
      // - Exit path: Refund after timeout if no winner declared
      // - Platform arbitration: 3rd key for dispute resolution only
      const escrowAddress = await arkadeService.createEscrowAddress();

      if (!escrowAddress) {
        throw new Error('Failed to create escrow address');
      }

      // Calculate fees and amounts
      const platformFee = this.calculateFee(wagerAmountSats, 'duel');
      const totalRequired = wagerAmountSats * 2; // Both players deposit
      const winnerPayout = totalRequired - platformFee;

      console.log('[EscrowManager] Duel escrow created:', {
        duelId,
        escrowAddress,
        wagerPerPlayer: wagerAmountSats,
        totalPot: totalRequired,
        platformFee,
        winnerReceives: winnerPayout,
      });

      return {
        escrowAddress,
        status: 'pending_funding',
        requiredAmount: totalRequired,
        wagerPerPlayer: wagerAmountSats,
        platformFee,
        winnerPayout,
        player1Id,
        player2Id,
        duelId,
      };
    } catch (error) {
      console.error('[EscrowManager] Failed to create duel escrow:', error);
      throw error;
    }
  }

  /**
   * Create escrow for a league with entry fees
   *
   * @param {number} leagueId - Database ID of the league
   * @param {number} entryFeeSats - Entry fee per player in satoshis
   * @param {Array<number>} participantIds - Array of player IDs
   * @param {object} prizeDistribution - Prize distribution config (e.g., {1: 50, 2: 30, 3: 20})
   * @returns {Promise<object>} Escrow configuration
   */
  async createLeagueEscrow(leagueId, entryFeeSats, participantIds, prizeDistribution = null) {
    if (!ARKADE_FEATURES_ENABLED) {
      console.log('[EscrowManager] League escrow disabled (ArkadeOS not enabled)');
      return {
        escrowAddress: null,
        status: 'disabled',
        message: 'Bitcoin payment features are currently disabled',
      };
    }

    try {
      // Initialize ArkadeOS if not already done
      if (!arkadeService.initialized) {
        await arkadeService.initialize();
      }

      // Create escrow address
      // TODO: Implement N-party VTXO with:
      // - Collaborative path: All participants agree on final standings
      // - Exit path: Refund if league cancelled
      // - Smart contract: Automatic prize distribution based on final standings
      const escrowAddress = await arkadeService.createEscrowAddress();

      if (!escrowAddress) {
        throw new Error('Failed to create escrow address');
      }

      // Calculate fees and prize pool
      const platformFee = this.calculateFee(entryFeeSats * participantIds.length, 'league');
      const totalCollected = entryFeeSats * participantIds.length;
      const prizePool = totalCollected - platformFee;

      // Default prize distribution if not provided: 50% / 30% / 20%
      const distribution = prizeDistribution || { 1: 50, 2: 30, 3: 20 };

      // Calculate actual payout amounts
      const payouts = {};
      Object.entries(distribution).forEach(([position, percentage]) => {
        payouts[position] = Math.floor((prizePool * percentage) / 100);
      });

      console.log('[EscrowManager] League escrow created:', {
        leagueId,
        escrowAddress,
        entryFee: entryFeeSats,
        participants: participantIds.length,
        totalCollected,
        platformFee,
        prizePool,
        distribution: payouts,
      });

      return {
        escrowAddress,
        status: 'pending_funding',
        requiredAmount: totalCollected,
        entryFee: entryFeeSats,
        participantCount: participantIds.length,
        platformFee,
        prizePool,
        distribution: payouts,
        participantIds,
        leagueId,
      };
    } catch (error) {
      console.error('[EscrowManager] Failed to create league escrow:', error);
      throw error;
    }
  }

  /**
   * Create pledge tracking for fundraiser
   *
   * @param {number} fundraiserId - Database ID of the fundraiser
   * @param {number} pledgerId - Player ID making the pledge
   * @param {number} amountPerPuttSats - Amount per putt in satoshis
   * @param {number} maxDonationSats - Maximum donation cap (optional)
   * @returns {Promise<object>} Pledge configuration
   */
  async createFundraiserPledge(fundraiserId, pledgerId, amountPerPuttSats, maxDonationSats = null) {
    if (!ARKADE_FEATURES_ENABLED) {
      console.log('[EscrowManager] Fundraiser pledge disabled (ArkadeOS not enabled)');
      return {
        pledgeAddress: null,
        status: 'disabled',
        message: 'Bitcoin payment features are currently disabled',
      };
    }

    try {
      // Initialize ArkadeOS if not already done
      if (!arkadeService.initialized) {
        await arkadeService.initialize();
      }

      // Create pledge address
      // TODO: Implement time-locked VTXO with:
      // - Funds locked until campaign ends
      // - Calculate final amount: total_putts * amount_per_putt (capped at max)
      // - Automatic release to fundraiser organizer
      const pledgeAddress = await arkadeService.createEscrowAddress();

      if (!pledgeAddress) {
        throw new Error('Failed to create pledge address');
      }

      console.log('[EscrowManager] Fundraiser pledge created:', {
        fundraiserId,
        pledgerId,
        pledgeAddress,
        amountPerPutt: amountPerPuttSats,
        maxDonation: maxDonationSats,
      });

      return {
        pledgeAddress,
        status: 'pending',
        amountPerPutt: amountPerPuttSats,
        maxDonation: maxDonationSats,
        platformFee: this.feePercentages.fundraiser,
        fundraiserId,
        pledgerId,
      };
    } catch (error) {
      console.error('[EscrowManager] Failed to create fundraiser pledge:', error);
      throw error;
    }
  }

  /**
   * Calculate platform fee for a transaction
   *
   * @param {number} amountSats - Amount in satoshis
   * @param {string} type - Transaction type ('duel', 'league', or 'fundraiser')
   * @returns {number} Fee amount in satoshis
   */
  calculateFee(amountSats, type) {
    const feePercent = this.feePercentages[type] || this.feePercentages.duel;
    return Math.floor((amountSats * feePercent) / 100);
  }

  /**
   * Check if escrow has been funded
   *
   * @param {string} escrowAddress - Escrow address to check
   * @param {number} expectedAmount - Expected amount in satoshis
   * @returns {Promise<object>} Funding status
   */
  async checkEscrowFunding(escrowAddress, expectedAmount) {
    if (!ARKADE_FEATURES_ENABLED) {
      return { funded: false, balance: 0, message: 'ArkadeOS not enabled' };
    }

    try {
      const balance = await arkadeService.checkBalance(escrowAddress);
      const funded = balance >= expectedAmount;

      return {
        funded,
        balance,
        expectedAmount,
        shortfall: funded ? 0 : expectedAmount - balance,
      };
    } catch (error) {
      console.error('[EscrowManager] Failed to check funding:', error);
      return { funded: false, balance: 0, error: error.message };
    }
  }

  /**
   * Release duel escrow to winner
   *
   * @param {string} escrowAddress - Escrow address
   * @param {number} winnerId - Player ID of the winner
   * @param {number} winnerPayout - Amount to pay winner (after fees)
   * @returns {Promise<object>} Release transaction result
   */
  async releaseDuelEscrow(escrowAddress, winnerId, winnerPayout) {
    if (!ARKADE_FEATURES_ENABLED) {
      throw new Error('ArkadeOS not enabled');
    }

    try {
      // TODO: Implement escrow release with Arkade Script
      // 1. Verify escrow is fully funded
      // 2. Get winner's bitcoin address
      // 3. Create payout VTXO
      // 4. Platform receives fee
      // 5. Winner receives payout

      throw new Error('Escrow release not yet implemented - requires Arkade Script integration');
    } catch (error) {
      console.error('[EscrowManager] Failed to release duel escrow:', error);
      throw error;
    }
  }

  /**
   * Release league escrow with prize distribution
   *
   * @param {string} escrowAddress - Escrow address
   * @param {Array<{playerId: number, position: number, amount: number}>} payouts - Prize distribution
   * @returns {Promise<object>} Release transaction result
   */
  async releaseLeagueEscrow(escrowAddress, payouts) {
    if (!ARKADE_FEATURES_ENABLED) {
      throw new Error('ArkadeOS not enabled');
    }

    try {
      // TODO: Implement multi-payout escrow release
      // 1. Verify escrow is fully funded
      // 2. Get bitcoin addresses for all winners
      // 3. Create payout VTXOs for each position
      // 4. Platform receives fee
      // 5. Winners receive payouts

      throw new Error('League escrow release not yet implemented - requires Arkade Script integration');
    } catch (error) {
      console.error('[EscrowManager] Failed to release league escrow:', error);
      throw error;
    }
  }

  /**
   * Get escrow manager status
   *
   * @returns {object} Service status
   */
  getStatus() {
    return {
      enabled: ARKADE_FEATURES_ENABLED,
      feePercentages: this.feePercentages,
      arkadeServiceStatus: arkadeService.getStatus(),
    };
  }
}

// Export singleton instance
export const escrowManager = new EscrowManager();
