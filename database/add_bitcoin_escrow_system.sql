-- ============================================================================
-- Bitcoin Escrow System Database Schema
-- ============================================================================
--
-- ⚠️  CRITICAL WARNING ⚠️
-- This migration is FOR TESTING ONLY on the feature/bitcoin-payment-integration branch
-- DO NOT apply to production database until:
--   1. ArkadeOS integration is complete and tested
--   2. Full security audit is performed
--   3. Legal/regulatory compliance is verified
--   4. Feature rollout plan is approved
--
-- This schema adds bitcoin payment capabilities to:
--   - Duels (wagers)
--   - Leagues (entry fees and prize pools)
--   - Fundraisers (pledge-per-putt donations)
--
-- Uses ArkadeOS VTXOs for self-custodial escrow
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DUELS - Add Wager Support
-- ============================================================================

-- Add wager-related columns to duels table
ALTER TABLE duels ADD COLUMN IF NOT EXISTS wager_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS wager_amount_sats BIGINT CHECK (wager_amount_sats IS NULL OR wager_amount_sats > 0);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS escrow_address VARCHAR(255);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(50) DEFAULT 'none'
  CHECK (escrow_status IN ('none', 'pending_funding', 'partially_funded', 'funded', 'released', 'refunded'));
ALTER TABLE duels ADD COLUMN IF NOT EXISTS winner_payout_tx VARCHAR(255);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS platform_fee_sats BIGINT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS escrow_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS escrow_funded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN duels.wager_enabled IS 'Whether this duel has a bitcoin wager';
COMMENT ON COLUMN duels.wager_amount_sats IS 'Wager amount per player in satoshis';
COMMENT ON COLUMN duels.escrow_address IS 'ArkadeOS VTXO escrow address';
COMMENT ON COLUMN duels.escrow_status IS 'Current status of escrow funding and release';
COMMENT ON COLUMN duels.winner_payout_tx IS 'Transaction hash of winner payout';
COMMENT ON COLUMN duels.platform_fee_sats IS 'Platform fee in satoshis (typically 3%)';

-- ============================================================================
-- 2. LEAGUES - Add Entry Fee and Prize Pool Support
-- ============================================================================

