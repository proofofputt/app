-- Zaprite Subscription Integration Schema
-- Adds support for Bitcoin/Lightning/Card payments via Zaprite

-- Add Zaprite subscription tracking fields to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS zaprite_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zaprite_payment_method VARCHAR(50), -- 'bitcoin', 'lightning', 'card'
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_billing_cycle VARCHAR(20); -- 'monthly', 'annual'

-- Create indexes for Zaprite fields
CREATE INDEX IF NOT EXISTS idx_players_zaprite_customer ON players(zaprite_customer_id) WHERE zaprite_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_zaprite_subscription ON players(zaprite_subscription_id) WHERE zaprite_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_subscription_period ON players(subscription_current_period_end) WHERE subscription_status = 'active';

-- Zaprite webhook events audit trail
CREATE TABLE IF NOT EXISTS zaprite_events (
    event_id BIGSERIAL PRIMARY KEY,

    -- Event identification
    zaprite_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'order.paid', 'subscription.created', 'subscription.renewed', etc.

    -- Related entities
    player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
    zaprite_customer_id VARCHAR(255),
    zaprite_subscription_id VARCHAR(255),
    zaprite_order_id VARCHAR(255),

    -- Event data
    event_data JSONB NOT NULL, -- Full webhook payload

    -- Payment details (extracted from event_data for quick queries)
    payment_amount DECIMAL(10, 2),
    payment_currency VARCHAR(10),
    payment_method VARCHAR(50),

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for zaprite_events
CREATE INDEX IF NOT EXISTS idx_zaprite_events_type ON zaprite_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zaprite_events_player ON zaprite_events(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_customer ON zaprite_events(zaprite_customer_id) WHERE zaprite_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_subscription ON zaprite_events(zaprite_subscription_id) WHERE zaprite_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_processed ON zaprite_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_zaprite_events_received ON zaprite_events(received_at DESC);

-- Function to update subscription from Zaprite event
CREATE OR REPLACE FUNCTION process_zaprite_subscription_event(
    p_event_id BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_event RECORD;
    v_player_id INTEGER;
    v_subscription_data JSONB;
    v_result JSONB;
BEGIN
    -- Get event details
    SELECT * INTO v_event
    FROM zaprite_events
    WHERE event_id = p_event_id;

    IF v_event IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Event not found');
    END IF;

    -- Extract subscription data from event
    v_subscription_data := v_event.event_data;

    -- Find or create player based on email from Zaprite event
    -- This assumes Zaprite event includes customer email
    -- You'll need to adjust based on actual Zaprite event structure

    CASE v_event.event_type
        WHEN 'order.paid' THEN
            -- Activate subscription on successful payment
            UPDATE players
            SET
                zaprite_customer_id = v_event.zaprite_customer_id,
                zaprite_subscription_id = v_event.zaprite_subscription_id,
                subscription_status = 'active',
                subscription_started_at = COALESCE(subscription_started_at, NOW()),
                subscription_current_period_start = NOW(),
                subscription_current_period_end = NOW() + INTERVAL '1 month', -- Adjust based on billing cycle
                zaprite_payment_method = v_event.payment_method,
                updated_at = NOW()
            WHERE player_id = v_event.player_id;

        WHEN 'subscription.created' THEN
            -- Log subscription creation
            UPDATE players
            SET
                zaprite_subscription_id = v_event.zaprite_subscription_id,
                subscription_started_at = NOW(),
                updated_at = NOW()
            WHERE player_id = v_event.player_id;

        WHEN 'subscription.renewed' THEN
            -- Extend subscription period
            UPDATE players
            SET
                subscription_current_period_start = subscription_current_period_end,
                subscription_current_period_end = subscription_current_period_end + INTERVAL '1 month', -- Adjust based on billing cycle
                subscription_cancel_at_period_end = FALSE,
                updated_at = NOW()
            WHERE player_id = v_event.player_id;

        WHEN 'subscription.canceled' THEN
            -- Mark for cancellation at period end
            UPDATE players
            SET
                subscription_cancel_at_period_end = TRUE,
                updated_at = NOW()
            WHERE player_id = v_event.player_id;

        WHEN 'subscription.expired' THEN
            -- Deactivate subscription
            UPDATE players
            SET
                subscription_status = 'canceled',
                subscription_tier = NULL,
                updated_at = NOW()
            WHERE player_id = v_event.player_id;

        ELSE
            -- Unknown event type, log but don't fail
            NULL;
    END CASE;

    -- Mark event as processed
    UPDATE zaprite_events
    SET processed = TRUE,
        processed_at = NOW()
    WHERE event_id = p_event_id;

    v_result := jsonb_build_object(
        'success', TRUE,
        'event_type', v_event.event_type,
        'player_id', v_event.player_id
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Log error
    UPDATE zaprite_events
    SET processing_error = SQLERRM,
        retry_count = retry_count + 1
    WHERE event_id = p_event_id;

    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire subscriptions (run daily via cron)
CREATE OR REPLACE FUNCTION expire_zaprite_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark expired subscriptions as canceled
    UPDATE players
    SET
        subscription_status = 'canceled',
        subscription_tier = NULL,
        updated_at = NOW()
    WHERE subscription_status = 'active'
      AND subscription_current_period_end < NOW()
      AND NOT subscription_cancel_at_period_end; -- Don't double-process

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE zaprite_events IS 'Audit trail of all Zaprite webhook events';
COMMENT ON COLUMN players.zaprite_customer_id IS 'Zaprite customer ID for this player';
COMMENT ON COLUMN players.zaprite_subscription_id IS 'Active Zaprite subscription ID';
COMMENT ON COLUMN players.zaprite_payment_method IS 'Payment method: bitcoin, lightning, or card';
COMMENT ON COLUMN players.subscription_billing_cycle IS 'Billing frequency: monthly or annual';
COMMENT ON FUNCTION process_zaprite_subscription_event IS 'Processes a Zaprite webhook event and updates player subscription';
COMMENT ON FUNCTION expire_zaprite_subscriptions IS 'Expires subscriptions past their period end date';
