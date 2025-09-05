-- NeonDB Schema Updates for Real Leaderboard System
-- Run these commands in your NeonDB SQL editor

-- Users/players table (for leaderboard names and profiles)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    subscription_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'premium', 'elite'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test users for leaderboard testing (update existing or create new)
INSERT INTO users (id, username, email, display_name) VALUES 
(1, 'pop', 'pop@proofofputt.com', 'Pop'),
(2, 'tiger', 'tiger@example.com', 'Tiger'),
(3, 'jordan', 'jordan@example.com', 'Jordan')
ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

-- Leaderboard contexts (for friends, leagues, custom groups)
CREATE TABLE IF NOT EXISTS leaderboard_contexts (
    context_id SERIAL PRIMARY KEY,
    context_type VARCHAR(50) NOT NULL, -- 'friends', 'league', 'duel', 'custom'
    context_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    config JSONB, -- for custom settings/filters
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context memberships (who belongs to each context)
CREATE TABLE IF NOT EXISTS context_memberships (
    context_id INTEGER REFERENCES leaderboard_contexts(context_id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (context_id, player_id)
);

-- Friends/social connections
CREATE TABLE IF NOT EXISTS friendships (
    user_id INTEGER REFERENCES users(id),
    friend_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Leaderboard cache table for performance
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Duels table
CREATE TABLE IF NOT EXISTS duels (
    duel_id SERIAL PRIMARY KEY,
    challenger_id INTEGER REFERENCES users(id) NOT NULL,
    challenged_id INTEGER REFERENCES users(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
    rules JSONB, -- duel configuration (time limit, putt count, etc.)
    challenger_session_id VARCHAR(255) REFERENCES sessions(session_id),
    challenged_session_id VARCHAR(255) REFERENCES sessions(session_id),
    winner_id INTEGER REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (challenger_id != challenged_id)
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    league_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    league_type VARCHAR(50) DEFAULT 'weekly', -- 'weekly', 'monthly', 'season'
    status VARCHAR(20) DEFAULT 'active', -- 'draft', 'active', 'completed', 'cancelled'
    rules JSONB, -- league configuration
    max_members INTEGER DEFAULT 50,
    entry_fee DECIMAL(10,2) DEFAULT 0,
    prize_pool DECIMAL(10,2) DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- League memberships
CREATE TABLE IF NOT EXISTS league_memberships (
    league_id INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (league_id, player_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_makes ON player_stats(total_makes DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_streak ON player_stats(best_streak DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_percentage ON player_stats(make_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_sessions ON player_stats(total_sessions DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_expires ON leaderboard_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_duels_challenged ON duels(challenged_id);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_context_memberships_player ON context_memberships(player_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add some test data for immediate leaderboard testing
-- This will give us data to work with right away
DO $$
BEGIN
    -- Only add test data if we don't have existing player_stats
    IF NOT EXISTS (SELECT 1 FROM player_stats WHERE total_putts > 0) THEN
        INSERT INTO player_stats (player_id, total_sessions, total_putts, total_makes, total_misses, make_percentage, best_streak, last_session_at) VALUES
        (1, 15, 450, 327, 123, 72.67, 12, NOW() - INTERVAL '2 hours'),
        (2, 8, 240, 156, 84, 65.00, 8, NOW() - INTERVAL '1 day'),
        (3, 22, 660, 509, 151, 77.12, 15, NOW() - INTERVAL '3 hours')
        ON CONFLICT (player_id) DO UPDATE SET
            total_sessions = EXCLUDED.total_sessions,
            total_putts = EXCLUDED.total_putts,
            total_makes = EXCLUDED.total_makes,
            total_misses = EXCLUDED.total_misses,
            make_percentage = EXCLUDED.make_percentage,
            best_streak = GREATEST(player_stats.best_streak, EXCLUDED.best_streak),
            last_session_at = EXCLUDED.last_session_at,
            updated_at = NOW();
    END IF;
END
$$;