-- Add columns to support custom labeled gift codes for partnerships and beta testing
-- This allows admins to generate gift codes with memorable identifiers

ALTER TABLE user_gift_subscriptions
ADD COLUMN IF NOT EXISTS custom_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS granted_by_admin_id INT REFERENCES players(player_id),
ADD COLUMN IF NOT EXISTS grant_reason VARCHAR(500),
ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups by custom label
CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_custom_label
ON user_gift_subscriptions(custom_label);

-- Add comments for clarity
COMMENT ON COLUMN user_gift_subscriptions.custom_label IS 'Custom identifier for partnership/beta test gift codes (e.g., "BETA-TESTER-2025", "PARTNERSHIP-CLUBXYZ")';
COMMENT ON COLUMN user_gift_subscriptions.granted_by_admin_id IS 'Admin user who manually granted this gift code';
COMMENT ON COLUMN user_gift_subscriptions.grant_reason IS 'Reason for granting (e.g., "Beta testing agreement with Club XYZ")';
COMMENT ON COLUMN user_gift_subscriptions.granted_at IS 'Timestamp when admin granted this code';
