-- Analytics and Click Tracking System
-- Tracks user interactions for business intelligence and conversion optimization

-- Main events tracking table
CREATE TABLE IF NOT EXISTS analytics_events (
    event_id BIGSERIAL PRIMARY KEY,

    -- Event identification
    event_type VARCHAR(50) NOT NULL, -- 'click', 'page_view', 'download', 'conversion', 'signup', etc.
    event_name VARCHAR(255) NOT NULL, -- Specific event like 'download_dmg', 'view_features', 'click_cta'
    event_category VARCHAR(100), -- 'navigation', 'marketing', 'conversion', 'engagement'

    -- Event details
    event_properties JSONB, -- Flexible storage for event-specific data

    -- Page context
    page_url TEXT NOT NULL,
    page_title VARCHAR(255),
    page_path VARCHAR(500),
    referrer_url TEXT,
    referrer_source VARCHAR(100), -- 'google', 'direct', 'social', etc.
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),

    -- Session tracking
    session_id VARCHAR(255) NOT NULL, -- Client-generated session ID
    visitor_id VARCHAR(255), -- Persistent visitor ID (cookie-based)

    -- User tracking (if authenticated)
    player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,

    -- Device & browser info
    user_agent TEXT,
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    os VARCHAR(100),
    os_version VARCHAR(50),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    device_vendor VARCHAR(100),
    device_model VARCHAR(100),
    screen_resolution VARCHAR(50),
    viewport_size VARCHAR(50),

    -- Geographic data
    ip_address INET,
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(100),

    -- Timing data
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_timestamp TIMESTAMP WITH TIME ZONE,
    page_load_time INTEGER, -- milliseconds
    time_on_page INTEGER, -- seconds

    -- A/B testing & experiments
    experiment_id VARCHAR(100),
    variant_id VARCHAR(100),

    -- Performance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session summary table for aggregated metrics
CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    visitor_id VARCHAR(255),
    player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,

    -- Session metadata
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    session_duration INTEGER, -- seconds

    -- Entry/exit pages
    landing_page TEXT,
    exit_page TEXT,
    landing_page_title VARCHAR(255),

    -- Traffic source
    referrer_url TEXT,
    referrer_source VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Session stats
    page_views INTEGER DEFAULT 0,
    events_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    converted BOOLEAN DEFAULT FALSE,
    conversion_type VARCHAR(100),

    -- Device info
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),

    -- Geographic data
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    city VARCHAR(100),

    -- Performance
    avg_page_load_time INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion tracking table
