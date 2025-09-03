-- Proof of Putt Database Schema for NeonDB
-- Run this script in your NeonDB SQL console to create the required tables
-- Copy and paste the entire contents below into the NeonDB query editor

-- Sessions table for storing JSON session data
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    player_id INTEGER NOT NULL,
    data JSONB NOT NULL,
    stats_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Premium reports table for storing CSV session data
CREATE TABLE IF NOT EXISTS premium_reports (
    session_id VARCHAR(255) PRIMARY KEY,
    player_id INTEGER NOT NULL,
    report_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_premium_reports_player_id ON premium_reports(player_id);
CREATE INDEX IF NOT EXISTS idx_premium_reports_created_at ON premium_reports(created_at);

-- Optional: Player stats aggregation table (for future use)
CREATE TABLE IF NOT EXISTS player_stats (
    player_id INTEGER PRIMARY KEY,
    total_sessions INTEGER DEFAULT 0,
    total_putts INTEGER DEFAULT 0,
    total_makes INTEGER DEFAULT 0,
    total_misses INTEGER DEFAULT 0,
    make_percentage DECIMAL(5,2) DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_session_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verify tables were created successfully
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sessions', 'premium_reports', 'player_stats');