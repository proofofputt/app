-- ============================================================================
-- Add Admin Tracking Columns to user_gift_subscriptions
-- ============================================================================
-- Adds columns to track when gift codes are manually granted by admins
-- Required for manual gift code generation feature
-- ============================================================================

-- Add columns for admin grant tracking
ALTER TABLE user_gift_subscriptions
ADD COLUMN IF NOT EXISTS granted_by_admin_id INTEGER REFERENCES players(player_id),
ADD COLUMN IF NOT EXISTS grant_reason TEXT,
ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP;

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_granted_by ON user_gift_subscriptions(granted_by_admin_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
