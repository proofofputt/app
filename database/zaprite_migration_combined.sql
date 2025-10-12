-- Combined Zaprite Migration
-- Fixes table name mismatch between webhook handler and schema
-- Date: October 9, 2025

-- Add Zaprite subscription tracking fields to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS zaprite_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_payment_method VARCHAR(50), -- 'bitcoin', 'lightning', 'card'
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50), -- 'basic', 'premium', 'full_subscriber'
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_billing_cycle VARCHAR(20); -- 'monthly', 'annual'

-- Create indexes for Zaprite fields
CREATE INDEX IF NOT EXISTS idx_players_zaprite_customer ON players(zaprite_customer_id) WHERE zaprite_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_zaprite_subscription ON players(zaprite_subscription_id) WHERE zaprite_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_subscription_period ON players(subscription_current_period_end) WHERE subscription_status = 'active';

-- Zaprite webhook events table (used by webhook handler)
CREATE TABLE IF NOT EXISTS zaprite_events (
    event_id BIGSERIAL PRIMARY KEY,
    zaprite_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
    zaprite_customer_id VARCHAR(255),
    zaprite_subscription_id VARCHAR(255),
    zaprite_order_id VARCHAR(255),
    event_data JSONB NOT NULL,
    payment_amount DECIMAL(10, 2),
    payment_currency VARCHAR(10),
    payment_method VARCHAR(50),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for zaprite_events
CREATE INDEX IF NOT EXISTS idx_zaprite_events_player ON zaprite_events(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_type ON zaprite_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_zaprite_id ON zaprite_events(zaprite_event_id);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_processed ON zaprite_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_created ON zaprite_events(created_at DESC);

-- Subscription bundles table
CREATE TABLE IF NOT EXISTS subscription_bundles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User gift subscriptions table
CREATE TABLE IF NOT EXISTS user_gift_subscriptions (
    id SERIAL PRIMARY KEY,
    owner_user_id INT REFERENCES players(player_id) NOT NULL,
    bundle_id INT REFERENCES subscription_bundles(id), -- Can be null for single gifts
    gift_code VARCHAR(255) UNIQUE NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_user_id INT REFERENCES players(player_id),
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for gift subscriptions
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_owner ON user_gift_subscriptions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_code ON user_gift_subscriptions(gift_code);
CREATE INDEX IF NOT EXISTS idx_user_gift_subscriptions_redeemed ON user_gift_subscriptions(is_redeemed);

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

-- Comments for documentation
COMMENT ON TABLE zaprite_events IS 'Zaprite webhook events processed by webhook handler';
COMMENT ON TABLE subscription_bundles IS 'Pre-configured subscription bundle pricing';
COMMENT ON TABLE user_gift_subscriptions IS 'Gift subscription codes for sharing annual subscriptions';
COMMENT ON COLUMN players.zaprite_customer_id IS 'Zaprite customer ID for this player';
COMMENT ON COLUMN players.zaprite_subscription_id IS 'Active Zaprite subscription ID';
COMMENT ON COLUMN players.zaprite_payment_method IS 'Payment method: bitcoin, lightning, or card';
COMMENT ON COLUMN players.subscription_tier IS 'Subscription tier: basic, premium, or full_subscriber';
COMMENT ON COLUMN players.subscription_billing_cycle IS 'Billing frequency: monthly or annual';
