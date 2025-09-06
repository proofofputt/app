-- ==================================================================
-- PROOF OF PUTT - DUELS & LEAGUES DATABASE SETUP FOR NEONDB
-- ==================================================================
-- Run this entire script in your NeonDB SQL Console
-- This creates the tables needed for the current API endpoints

-- ==================================================================
-- 1. DUELS SYSTEM TABLES
-- ==================================================================

-- Main duels table for 1v1 challenges
CREATE TABLE IF NOT EXISTS duels (
    duel_id SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    challengee_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined', 'cancelled')),
    rules JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}', -- For frontend compatibility
    
    -- Session tracking
    challenger_session_id INTEGER,
    challengee_session_id INTEGER,
    challenger_session_data JSONB,
    challengee_session_data JSONB,
    
    -- Scoring and results
    challenger_score INTEGER DEFAULT 0,
    challengee_score INTEGER DEFAULT 0,
    winner_id INTEGER REFERENCES players(player_id),
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Metadata
    duel_type VARCHAR(50) DEFAULT 'practice',
    invite_message TEXT,
    completion_reason VARCHAR(100),
    
    -- Prevent users from challenging themselves
    CONSTRAINT no_self_challenge CHECK (challenger_id != challengee_id)
);

-- Duels performance indexes
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_challengee ON duels(challengee_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_duels_created ON duels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_expires ON duels(expires_at);

-- ==================================================================
-- 2. LEAGUES SYSTEM TABLES
-- ==================================================================

-- Main leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    league_type VARCHAR(50) DEFAULT 'tournament',
    status VARCHAR(20) DEFAULT 'registering' CHECK (status IN ('registering', 'active', 'completed', 'cancelled', 'paused')),
    
    -- Settings and rules (stored as JSONB for flexibility)
    rules JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}', -- For frontend compatibility
    
    -- Member management
    max_members INTEGER DEFAULT 50,
    min_members INTEGER DEFAULT 2,
    current_members INTEGER DEFAULT 0,
    
    -- Scheduling
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER DEFAULT 4,
    round_duration_hours INTEGER DEFAULT 168, -- 7 days default
    
    -- Privacy and access
    privacy_level VARCHAR(20) DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'invite_only')),
    invitation_only BOOLEAN DEFAULT false,
    auto_start_rounds BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by INTEGER NOT NULL REFERENCES players(player_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registration_deadline TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- League memberships table
CREATE TABLE IF NOT EXISTS league_memberships (
    membership_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    
    -- Role and permissions
    member_role VARCHAR(20) DEFAULT 'member' CHECK (member_role IN ('owner', 'admin', 'member')),
    invite_permissions BOOLEAN DEFAULT false,
    
    -- Scoring and ranking
    total_score DECIMAL(10,2) DEFAULT 0,
    current_rank INTEGER,
    sessions_this_round INTEGER DEFAULT 0,
    
    -- Status and timing
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate memberships
    UNIQUE(league_id, player_id)
);

-- League rounds table for detailed round tracking
CREATE TABLE IF NOT EXISTS league_rounds (
    round_id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    
    -- Timing
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    scoring_completed BOOLEAN DEFAULT false,
    
    -- Configuration
    round_config JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate rounds
    UNIQUE(league_id, round_number)
);

-- League session tracking (links sessions to specific rounds)
CREATE TABLE IF NOT EXISTS league_round_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES league_rounds(round_id) ON DELETE CASCADE,
    league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    
    -- Session data and scoring
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_data JSONB NOT NULL,
    round_score DECIMAL(10,2) DEFAULT 0,
    ranking_metrics JSONB DEFAULT '{}',
    
    -- Validation
    is_valid BOOLEAN DEFAULT true,
    validation_notes TEXT
);

-- Leagues performance indexes
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);
CREATE INDEX IF NOT EXISTS idx_leagues_privacy ON leagues(privacy_level, status);

CREATE INDEX IF NOT EXISTS idx_league_memberships_league ON league_memberships(league_id, is_active);
CREATE INDEX IF NOT EXISTS idx_league_memberships_player ON league_memberships(player_id, is_active);
CREATE INDEX IF NOT EXISTS idx_league_memberships_role ON league_memberships(league_id, member_role);

