-- Enhanced League System Database Schema
-- Run these commands in your NeonDB SQL editor

-- Enhanced leagues table with scheduling
ALTER TABLE leagues 
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS round_duration_hours INTEGER DEFAULT 168, -- 7 days default
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_start_rounds BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invitation_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public'; -- 'public', 'private', 'invite_only'

-- League rounds table for detailed round tracking
CREATE TABLE IF NOT EXISTS league_rounds (
    round_id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
    scoring_completed BOOLEAN DEFAULT false,
    round_config JSONB, -- Round-specific configuration overrides
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, round_number)
);

-- League invitations table
CREATE TABLE IF NOT EXISTS league_invitations (
    invitation_id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    inviting_user_id INTEGER REFERENCES users(id),
    invited_user_id INTEGER REFERENCES users(id), -- NULL if external invitation
    invitation_method VARCHAR(20), -- 'username', 'email', 'phone'
    external_contact VARCHAR(255), -- email/phone for external invitations
    invitation_token VARCHAR(255) UNIQUE, -- For external invitation links
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    message TEXT, -- Optional personal message
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced league memberships with role support
ALTER TABLE league_memberships 
ADD COLUMN IF NOT EXISTS member_role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
ADD COLUMN IF NOT EXISTS invite_permissions BOOLEAN DEFAULT false, -- Can invite new members
ADD COLUMN IF NOT EXISTS total_score DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_rank INTEGER,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sessions_this_round INTEGER DEFAULT 0;

-- Round session tracking for registered users only
CREATE TABLE IF NOT EXISTS league_round_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    round_id INTEGER REFERENCES league_rounds(round_id) ON DELETE CASCADE,
    league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_data JSONB NOT NULL, -- Full session data
    round_score DECIMAL(10,2) DEFAULT 0,
    ranking_metrics JSONB, -- Pre-calculated ranking values
    is_valid BOOLEAN DEFAULT true, -- For session validation
    validation_notes TEXT
);