-- Add prize pool columns to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS entry_fee_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS entry_fee_sats BIGINT CHECK (entry_fee_sats IS NULL OR entry_fee_sats > 0);
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS prize_pool_type VARCHAR(50) DEFAULT 'none'
  CHECK (prize_pool_type IN ('none', 'entry_fees', 'creator_funded', 'hybrid'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS creator_prize_pool_sats BIGINT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS escrow_address VARCHAR(255);
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(50) DEFAULT 'none'
  CHECK (escrow_status IN ('none', 'pending_funding', 'partially_funded', 'funded', 'released', 'refunded'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS payout_distribution JSONB;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS platform_fee_sats BIGINT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS escrow_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS escrow_funded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN leagues.entry_fee_enabled IS 'Whether this league requires bitcoin entry fee';
COMMENT ON COLUMN leagues.entry_fee_sats IS 'Entry fee per player in satoshis';
COMMENT ON COLUMN leagues.prize_pool_type IS 'How prize pool is funded (entry_fees, creator_funded, or hybrid)';
COMMENT ON COLUMN leagues.creator_prize_pool_sats IS 'Creator-provided prize pool amount';
COMMENT ON COLUMN leagues.escrow_address IS 'ArkadeOS VTXO escrow address for prize pool';
COMMENT ON COLUMN leagues.payout_distribution IS 'Prize distribution as JSON (e.g., {"1": 50, "2": 30, "3": 20} for percentages)';
COMMENT ON COLUMN leagues.platform_fee_sats IS 'Platform fee in satoshis (typically 5%)';

-- ============================================================================
-- 3. LEAGUE PARTICIPANTS - Track Entry Fee Payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS league_escrow_participants (
  participant_id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  entry_fee_paid BOOLEAN DEFAULT FALSE,
  entry_fee_tx_hash VARCHAR(255),
  entry_fee_paid_at TIMESTAMP WITH TIME ZONE,
  payout_amount_sats BIGINT,
  payout_tx_hash VARCHAR(255),
  payout_released_at TIMESTAMP WITH TIME ZONE,
  final_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

COMMENT ON TABLE league_escrow_participants IS 'Tracks bitcoin entry fee payments and prize payouts for league participants';
COMMENT ON COLUMN league_escrow_participants.entry_fee_paid IS 'Whether player has paid entry fee to escrow';
COMMENT ON COLUMN league_escrow_participants.payout_amount_sats IS 'Prize payout amount based on final position';
COMMENT ON COLUMN league_escrow_participants.final_position IS 'Player final position in league (1st, 2nd, 3rd, etc.)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_league_escrow_participants_league ON league_escrow_participants(league_id);
CREATE INDEX IF NOT EXISTS idx_league_escrow_participants_player ON league_escrow_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_league_escrow_participants_paid ON league_escrow_participants(entry_fee_paid) WHERE entry_fee_paid = TRUE;

-- ============================================================================
-- 4. FUNDRAISER PLEDGES - Track Pledge-Per-Putt Donations
-- ============================================================================

CREATE TABLE IF NOT EXISTS fundraiser_pledges (
  pledge_id SERIAL PRIMARY KEY,
  fundraiser_id INTEGER NOT NULL REFERENCES fundraisers(fundraiser_id) ON DELETE CASCADE,
  pledger_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  amount_per_putt_sats BIGINT NOT NULL CHECK (amount_per_putt_sats > 0),
  max_donation_sats BIGINT CHECK (max_donation_sats IS NULL OR max_donation_sats >= amount_per_putt_sats),
  pledge_address VARCHAR(255),
  payment_status VARCHAR(50) DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'invoice_sent', 'paid', 'failed', 'cancelled')),
  total_putts_made INTEGER DEFAULT 0,
  final_amount_sats BIGINT,
  payment_tx_hash VARCHAR(255),
  pledge_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invoice_sent_at TIMESTAMP WITH TIME ZONE,
  payment_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fundraiser_id, pledger_player_id)
);

COMMENT ON TABLE fundraiser_pledges IS 'Tracks pledge-per-putt donations for fundraising campaigns';
COMMENT ON COLUMN fundraiser_pledges.amount_per_putt_sats IS 'Amount pledged per successful putt in satoshis';
COMMENT ON COLUMN fundraiser_pledges.max_donation_sats IS 'Optional maximum donation cap';
COMMENT ON COLUMN fundraiser_pledges.pledge_address IS 'ArkadeOS address for pledge payment';
COMMENT ON COLUMN fundraiser_pledges.total_putts_made IS 'Total putts made during campaign period';
COMMENT ON COLUMN fundraiser_pledges.final_amount_sats IS 'Final calculated amount: putts * amount_per_putt (capped at max)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fundraiser_pledges_fundraiser ON fundraiser_pledges(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_fundraiser_pledges_pledger ON fundraiser_pledges(pledger_player_id);
CREATE INDEX IF NOT EXISTS idx_fundraiser_pledges_status ON fundraiser_pledges(payment_status);

-- ============================================================================
-- 5. BITCOIN TRANSACTIONS - Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS bitcoin_transactions (
  transaction_id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('duel', 'league', 'fundraiser', 'pledge')),
  entity_id INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL
    CHECK (transaction_type IN ('escrow_funding', 'payout', 'refund', 'platform_fee', 'pledge_payment')),
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  tx_hash VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmations INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE bitcoin_transactions IS 'Comprehensive audit log of all bitcoin transactions';
COMMENT ON COLUMN bitcoin_transactions.entity_type IS 'Type of entity (duel, league, fundraiser, pledge)';
COMMENT ON COLUMN bitcoin_transactions.entity_id IS 'ID of the entity in its respective table';
COMMENT ON COLUMN bitcoin_transactions.transaction_type IS 'Type of transaction (funding, payout, refund, etc.)';
COMMENT ON COLUMN bitcoin_transactions.tx_hash IS 'Bitcoin transaction hash (unique)';
COMMENT ON COLUMN bitcoin_transactions.confirmations IS 'Number of blockchain confirmations';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bitcoin_transactions_entity ON bitcoin_transactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_bitcoin_transactions_status ON bitcoin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bitcoin_transactions_type ON bitcoin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_bitcoin_transactions_created ON bitcoin_transactions(created_at DESC);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate final pledge amount
CREATE OR REPLACE FUNCTION calculate_pledge_amount(
  putts INTEGER,
  amount_per_putt BIGINT,
  max_donation BIGINT
) RETURNS BIGINT AS $$
BEGIN
  IF max_donation IS NULL THEN
    RETURN putts * amount_per_putt;
  ELSE
    RETURN LEAST(putts * amount_per_putt, max_donation);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_pledge_amount IS 'Calculate final pledge amount with optional cap';

-- Function to get escrow funding status
CREATE OR REPLACE FUNCTION get_escrow_status_summary()
RETURNS TABLE (
  entity_type VARCHAR(50),
  total_escrows BIGINT,
  pending_funding BIGINT,
  fully_funded BIGINT,
  released BIGINT,
  total_value_sats BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'duel'::VARCHAR(50),
    COUNT(*),
    COUNT(*) FILTER (WHERE escrow_status = 'pending_funding'),
    COUNT(*) FILTER (WHERE escrow_status = 'funded'),
    COUNT(*) FILTER (WHERE escrow_status = 'released'),
    COALESCE(SUM(wager_amount_sats * 2), 0)
  FROM duels WHERE wager_enabled = TRUE

  UNION ALL

  SELECT
    'league'::VARCHAR(50),
    COUNT(*),
    COUNT(*) FILTER (WHERE escrow_status = 'pending_funding'),
    COUNT(*) FILTER (WHERE escrow_status = 'funded'),
    COUNT(*) FILTER (WHERE escrow_status = 'released'),
    COALESCE(SUM(entry_fee_sats), 0)
  FROM leagues WHERE entry_fee_enabled = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_escrow_status_summary IS 'Get summary of all escrow statuses across duels and leagues';

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Tables created/modified:
--   - duels (added wager columns)
--   - leagues (added entry fee and prize pool columns)
--   - league_escrow_participants (new)
--   - fundraiser_pledges (new)
--   - bitcoin_transactions (new)
--
-- Remember: This is for TESTING ONLY
-- ============================================================================
