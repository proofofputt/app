-- ============================================================================
-- Bitcoin Escrow System - ROLLBACK SCRIPT
-- ============================================================================
-- Use this to remove all bitcoin escrow changes if needed
-- ============================================================================

BEGIN;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS bitcoin_transactions CASCADE;
DROP TABLE IF EXISTS fundraiser_pledges CASCADE;
DROP TABLE IF NOT EXISTS league_escrow_participants CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_escrow_status_summary();
DROP FUNCTION IF EXISTS calculate_pledge_amount(INTEGER, BIGINT, BIGINT);

-- Remove columns from leagues
ALTER TABLE leagues DROP COLUMN IF EXISTS escrow_released_at;
ALTER TABLE leagues DROP COLUMN IF EXISTS escrow_funded_at;
ALTER TABLE leagues DROP COLUMN IF EXISTS escrow_created_at;
ALTER TABLE leagues DROP COLUMN IF EXISTS platform_fee_sats;
ALTER TABLE leagues DROP COLUMN IF EXISTS payout_distribution;
ALTER TABLE leagues DROP COLUMN IF EXISTS escrow_status;
ALTER TABLE leagues DROP COLUMN IF EXISTS escrow_address;
ALTER TABLE leagues DROP COLUMN IF EXISTS creator_prize_pool_sats;
ALTER TABLE leagues DROP COLUMN IF EXISTS prize_pool_type;
ALTER TABLE leagues DROP COLUMN IF EXISTS entry_fee_sats;
ALTER TABLE leagues DROP COLUMN IF EXISTS entry_fee_enabled;

-- Remove columns from duels
ALTER TABLE duels DROP COLUMN IF EXISTS escrow_released_at;
ALTER TABLE duels DROP COLUMN IF EXISTS escrow_funded_at;
ALTER TABLE duels DROP COLUMN IF EXISTS escrow_created_at;
ALTER TABLE duels DROP COLUMN IF EXISTS platform_fee_sats;
ALTER TABLE duels DROP COLUMN IF EXISTS winner_payout_tx;
ALTER TABLE duels DROP COLUMN IF EXISTS escrow_status;
ALTER TABLE duels DROP COLUMN IF EXISTS escrow_address;
ALTER TABLE duels DROP COLUMN IF EXISTS wager_amount_sats;
ALTER TABLE duels DROP COLUMN IF EXISTS wager_enabled;

COMMIT;

-- ============================================================================
-- Rollback Complete
-- ============================================================================
