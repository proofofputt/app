-- Subscription Bundling & Gifting Feature Migration
-- Date: 2025-10-04
-- Description: Adds tables for subscription bundles and gift subscriptions

-- Create subscription_bundles table
CREATE TABLE IF NOT EXISTS subscription_bundles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_gift_subscriptions table
CREATE TABLE IF NOT EXISTS user_gift_subscriptions (
    id SERIAL PRIMARY KEY,
    owner_user_id INT REFERENCES players(player_id) NOT NULL,
    bundle_id INT REFERENCES subscription_bundles(id), -- Can be null for single gifts like the intro offer
    gift_code VARCHAR(255) UNIQUE NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_user_id INT REFERENCES players(player_id),
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription status columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Insert default subscription bundles
INSERT INTO subscription_bundles (name, quantity, discount_percentage) VALUES
('3-Pack', 3, 10.00),
('5-Pack', 5, 20.00),
('10-Pack', 10, 42.00),
('21-Pack', 21, 50.00)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_owner ON user_gift_subscriptions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_code ON user_gift_subscriptions(gift_code);
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_redeemed ON user_gift_subscriptions(is_redeemed);
