-- Admin Roles and Permissions System
-- Adds support for admin and customer support roles with ability to grant subscriptions

-- Add admin role columns to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50), -- 'main_admin', 'customer_support', NULL
ADD COLUMN IF NOT EXISTS admin_granted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_granted_by INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '{}';

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_players_admin_role ON players(admin_role) WHERE admin_role IS NOT NULL;

-- Admin activity audit log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    activity_id BIGSERIAL PRIMARY KEY,

    -- Admin who performed the action
    admin_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    admin_role VARCHAR(50) NOT NULL,

    -- Action details
    action_type VARCHAR(100) NOT NULL, -- 'grant_subscription', 'grant_bundle', 'revoke_subscription', etc.
    target_player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
    target_email VARCHAR(255),

    -- Action data
    action_data JSONB NOT NULL, -- Detailed information about what was granted/modified

    -- Reason for action
    reason TEXT,
    notes TEXT,

    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- 'completed', 'failed', 'pending'
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for admin activity log
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_target ON admin_activity_log(target_player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_type ON admin_activity_log(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_date ON admin_activity_log(created_at DESC);

-- Admin granted subscriptions tracking
-- Tracks subscriptions that were manually granted by admins (vs purchased)
CREATE TABLE IF NOT EXISTS admin_granted_subscriptions (
    grant_id BIGSERIAL PRIMARY KEY,

    -- Who granted it
    granted_by_admin_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    granted_to_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,

    -- What was granted
    subscription_type VARCHAR(50) NOT NULL, -- 'monthly', 'annual', 'lifetime'
    duration_months INTEGER, -- NULL for lifetime

    -- Why it was granted
    reason TEXT NOT NULL,
    notes TEXT,

    -- When
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by_admin_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
    revoke_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for granted subscriptions
CREATE INDEX IF NOT EXISTS idx_granted_subs_player ON admin_granted_subscriptions(granted_to_player_id, is_active);
CREATE INDEX IF NOT EXISTS idx_granted_subs_admin ON admin_granted_subscriptions(granted_by_admin_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_granted_subs_active ON admin_granted_subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_granted_subs_expiry ON admin_granted_subscriptions(expires_at) WHERE is_active = TRUE AND expires_at IS NOT NULL;

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(p_player_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM players
        WHERE player_id = p_player_id
        AND admin_role IN ('main_admin', 'customer_support')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user has a specific admin role
CREATE OR REPLACE FUNCTION has_admin_role(p_player_id INTEGER, p_role VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM players
        WHERE player_id = p_player_id
        AND admin_role = p_role
    );
END;
$$ LANGUAGE plpgsql;

-- Function to grant admin role (only main_admin can grant)
CREATE OR REPLACE FUNCTION grant_admin_role(
    p_target_player_id INTEGER,
    p_role VARCHAR,
    p_granted_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Check if granter is main_admin
    IF NOT has_admin_role(p_granted_by, 'main_admin') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Only main_admin can grant admin roles'
        );
    END IF;

    -- Validate role
    IF p_role NOT IN ('main_admin', 'customer_support') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid role. Must be main_admin or customer_support'
        );
    END IF;

    -- Grant the role
    UPDATE players
    SET
        admin_role = p_role,
        admin_granted_at = NOW(),
        admin_granted_by = p_granted_by,
        admin_permissions = jsonb_build_object(
            'can_grant_subscriptions', TRUE,
            'can_grant_bundles', TRUE,
            'can_view_users', TRUE,
            'can_view_activity_log', TRUE,
            'can_grant_admin_roles', CASE WHEN p_role = 'main_admin' THEN TRUE ELSE FALSE END
        ),
        updated_at = NOW()
    WHERE player_id = p_target_player_id;

    -- Log the action
    INSERT INTO admin_activity_log (
        admin_player_id,
        admin_role,
        action_type,
        target_player_id,
        action_data,
        reason,
        status
    ) VALUES (
        p_granted_by,
        'main_admin',
        'grant_admin_role',
        p_target_player_id,
        jsonb_build_object('role', p_role),
        'Admin role granted',
        'completed'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'role', p_role,
        'player_id', p_target_player_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to grant subscription by admin
CREATE OR REPLACE FUNCTION admin_grant_subscription(
    p_admin_id INTEGER,
    p_target_player_id INTEGER,
    p_subscription_type VARCHAR,
    p_duration_months INTEGER,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_grant_id BIGINT;
    v_result JSONB;
BEGIN
    -- Check if granter is admin
    IF NOT is_admin(p_admin_id) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'User is not an admin'
        );
    END IF;

    -- Calculate expiration
    IF p_subscription_type = 'lifetime' THEN
        v_expires_at := NULL;
    ELSE
        v_expires_at := NOW() + (p_duration_months || ' months')::INTERVAL;
    END IF;

    -- Create grant record
    INSERT INTO admin_granted_subscriptions (
        granted_by_admin_id,
        granted_to_player_id,
        subscription_type,
        duration_months,
        reason,
        expires_at,
        is_active
    ) VALUES (
        p_admin_id,
        p_target_player_id,
        p_subscription_type,
        p_duration_months,
        p_reason,
        v_expires_at,
        TRUE
    ) RETURNING grant_id INTO v_grant_id;

    -- Update player subscription status
    UPDATE players
    SET
        subscription_status = 'active',
        subscription_tier = 'full_subscriber',
        is_subscribed = TRUE,
        subscription_started_at = COALESCE(subscription_started_at, NOW()),
        subscription_current_period_start = NOW(),
        subscription_current_period_end = v_expires_at,
        updated_at = NOW()
    WHERE player_id = p_target_player_id;

    -- Log the action
    INSERT INTO admin_activity_log (
        admin_player_id,
        admin_role,
        action_type,
        target_player_id,
        action_data,
        reason,
        status
    ) SELECT
        p_admin_id,
        admin_role,
        'grant_subscription',
        p_target_player_id,
        jsonb_build_object(
            'grant_id', v_grant_id,
            'subscription_type', p_subscription_type,
            'duration_months', p_duration_months,
            'expires_at', v_expires_at
        ),
        p_reason,
        'completed'
    FROM players WHERE player_id = p_admin_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'grant_id', v_grant_id,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get admin activity summary
CREATE OR REPLACE FUNCTION get_admin_activity_summary(
    p_admin_id INTEGER DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    action_type VARCHAR,
    action_count BIGINT,
    most_recent TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        aal.action_type,
        COUNT(*)::BIGINT as action_count,
        MAX(aal.created_at) as most_recent
    FROM admin_activity_log aal
    WHERE (p_admin_id IS NULL OR aal.admin_player_id = p_admin_id)
    AND aal.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY aal.action_type
    ORDER BY action_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE admin_activity_log IS 'Audit trail of all admin actions for compliance and security';
COMMENT ON TABLE admin_granted_subscriptions IS 'Tracks subscriptions manually granted by admins (not purchased)';
COMMENT ON COLUMN players.admin_role IS 'Admin role: main_admin (full access) or customer_support (limited access)';
COMMENT ON FUNCTION is_admin IS 'Check if a player has any admin role';
COMMENT ON FUNCTION has_admin_role IS 'Check if a player has a specific admin role';
COMMENT ON FUNCTION grant_admin_role IS 'Grant admin role to a user (main_admin only)';
COMMENT ON FUNCTION admin_grant_subscription IS 'Grant a subscription to a user (admin only)';

-- Initial setup: Print instructions for creating first admin
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin Roles System Installed';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'To create your first main admin, run:';
    RAISE NOTICE '';
    RAISE NOTICE 'UPDATE players';
    RAISE NOTICE 'SET admin_role = ''main_admin'',';
    RAISE NOTICE '    admin_granted_at = NOW(),';
    RAISE NOTICE '    admin_permissions = ''{"can_grant_subscriptions": true, "can_grant_bundles": true, "can_view_users": true, "can_view_activity_log": true, "can_grant_admin_roles": true}''::jsonb';
    RAISE NOTICE 'WHERE email = ''your-admin-email@example.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