-- League notifications for events
CREATE TABLE IF NOT EXISTS league_notifications (
    id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for all members
    notification_type VARCHAR(50) NOT NULL, -- 'round_start', 'round_end', 'invitation', 'ranking_update'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB, -- Structured notification data
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_league_rounds_league_status ON league_rounds(league_id, status);
CREATE INDEX IF NOT EXISTS idx_league_rounds_timing ON league_rounds(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_league_invitations_token ON league_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_league_invitations_status ON league_invitations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_league_memberships_role ON league_memberships(league_id, member_role);
CREATE INDEX IF NOT EXISTS idx_league_round_sessions_scoring ON league_round_sessions(round_id, round_score DESC);
CREATE INDEX IF NOT EXISTS idx_league_round_sessions_player ON league_round_sessions(player_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_league_notifications_user ON league_notifications(user_id, read_at) WHERE read_at IS NULL;

-- Views for common queries
CREATE OR REPLACE VIEW league_leaderboard AS
SELECT 
    l.league_id,
    l.name as league_name,
    lm.player_id,
    u.display_name as player_name,
    u.username,
    lm.total_score,
    lm.current_rank,
    lm.sessions_this_round,
    lm.last_activity,
    COUNT(lrs.session_id) as total_sessions,
    AVG(lrs.round_score) as avg_round_score,
    MAX(lrs.round_score) as best_round_score,
    MIN(lrs.submitted_at) as first_session,
    MAX(lrs.submitted_at) as latest_session
FROM league_memberships lm
JOIN leagues l ON lm.league_id = l.league_id
JOIN users u ON lm.player_id = u.id
LEFT JOIN league_round_sessions lrs ON lm.league_id = lrs.league_id AND lm.player_id = lrs.player_id
WHERE lm.is_active = true
GROUP BY l.league_id, l.name, lm.player_id, u.display_name, u.username, 
         lm.total_score, lm.current_rank, lm.sessions_this_round, lm.last_activity
ORDER BY lm.current_rank ASC NULLS LAST, lm.total_score DESC;

-- Current round view
CREATE OR REPLACE VIEW league_current_rounds AS
SELECT 
    l.league_id,
    l.name as league_name,
    lr.round_id,
    lr.round_number,
    lr.start_time,
    lr.end_time,
    lr.status,
    (lr.end_time < NOW()) as is_expired,
    (lr.start_time <= NOW() AND lr.end_time > NOW()) as is_active,
    COUNT(lrs.session_id) as session_count,
    COUNT(DISTINCT lrs.player_id) as participating_members
FROM leagues l
JOIN league_rounds lr ON l.league_id = lr.league_id
LEFT JOIN league_round_sessions lrs ON lr.round_id = lrs.round_id
WHERE l.status = 'active'
GROUP BY l.league_id, l.name, lr.round_id, lr.round_number, 
         lr.start_time, lr.end_time, lr.status
ORDER BY l.league_id, lr.round_number;

-- Functions for league management
CREATE OR REPLACE FUNCTION create_league_rounds(
    p_league_id INTEGER,
    p_total_rounds INTEGER,
    p_round_duration_hours INTEGER,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS BOOLEAN AS $$
DECLARE
    round_num INTEGER;
    round_start TIMESTAMP WITH TIME ZONE;
    round_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Delete existing rounds if any
    DELETE FROM league_rounds WHERE league_id = p_league_id;
    
    -- Create rounds
    FOR round_num IN 1..p_total_rounds LOOP
        round_start := p_start_date + INTERVAL '1 hour' * ((round_num - 1) * p_round_duration_hours);
        round_end := round_start + INTERVAL '1 hour' * p_round_duration_hours;
        
        INSERT INTO league_rounds (
            league_id, round_number, start_time, end_time, 
            status, created_at, updated_at
        ) VALUES (
            p_league_id, round_num, round_start, round_end,
            CASE WHEN round_num = 1 THEN 'active' ELSE 'scheduled' END,
            NOW(), NOW()
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate league rankings using points-per-rank system
CREATE OR REPLACE FUNCTION update_league_rankings(p_league_id INTEGER) 
RETURNS BOOLEAN AS $$
DECLARE
    round_rec RECORD;
    player_rec RECORD;
    member_count INTEGER;
    rank_counter INTEGER;
    final_member_rec RECORD;
    final_rank_counter INTEGER := 1;
BEGIN
    -- Get total number of active members for points calculation
    SELECT COUNT(*) INTO member_count
    FROM league_memberships 
    WHERE league_id = p_league_id AND is_active = true;
    
    -- Reset all member scores to 0
    UPDATE league_memberships 
    SET total_score = 0, average_make_percentage = 0
    WHERE league_id = p_league_id AND is_active = true;
    
    -- Process each completed round for points-per-rank scoring
    FOR round_rec IN (
        SELECT round_id, round_number 
        FROM league_rounds 
        WHERE league_id = p_league_id 
        AND status = 'completed'
        ORDER BY round_number ASC
    ) LOOP
        rank_counter := 1;
        
        -- Rank players by their score in this specific round and award points
        FOR player_rec IN (
            SELECT 
                lrs.player_id,
                lrs.round_score,
                (lrs.session_data->>'make_percentage')::decimal as round_make_percentage
            FROM league_round_sessions lrs
            JOIN league_memberships lm ON lrs.player_id = lm.player_id AND lrs.league_id = lm.league_id
            WHERE lrs.round_id = round_rec.round_id 
            AND lm.is_active = true
            ORDER BY lrs.round_score DESC, (lrs.session_data->>'make_percentage')::decimal DESC
        ) LOOP
            -- Award points: highest rank gets member_count points, lowest gets 1 point
            UPDATE league_memberships 
            SET total_score = total_score + (member_count - rank_counter + 1)
            WHERE league_id = p_league_id AND player_id = player_rec.player_id;
            
            rank_counter := rank_counter + 1;
        END LOOP;
    END LOOP;
    
    -- Calculate average make percentage across all completed rounds for tiebreaker
    UPDATE league_memberships lm
    SET average_make_percentage = (
        SELECT COALESCE(AVG((lrs.session_data->>'make_percentage')::decimal), 0)
        FROM league_round_sessions lrs
        JOIN league_rounds lr ON lrs.round_id = lr.round_id
        WHERE lrs.player_id = lm.player_id 
        AND lrs.league_id = p_league_id
        AND lr.status = 'completed'
    )
    WHERE lm.league_id = p_league_id AND lm.is_active = true;
    
    -- Final ranking based on total points, with average make percentage as tiebreaker
    FOR final_member_rec IN (
        SELECT 
            lm.player_id,
            lm.total_score,
            lm.average_make_percentage
        FROM league_memberships lm
        WHERE lm.league_id = p_league_id AND lm.is_active = true
        ORDER BY lm.total_score DESC, lm.average_make_percentage DESC
    ) LOOP
        UPDATE league_memberships 
        SET 
            current_rank = final_rank_counter,
            last_activity = NOW()
        WHERE league_id = p_league_id AND player_id = final_member_rec.player_id;
        
        final_rank_counter := final_rank_counter + 1;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to advance to next round
CREATE OR REPLACE FUNCTION advance_league_round(p_league_id INTEGER) 
RETURNS BOOLEAN AS $$
DECLARE
    current_round_num INTEGER;
    next_round_num INTEGER;
BEGIN
    -- Get current round
    SELECT current_round INTO current_round_num
    FROM leagues WHERE league_id = p_league_id;
    
    next_round_num := current_round_num + 1;
    
    -- Complete current round
    UPDATE league_rounds 
    SET status = 'completed', scoring_completed = true, updated_at = NOW()
    WHERE league_id = p_league_id AND round_number = current_round_num;
    
    -- Activate next round if it exists
    UPDATE league_rounds 
    SET status = 'active', updated_at = NOW()
    WHERE league_id = p_league_id AND round_number = next_round_num;
    
    -- Update league current round
    IF EXISTS (SELECT 1 FROM league_rounds WHERE league_id = p_league_id AND round_number = next_round_num) THEN
        UPDATE leagues 
        SET current_round = next_round_num, updated_at = NOW()
        WHERE league_id = p_league_id;
    ELSE
        -- League is complete
        UPDATE leagues 
        SET status = 'completed', current_round = current_round_num, updated_at = NOW()
        WHERE league_id = p_league_id;
    END IF;
    
    -- Update rankings
    PERFORM update_league_rankings(p_league_id);
    
    -- Reset session counters for new round
    UPDATE league_memberships 
    SET sessions_this_round = 0 
    WHERE league_id = p_league_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically advance expired rounds
CREATE OR REPLACE FUNCTION auto_advance_expired_rounds() 
RETURNS INTEGER AS $$
DECLARE
    round_rec RECORD;
    advanced_count INTEGER := 0;
BEGIN
    FOR round_rec IN (
        SELECT lr.league_id, lr.round_number
        FROM league_rounds lr
        JOIN leagues l ON lr.league_id = l.league_id
        WHERE lr.status = 'active' 
          AND lr.end_time < NOW()
          AND l.auto_start_rounds = true
    ) LOOP
        PERFORM advance_league_round(round_rec.league_id);
        advanced_count := advanced_count + 1;
    END LOOP;
    
    RETURN advanced_count;
END;
$$ LANGUAGE plpgsql;

-- Constraints and validation
ALTER TABLE league_rounds 
ADD CONSTRAINT valid_round_status 
CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled'));

ALTER TABLE league_invitations 
ADD CONSTRAINT valid_invitation_method 
CHECK (invitation_method IN ('username', 'email', 'phone'));

ALTER TABLE league_invitations 
ADD CONSTRAINT valid_invitation_status 
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

ALTER TABLE league_memberships 
ADD CONSTRAINT valid_member_role 
CHECK (member_role IN ('owner', 'admin', 'member'));

ALTER TABLE leagues 
ADD CONSTRAINT valid_privacy_level 
CHECK (privacy_level IN ('public', 'private', 'invite_only'));

-- Sample data for testing
INSERT INTO leagues (name, description, league_type, status, rules, max_members, 
                    total_rounds, round_duration_hours, privacy_level, created_by) 
VALUES 
('Weekly Putting Challenge', 'Competitive weekly league for serious players', 'weekly', 'active', 
 '{"scoring_method": "cumulative", "min_sessions_per_round": 3, "max_sessions_per_round": 10}', 
 20, 4, 168, 'public', 1),
('Speed Masters League', 'Fast-paced putting competitions', 'weekly', 'active',
 '{"scoring_method": "fastest_21", "min_sessions_per_round": 2, "max_sessions_per_round": 5}',
 15, 6, 120, 'public', 2)
ON CONFLICT DO NOTHING;

-- Create initial rounds for sample leagues
SELECT create_league_rounds(
    (SELECT league_id FROM leagues WHERE name = 'Weekly Putting Challenge' LIMIT 1),
    4, 168, NOW()
) WHERE EXISTS (SELECT 1 FROM leagues WHERE name = 'Weekly Putting Challenge');

SELECT create_league_rounds(
    (SELECT league_id FROM leagues WHERE name = 'Speed Masters League' LIMIT 1),
    6, 120, NOW()
) WHERE EXISTS (SELECT 1 FROM leagues WHERE name = 'Speed Masters League');

-- Cleanup function for expired invitations
CREATE OR REPLACE FUNCTION expire_old_league_invitations() 
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE league_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- You could set up a cron job to run:
-- SELECT auto_advance_expired_rounds();
-- SELECT expire_old_league_invitations();

COMMENT ON TABLE league_rounds IS 'Tracks individual rounds within leagues with timing and scoring';
COMMENT ON TABLE league_invitations IS 'Manages league invitations similar to duel invitations';
COMMENT ON TABLE league_round_sessions IS 'Links registered user sessions to specific league rounds';
COMMENT ON TABLE league_notifications IS 'In-app notifications for league events and updates';
COMMENT ON VIEW league_leaderboard IS 'Comprehensive leaderboard view with all ranking metrics';
COMMENT ON VIEW league_current_rounds IS 'Shows current active rounds across all leagues';