CREATE TABLE IF NOT EXISTS analytics_conversions (
    conversion_id BIGSERIAL PRIMARY KEY,

    session_id VARCHAR(255) REFERENCES analytics_sessions(session_id),
    visitor_id VARCHAR(255),
    player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,

    -- Conversion details
    conversion_type VARCHAR(100) NOT NULL, -- 'signup', 'download', 'subscription', 'referral'
    conversion_value DECIMAL(10, 2), -- Monetary value if applicable
    conversion_properties JSONB,

    -- Attribution
    first_touch_source VARCHAR(100), -- First referrer that brought user
    last_touch_source VARCHAR(100), -- Last referrer before conversion
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Timing
    time_to_convert INTEGER, -- Seconds from first visit to conversion
    touchpoints_count INTEGER, -- Number of sessions before conversion

    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily aggregated metrics for fast BI reporting
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    metric_date DATE NOT NULL,

    -- Traffic metrics
    unique_visitors INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,

    -- Engagement metrics
    avg_session_duration DECIMAL(10, 2),
    avg_pages_per_session DECIMAL(10, 2),
    bounce_rate DECIMAL(5, 2), -- Percentage

    -- Conversion metrics
    total_conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5, 2), -- Percentage
    signups INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,

    -- Traffic sources
    direct_traffic INTEGER DEFAULT 0,
    organic_traffic INTEGER DEFAULT 0,
    referral_traffic INTEGER DEFAULT 0,
    social_traffic INTEGER DEFAULT 0,
    paid_traffic INTEGER DEFAULT 0,

    -- Device breakdown
    desktop_sessions INTEGER DEFAULT 0,
    mobile_sessions INTEGER DEFAULT 0,
    tablet_sessions INTEGER DEFAULT 0,

    -- Top content
    top_pages JSONB, -- Array of {page, views, conversions}
    top_events JSONB, -- Array of {event, count}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (metric_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_player ON analytics_events(player_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_category ON analytics_events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_utm_campaign ON analytics_events(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_referrer_source ON analytics_events(referrer_source);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON analytics_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_first_seen ON analytics_sessions(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_utm_campaign ON analytics_sessions(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_converted ON analytics_sessions(converted) WHERE converted = TRUE;

CREATE INDEX IF NOT EXISTS idx_conversions_session ON analytics_conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversions_player ON analytics_conversions(player_id);
CREATE INDEX IF NOT EXISTS idx_conversions_type ON analytics_conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_conversions_timestamp ON analytics_conversions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON analytics_daily_metrics(metric_date DESC);

-- Function to update session summary
CREATE OR REPLACE FUNCTION update_analytics_session(p_session_id VARCHAR(255))
RETURNS VOID AS $$
DECLARE
    v_first_event TIMESTAMP WITH TIME ZONE;
    v_last_event TIMESTAMP WITH TIME ZONE;
    v_landing_page TEXT;
    v_landing_title VARCHAR(255);
    v_exit_page TEXT;
    v_visitor_id VARCHAR(255);
    v_player_id INTEGER;
    v_referrer_url TEXT;
    v_referrer_source VARCHAR(100);
    v_device_type VARCHAR(50);
    v_browser VARCHAR(100);
    v_os VARCHAR(100);
    v_country_code VARCHAR(2);
    v_country_name VARCHAR(100);
    v_city VARCHAR(100);
    v_utm_source VARCHAR(100);
    v_utm_medium VARCHAR(100);
    v_utm_campaign VARCHAR(100);
BEGIN
    -- Get session aggregated data
    SELECT
        MIN(timestamp), MAX(timestamp), visitor_id, player_id,
        device_type, browser, os, country_code, country_name, city,
        referrer_url, referrer_source, utm_source, utm_medium, utm_campaign
    INTO
        v_first_event, v_last_event, v_visitor_id, v_player_id,
        v_device_type, v_browser, v_os, v_country_code, v_country_name, v_city,
        v_referrer_url, v_referrer_source, v_utm_source, v_utm_medium, v_utm_campaign
    FROM analytics_events
    WHERE session_id = p_session_id
    GROUP BY visitor_id, player_id, device_type, browser, os,
             country_code, country_name, city, referrer_url, referrer_source,
             utm_source, utm_medium, utm_campaign;

    -- Get landing and exit pages
    SELECT page_url, page_title INTO v_landing_page, v_landing_title
    FROM analytics_events
    WHERE session_id = p_session_id AND event_type = 'page_view'
    ORDER BY timestamp ASC LIMIT 1;

    SELECT page_url INTO v_exit_page
    FROM analytics_events
    WHERE session_id = p_session_id AND event_type = 'page_view'
    ORDER BY timestamp DESC LIMIT 1;

    -- Upsert session summary
    INSERT INTO analytics_sessions (
        session_id, visitor_id, player_id, first_seen_at, last_seen_at,
        session_duration, landing_page, landing_page_title, exit_page,
        referrer_url, referrer_source, utm_source, utm_medium, utm_campaign,
        device_type, browser, os, country_code, country_name, city,
        page_views, events_count, downloads_count,
        avg_page_load_time, updated_at
    )
    SELECT
        p_session_id, v_visitor_id, v_player_id, v_first_event, v_last_event,
        EXTRACT(EPOCH FROM (v_last_event - v_first_event))::INTEGER,
        v_landing_page, v_landing_title, v_exit_page,
        v_referrer_url, v_referrer_source, v_utm_source, v_utm_medium, v_utm_campaign,
        v_device_type, v_browser, v_os, v_country_code, v_country_name, v_city,
        COUNT(*) FILTER (WHERE event_type = 'page_view'),
        COUNT(*),
        COUNT(*) FILTER (WHERE event_type = 'download'),
        AVG(page_load_time)::INTEGER,
        NOW()
    FROM analytics_events
    WHERE session_id = p_session_id
    ON CONFLICT (session_id) DO UPDATE SET
        last_seen_at = EXCLUDED.last_seen_at,
        session_duration = EXCLUDED.session_duration,
        exit_page = EXCLUDED.exit_page,
        page_views = EXCLUDED.page_views,
        events_count = EXCLUDED.events_count,
        downloads_count = EXCLUDED.downloads_count,
        avg_page_load_time = EXCLUDED.avg_page_load_time,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to track conversion
CREATE OR REPLACE FUNCTION track_conversion(
    p_session_id VARCHAR(255),
    p_conversion_type VARCHAR(100),
    p_conversion_value DECIMAL DEFAULT NULL,
    p_conversion_properties JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_conversion_id BIGINT;
    v_visitor_id VARCHAR(255);
    v_player_id INTEGER;
    v_first_touch VARCHAR(100);
    v_last_touch VARCHAR(100);
    v_utm_source VARCHAR(100);
    v_utm_medium VARCHAR(100);
    v_utm_campaign VARCHAR(100);
BEGIN
    -- Get session details
    SELECT visitor_id, player_id, referrer_source, utm_source, utm_medium, utm_campaign
    INTO v_visitor_id, v_player_id, v_last_touch, v_utm_source, v_utm_medium, v_utm_campaign
    FROM analytics_sessions
    WHERE session_id = p_session_id;

    -- Get first touch attribution (first session for this visitor)
    SELECT referrer_source INTO v_first_touch
    FROM analytics_sessions
    WHERE visitor_id = v_visitor_id
    ORDER BY first_seen_at ASC LIMIT 1;

    -- Insert conversion record
    INSERT INTO analytics_conversions (
        session_id, visitor_id, player_id, conversion_type, conversion_value,
        conversion_properties, first_touch_source, last_touch_source,
        utm_source, utm_medium, utm_campaign
    ) VALUES (
        p_session_id, v_visitor_id, v_player_id, p_conversion_type, p_conversion_value,
        p_conversion_properties, v_first_touch, v_last_touch,
        v_utm_source, v_utm_medium, v_utm_campaign
    )
    RETURNING conversion_id INTO v_conversion_id;

    -- Mark session as converted
    UPDATE analytics_sessions
    SET converted = TRUE, conversion_type = p_conversion_type
    WHERE session_id = p_session_id;

    RETURN v_conversion_id;
END;
$$ LANGUAGE plpgsql;

-- Add table comments
COMMENT ON TABLE analytics_events IS 'Detailed event tracking for all user interactions';
COMMENT ON TABLE analytics_sessions IS 'Aggregated session-level metrics for faster querying';
COMMENT ON TABLE analytics_conversions IS 'Conversion tracking with multi-touch attribution';
COMMENT ON TABLE analytics_daily_metrics IS 'Pre-aggregated daily metrics for BI dashboards';
COMMENT ON FUNCTION update_analytics_session IS 'Updates session summary with latest event data';
COMMENT ON FUNCTION track_conversion IS 'Records a conversion event with attribution data';
