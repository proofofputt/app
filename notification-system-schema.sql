-- Notification system database schema
-- Add this to your existing database

-- Notification log table to track all email attempts
CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'duel_invitation', 'friend_request', 'league_invitation', 'session_reminder'
    recipient_email VARCHAR(255) NOT NULL,
    sender_id INTEGER REFERENCES players(id),
    related_id INTEGER, -- ID of duel, friend request, league, etc.
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_notification_log_type (type),
    INDEX idx_notification_log_recipient (recipient_email),
    INDEX idx_notification_log_created (created_at)
);

-- Notification preferences table (for future use)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) UNIQUE,
    duel_invitations BOOLEAN DEFAULT true,
    friend_requests BOOLEAN DEFAULT true,
    league_invitations BOOLEAN DEFAULT true,
    session_reminders BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add email verification status to players table (if not exists)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Friend requests table updates (if needed)
CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER REFERENCES players(id),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_id INTEGER REFERENCES players(id), -- NULL if recipient not registered yet
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Prevent duplicate requests
    UNIQUE(requester_id, recipient_email),
    
    -- Indexes
    INDEX idx_friend_requests_recipient (recipient_email),
    INDEX idx_friend_requests_status (status),
    INDEX idx_friend_requests_expires (expires_at)
);

-- League invitations table
CREATE TABLE IF NOT EXISTS league_invitations (
    id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(id),
    inviter_id INTEGER REFERENCES players(id),
    invitee_email VARCHAR(255) NOT NULL,
    invitee_id INTEGER REFERENCES players(id), -- NULL if invitee not registered yet
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days'),
    
    -- Prevent duplicate invitations
    UNIQUE(league_id, invitee_email),
    
    -- Indexes
    INDEX idx_league_invitations_league (league_id),
    INDEX idx_league_invitations_invitee (invitee_email),
    INDEX idx_league_invitations_status (status)
);

-- Update duels table to track invitation status
ALTER TABLE duels 
ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;

-- Scheduled notifications table for automated reminders
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    recipient_id INTEGER REFERENCES players(id),
    recipient_email VARCHAR(255),
    related_id INTEGER,
    related_type VARCHAR(50), -- 'duel', 'league_round', 'session'
    scheduled_for TIMESTAMP NOT NULL,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_scheduled_notifications_scheduled (scheduled_for),
    INDEX idx_scheduled_notifications_sent (sent),
    INDEX idx_scheduled_notifications_type (type)
);

-- Function to automatically schedule reminder notifications
CREATE OR REPLACE FUNCTION schedule_session_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Schedule reminder 24 hours before session expires for duels
    IF NEW.expires_at IS NOT NULL AND TG_TABLE_NAME = 'duels' THEN
        INSERT INTO scheduled_notifications 
        (type, recipient_email, related_id, related_type, scheduled_for)
        VALUES 
        ('session_reminder', NEW.invitee_email, NEW.id, 'duel', NEW.expires_at - INTERVAL '24 hours')
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic reminder scheduling
CREATE TRIGGER trigger_schedule_duel_reminders
    AFTER INSERT OR UPDATE ON duels
    FOR EACH ROW
    WHEN (NEW.expires_at IS NOT NULL)
    EXECUTE FUNCTION schedule_session_reminders();

-- Insert default notification preferences for existing players
INSERT INTO notification_preferences (player_id)
SELECT id FROM players 
WHERE id NOT IN (SELECT player_id FROM notification_preferences WHERE player_id IS NOT NULL)
ON CONFLICT (player_id) DO NOTHING;