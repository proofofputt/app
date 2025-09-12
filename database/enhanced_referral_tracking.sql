-- Enhanced Referral Tracking System
-- Supports referral assignment even when users sign up with different contact info

-- Create referral tracking sessions table
CREATE TABLE IF NOT EXISTS referral_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    invited_email VARCHAR(255),
    invited_phone VARCHAR(20),
    invited_name VARCHAR(255),
    referral_source VARCHAR(50) NOT NULL, -- 'duel_invitation', 'league_invitation', 'direct_link'
    referral_context JSONB, -- Store additional context like duel_id, league_id, etc.
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_player_id INTEGER REFERENCES players(player_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(referrer_id),
    INDEX(invited_email),
    INDEX(invited_phone),
    INDEX(expires_at),
    INDEX(used_at)
);

-- Create referral matching attempts table (for analytics)
CREATE TABLE IF NOT EXISTS referral_matching_attempts (
    attempt_id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES referral_sessions(session_id),
    signup_email VARCHAR(255),
    signup_phone VARCHAR(20),
    signup_name VARCHAR(255),
    oauth_provider VARCHAR(50), -- 'google', 'linkedin', 'nostr', null for regular signup
    match_score DECIMAL(3,2), -- 0.00 to 1.00 confidence score
    match_method VARCHAR(50), -- 'exact_email', 'exact_phone', 'fuzzy_name', 'session_timing'
    matched BOOLEAN DEFAULT FALSE,
    player_id INTEGER REFERENCES players(player_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(session_id),
    INDEX(signup_email),
    INDEX(signup_phone),
    INDEX(player_id),
    INDEX(created_at)
);

-- Add referral tracking columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS referral_session_id VARCHAR(255) REFERENCES referral_sessions(session_id),
ADD COLUMN IF NOT EXISTS signup_method VARCHAR(50) DEFAULT 'email', -- 'email', 'google', 'linkedin', 'nostr'
ADD COLUMN IF NOT EXISTS consent_contact_info BOOLEAN DEFAULT TRUE; -- User consent for storing contact info

-- Create function to find potential referral matches
CREATE OR REPLACE FUNCTION find_referral_match(
    p_signup_email VARCHAR(255) DEFAULT NULL,
    p_signup_phone VARCHAR(20) DEFAULT NULL,
    p_signup_name VARCHAR(255) DEFAULT NULL,
    p_oauth_provider VARCHAR(50) DEFAULT NULL,
    p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    session_id VARCHAR(255),
    referrer_id INTEGER,
    match_score DECIMAL(3,2),
    match_method VARCHAR(50)
) AS $$
DECLARE
    cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_time := NOW() - INTERVAL '1 hour' * p_time_window_hours;
    
    RETURN QUERY
    WITH scored_matches AS (
        SELECT 
            rs.session_id,
            rs.referrer_id,
            CASE 
                -- Exact email match (highest confidence)
                WHEN rs.invited_email IS NOT NULL 
                     AND p_signup_email IS NOT NULL 
                     AND LOWER(rs.invited_email) = LOWER(p_signup_email) 
                THEN 1.00
                
                -- Exact phone match (very high confidence)
                WHEN rs.invited_phone IS NOT NULL 
                     AND p_signup_phone IS NOT NULL 
                     AND rs.invited_phone = p_signup_phone 
                THEN 0.95
                
                -- Name similarity + timing (medium confidence)
                WHEN rs.invited_name IS NOT NULL 
                     AND p_signup_name IS NOT NULL 
                     AND similarity(LOWER(rs.invited_name), LOWER(p_signup_name)) > 0.6
                     AND rs.created_at > cutoff_time
                THEN 0.70 * similarity(LOWER(rs.invited_name), LOWER(p_signup_name))
                
                -- Recent session without specific invite (low confidence)
                WHEN rs.invited_email IS NULL 
                     AND rs.invited_phone IS NULL 
                     AND rs.created_at > cutoff_time
                THEN 0.30
                
                ELSE 0.00
            END AS score,
            CASE 
                WHEN rs.invited_email IS NOT NULL 
                     AND p_signup_email IS NOT NULL 
                     AND LOWER(rs.invited_email) = LOWER(p_signup_email) 
                THEN 'exact_email'
                
                WHEN rs.invited_phone IS NOT NULL 
                     AND p_signup_phone IS NOT NULL 
                     AND rs.invited_phone = p_signup_phone 
                THEN 'exact_phone'
                
                WHEN rs.invited_name IS NOT NULL 
                     AND p_signup_name IS NOT NULL 
                     AND similarity(LOWER(rs.invited_name), LOWER(p_signup_name)) > 0.6
                THEN 'fuzzy_name'
                
                WHEN rs.created_at > cutoff_time
                THEN 'session_timing'
                
                ELSE 'no_match'
            END AS method
        FROM referral_sessions rs
        WHERE rs.used_at IS NULL 
          AND rs.expires_at > NOW()
          AND (
              -- Email match
              (rs.invited_email IS NOT NULL AND p_signup_email IS NOT NULL 
               AND LOWER(rs.invited_email) = LOWER(p_signup_email))
              OR
              -- Phone match  
              (rs.invited_phone IS NOT NULL AND p_signup_phone IS NOT NULL 
               AND rs.invited_phone = p_signup_phone)
              OR
              -- Name similarity with recent timing
              (rs.invited_name IS NOT NULL AND p_signup_name IS NOT NULL 
               AND similarity(LOWER(rs.invited_name), LOWER(p_signup_name)) > 0.6
               AND rs.created_at > cutoff_time)
              OR
              -- Recent session fallback
              (rs.invited_email IS NULL AND rs.invited_phone IS NULL 
               AND rs.created_at > cutoff_time)
          )
    )
    SELECT 
        sm.session_id,
        sm.referrer_id,
        sm.score,
        sm.method
    FROM scored_matches sm
    WHERE sm.score > 0.25  -- Minimum confidence threshold
    ORDER BY sm.score DESC, sm.created_at DESC
    LIMIT 1;  -- Return best match only
END;
$$ LANGUAGE plpgsql;

-- Create function to safely assign referral without exposing private info
CREATE OR REPLACE FUNCTION assign_referral(
    p_player_id INTEGER,
    p_session_id VARCHAR(255),
    p_signup_email VARCHAR(255) DEFAULT NULL,
    p_signup_phone VARCHAR(20) DEFAULT NULL,
    p_signup_name VARCHAR(255) DEFAULT NULL,
    p_oauth_provider VARCHAR(50) DEFAULT NULL,
    p_consent_contact_info BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id INTEGER;
    v_referral_source VARCHAR(50);
    v_referral_context JSONB;
    v_result JSONB;
BEGIN
    -- Get referral session details
    SELECT referrer_id, referral_source, referral_context
    INTO v_referrer_id, v_referral_source, v_referral_context
    FROM referral_sessions
    WHERE session_id = p_session_id
      AND used_at IS NULL
      AND expires_at > NOW();
      
    IF v_referrer_id IS NULL THEN
        RETURN '{"success": false, "message": "Invalid or expired referral session"}'::JSONB;
    END IF;
    
    -- Record referral matching attempt
    INSERT INTO referral_matching_attempts (
        session_id, signup_email, signup_phone, signup_name, 
        oauth_provider, match_score, match_method, matched, player_id
    ) VALUES (
        p_session_id, 
        CASE WHEN p_consent_contact_info THEN p_signup_email ELSE NULL END,
        CASE WHEN p_consent_contact_info THEN p_signup_phone ELSE NULL END,
        p_signup_name, p_oauth_provider, 1.00, 'direct_assignment', TRUE, p_player_id
    );
    
    -- Create referral record
    INSERT INTO player_referrals (
        referrer_id, referred_player_id, referral_source, created_at
    ) VALUES (
        v_referrer_id, p_player_id, v_referral_source, NOW()
    ) ON CONFLICT (referrer_id, referred_player_id) DO NOTHING;
    
    -- Update referral session as used
    UPDATE referral_sessions 
    SET used_at = NOW(), used_by_player_id = p_player_id
    WHERE session_id = p_session_id;
    
    -- Update player with referral info (respecting privacy)
    UPDATE players 
    SET referral_session_id = p_session_id,
        signup_method = COALESCE(p_oauth_provider, 'email'),
        consent_contact_info = p_consent_contact_info,
        -- Only store contact info if user consents
        email = CASE WHEN p_consent_contact_info THEN COALESCE(email, p_signup_email) ELSE email END,
        phone = CASE WHEN p_consent_contact_info THEN COALESCE(phone, p_signup_phone) ELSE phone END
    WHERE player_id = p_player_id;
    
    -- Add mutual friend connections
    INSERT INTO player_friends (player_id, friend_player_id, status, created_at)
    VALUES (v_referrer_id, p_player_id, 'accepted', NOW()),
           (p_player_id, v_referrer_id, 'accepted', NOW())
    ON CONFLICT (player_id, friend_player_id) DO NOTHING;
    
    v_result := jsonb_build_object(
        'success', TRUE,
        'referrer_id', v_referrer_id,
        'referral_source', v_referral_source,
        'auto_added_to_contacts', TRUE
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic referral matching during signup
CREATE OR REPLACE FUNCTION auto_match_referral(
    p_player_id INTEGER,
    p_signup_email VARCHAR(255) DEFAULT NULL,
    p_signup_phone VARCHAR(20) DEFAULT NULL,
    p_signup_name VARCHAR(255) DEFAULT NULL,
    p_oauth_provider VARCHAR(50) DEFAULT NULL,
    p_consent_contact_info BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_match_record RECORD;
    v_result JSONB;
BEGIN
    -- Find potential referral match
    SELECT * INTO v_match_record
    FROM find_referral_match(
        p_signup_email, p_signup_phone, p_signup_name, p_oauth_provider, 24
    );
    
    IF v_match_record.session_id IS NULL THEN
        RETURN '{"success": false, "message": "No referral match found"}'::JSONB;
    END IF;
    
    -- Record the matching attempt
    INSERT INTO referral_matching_attempts (
        session_id, signup_email, signup_phone, signup_name, 
        oauth_provider, match_score, match_method, matched, player_id
    ) VALUES (
        v_match_record.session_id,
        CASE WHEN p_consent_contact_info THEN p_signup_email ELSE NULL END,
        CASE WHEN p_consent_contact_info THEN p_signup_phone ELSE NULL END,
        p_signup_name, p_oauth_provider, v_match_record.match_score, 
        v_match_record.match_method, TRUE, p_player_id
    );
    
    -- Assign the referral
    SELECT assign_referral(
        p_player_id, v_match_record.session_id, p_signup_email, 
        p_signup_phone, p_signup_name, p_oauth_provider, p_consent_contact_info
    ) INTO v_result;
    
    -- Add match details to result
    v_result := v_result || jsonb_build_object(
        'match_score', v_match_record.match_score,
        'match_method', v_match_record.match_method
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for expired referral sessions
CREATE OR REPLACE FUNCTION cleanup_expired_referral_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM referral_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE referral_sessions IS 'Tracks referral invitations with flexible matching for different signup methods';
COMMENT ON TABLE referral_matching_attempts IS 'Analytics table for referral matching attempts and success rates';
COMMENT ON FUNCTION find_referral_match IS 'Finds potential referral matches using email, phone, name similarity, and timing';
COMMENT ON FUNCTION assign_referral IS 'Safely assigns referral while respecting user privacy preferences';
COMMENT ON FUNCTION auto_match_referral IS 'Automatically matches and assigns referrals during signup process';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_sessions_expires ON referral_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_sessions_created ON referral_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_sessions_used ON referral_sessions(used_at) WHERE used_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_referral_session ON players(referral_session_id) WHERE referral_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_signup_method ON players(signup_method);

-- Enable pg_trgm extension for name similarity matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;