CREATE INDEX IF NOT EXISTS idx_league_rounds_league_status ON league_rounds(league_id, status);
CREATE INDEX IF NOT EXISTS idx_league_rounds_timing ON league_rounds(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_league_round_sessions_scoring ON league_round_sessions(round_id, round_score DESC);
CREATE INDEX IF NOT EXISTS idx_league_round_sessions_player ON league_round_sessions(player_id, submitted_at DESC);

-- ==================================================================
-- 3. USEFUL FUNCTIONS
-- ==================================================================

-- Function to create league rounds automatically
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

-- Function to update league member count
CREATE OR REPLACE FUNCTION update_league_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE leagues 
        SET current_members = current_members + 1,
            updated_at = NOW()
        WHERE league_id = NEW.league_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE leagues 
        SET current_members = current_members - 1,
            updated_at = NOW()
        WHERE league_id = OLD.league_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle active status changes
        IF OLD.is_active != NEW.is_active THEN
            IF NEW.is_active THEN
                UPDATE leagues SET current_members = current_members + 1 WHERE league_id = NEW.league_id;
            ELSE
                UPDATE leagues SET current_members = current_members - 1 WHERE league_id = NEW.league_id;
            END IF;
            UPDATE leagues SET updated_at = NOW() WHERE league_id = NEW.league_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain league member counts
CREATE TRIGGER trigger_update_league_member_count
    AFTER INSERT OR DELETE OR UPDATE ON league_memberships
    FOR EACH ROW EXECUTE FUNCTION update_league_member_count();

-- ==================================================================
-- 4. SAMPLE DATA FOR TESTING
-- ==================================================================

-- Sample duel data (will only insert if players exist)
INSERT INTO duels (challenger_id, challengee_id, status, rules)
SELECT 1, 2, 'pending', '{"session_duration_limit_minutes": 60, "invitation_expiry_minutes": 10080}'
WHERE EXISTS (SELECT 1 FROM players WHERE player_id IN (1, 2))
AND NOT EXISTS (SELECT 1 FROM duels WHERE challenger_id = 1 AND challengee_id = 2);

-- Sample league data
INSERT INTO leagues (name, description, league_type, status, rules, max_members, total_rounds, created_by) 
SELECT 'Test Tournament', 'A test tournament for development', 'tournament', 'registering', 
       '{"time_limit_minutes": 60, "num_rounds": 4, "round_duration_hours": 168, "allow_late_joiners": false, "allow_player_invites": false}',
       20, 4, 1
WHERE EXISTS (SELECT 1 FROM players WHERE player_id = 1)
AND NOT EXISTS (SELECT 1 FROM leagues WHERE name = 'Test Tournament');

-- Add creator to their own league
INSERT INTO league_memberships (league_id, player_id, member_role, invite_permissions)
SELECT l.league_id, 1, 'owner', true
FROM leagues l 
WHERE l.name = 'Test Tournament'
AND EXISTS (SELECT 1 FROM players WHERE player_id = 1)
AND NOT EXISTS (SELECT 1 FROM league_memberships WHERE league_id = l.league_id AND player_id = 1);

-- ==================================================================
-- 5. VERIFICATION QUERIES
-- ==================================================================

-- Verify tables were created
SELECT table_name, 
       (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('duels', 'leagues', 'league_memberships', 'league_rounds', 'league_round_sessions')
ORDER BY table_name;

-- Check duels table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'duels'
ORDER BY ordinal_position;

-- Check leagues table structure  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'leagues'
ORDER BY ordinal_position;

-- Show sample data
SELECT 'Duels' as table_name, count(*) as row_count FROM duels
UNION ALL
SELECT 'Leagues', count(*) FROM leagues
UNION ALL  
SELECT 'League Memberships', count(*) FROM league_memberships
UNION ALL
SELECT 'League Rounds', count(*) FROM league_rounds;

-- ==================================================================
-- END OF SCRIPT
-- ==================================================================

-- USAGE NOTES:
-- 1. Run this entire script in your NeonDB SQL console
-- 2. It will create all tables needed for duels and leagues functionality
-- 3. Includes proper indexes, constraints, and sample data
-- 4. Compatible with the current API endpoints
-- 5. The verification queries at the end will confirm everything was created correctly

-- TROUBLESHOOTING:
-- - If you get foreign key errors, make sure the 'players' table exists first
-- - If constraints fail, existing data might conflict with new rules
-- - Check the verification queries output to confirm table creation