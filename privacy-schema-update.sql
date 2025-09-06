-- Privacy and User Lookup Schema Updates
-- Run these commands in your NeonDB SQL editor after the main schema

-- Add phone number field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- User privacy preferences
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accepts_duel_invitations BOOLEAN DEFAULT true,
    accepts_league_invitations BOOLEAN DEFAULT true,
    accepts_from_strangers BOOLEAN DEFAULT false,
    blocked_users INTEGER[] DEFAULT '{}', -- Array of blocked user IDs
    preferred_contact_method VARCHAR(20) DEFAULT 'in_app', -- 'in_app', 'email', 'sms'
    email_invitations_enabled BOOLEAN DEFAULT false,
    sms_invitations_enabled BOOLEAN DEFAULT false,
    public_profile BOOLEAN DEFAULT true,
    show_on_leaderboards BOOLEAN DEFAULT true,
    allow_friend_requests BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User lookup logging for rate limiting and abuse prevention
CREATE TABLE IF NOT EXISTS user_lookup_logs (
    id SERIAL PRIMARY KEY,
    inviting_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lookup_method VARCHAR(20) NOT NULL, -- 'username', 'email', 'phone'
    lookup_success BOOLEAN NOT NULL,
    lookup_identifier VARCHAR(255), -- Store hashed version for pattern detection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitation tracking
CREATE TABLE IF NOT EXISTS duel_invitations (
    invitation_id SERIAL PRIMARY KEY,
    duel_id INTEGER REFERENCES duels(duel_id) ON DELETE CASCADE,
    inviting_user_id INTEGER REFERENCES users(id),
    invited_user_id INTEGER REFERENCES users(id), -- NULL if external invitation
    invitation_method VARCHAR(20), -- 'username', 'email', 'phone'
    external_contact VARCHAR(255), -- email/phone for external invitations
    invitation_token VARCHAR(255) UNIQUE, -- For external invitation links
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    message TEXT, -- Optional personal message
    expires_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'duel_invitation', 'league_invitation', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB, -- Structured notification data
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    action_url VARCHAR(255), -- Deep link for notification action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_privacy_settings_accepts_duels ON user_privacy_settings(accepts_duel_invitations);
CREATE INDEX IF NOT EXISTS idx_privacy_settings_accepts_strangers ON user_privacy_settings(accepts_from_strangers);
CREATE INDEX IF NOT EXISTS idx_lookup_logs_user_time ON user_lookup_logs(inviting_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lookup_logs_method ON user_lookup_logs(lookup_method);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON duel_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON duel_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON duel_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON user_notifications(user_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- Function to hash lookup identifiers for pattern detection without storing PII
CREATE OR REPLACE FUNCTION hash_lookup_identifier(identifier TEXT, method VARCHAR(20)) 
RETURNS TEXT AS $$
BEGIN
    CASE method
        WHEN 'email' THEN
            -- For emails, hash the domain part for pattern detection
            RETURN md5(split_part(identifier, '@', 2));
        WHEN 'phone' THEN
            -- For phones, hash the country/area code for pattern detection
            RETURN md5(substring(regexp_replace(identifier, '[^0-9]', '', 'g') from 1 for 4));
        WHEN 'username' THEN
            -- For usernames, return a fixed value (no pattern detection needed)
            RETURN 'username_lookup';
        ELSE
            RETURN md5(identifier);
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Insert default privacy settings for existing users
INSERT INTO user_privacy_settings (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM user_privacy_settings)
ON CONFLICT (user_id) DO NOTHING;

-- Sample privacy settings for test users
UPDATE user_privacy_settings 
SET 
    accepts_from_strangers = true,
    email_invitations_enabled = true,
    sms_invitations_enabled = false
WHERE user_id IN (1, 2, 3);

-- Create some sample notifications
INSERT INTO user_notifications (user_id, notification_type, title, message, data, expires_at) VALUES
(1, 'system', 'Welcome to Competitive Features!', 'You can now challenge friends to duels and join leagues.', 
 '{"feature": "competitive", "version": "v2"}', NOW() + INTERVAL '7 days'),
(2, 'system', 'Duel Invitations Available', 'Start challenging other players to putting duels.', 
 '{"feature": "duels", "action": "create_duel"}', NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Add constraints for data integrity
ALTER TABLE user_privacy_settings 
ADD CONSTRAINT valid_contact_method 
CHECK (preferred_contact_method IN ('in_app', 'email', 'sms'));

ALTER TABLE user_lookup_logs 
ADD CONSTRAINT valid_lookup_method 
CHECK (lookup_method IN ('username', 'email', 'phone'));

ALTER TABLE duel_invitations 
ADD CONSTRAINT valid_invitation_method 
CHECK (invitation_method IN ('username', 'email', 'phone'));

ALTER TABLE duel_invitations 
ADD CONSTRAINT valid_invitation_status 
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations() RETURNS void AS $$
BEGIN
    UPDATE duel_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' 
      AND expires_at < NOW();
      
    -- Also expire old notifications
    DELETE FROM user_notifications 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- You could set up a cron job to run: SELECT expire_old_invitations();