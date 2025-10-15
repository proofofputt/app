-- OAuth Support Schema Migration
-- Adds OAuth authentication support to existing players table
-- Run this migration to enable Google, LinkedIn, and Nostr authentication

-- Add OAuth provider fields to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS oauth_providers JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS nostr_pubkey VARCHAR(128) UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS oauth_profile JSONB DEFAULT '{}';

-- Create OAuth tokens table for refresh tokens and session management
CREATE TABLE IF NOT EXISTS oauth_tokens (
    token_id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'linkedin', 'nostr'
    access_token TEXT,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, provider)
);

-- Create OAuth authentication sessions table
CREATE TABLE IF NOT EXISTS oauth_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    player_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    state VARCHAR(255) NOT NULL,
    code_verifier VARCHAR(255), -- For PKCE (Google)
    redirect_uri TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_google_id ON players(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_linkedin_id ON players(linkedin_id) WHERE linkedin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_nostr_pubkey ON players(nostr_pubkey) WHERE nostr_pubkey IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_player_provider ON oauth_tokens(player_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_player ON oauth_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);

-- Add comments for documentation
COMMENT ON COLUMN players.oauth_providers IS 'JSONB object tracking which OAuth providers are linked: {"google": true, "linkedin": true, "nostr": false}';
COMMENT ON COLUMN players.oauth_profile IS 'JSONB object storing OAuth profile data like verified email, profile picture URL, etc.';
COMMENT ON COLUMN players.google_id IS 'Google OAuth unique identifier (sub claim from Google JWT)';
COMMENT ON COLUMN players.linkedin_id IS 'LinkedIn OAuth unique identifier';
COMMENT ON COLUMN players.nostr_pubkey IS 'Nostr public key for decentralized authentication';
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth access and refresh tokens for each provider';
COMMENT ON TABLE oauth_sessions IS 'Temporary OAuth authentication sessions for CSRF protection and state management';

-- Function to clean up expired OAuth sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update OAuth provider status
CREATE OR REPLACE FUNCTION update_oauth_providers(p_player_id INTEGER, p_provider VARCHAR(50), p_status BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE players 
    SET oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || jsonb_build_object(p_provider, p_status),
        updated_at = NOW()
    WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_sessions TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE oauth_tokens_token_id_seq TO your_app_user;

-- Example usage queries (commented out for safety):
-- 
-- -- Link Google account to existing player
-- UPDATE players 
-- SET google_id = 'google-user-123456',
--     oauth_providers = COALESCE(oauth_providers, '{}'::jsonb) || '{"google": true}'::jsonb,
--     avatar_url = 'https://lh3.googleusercontent.com/...'
-- WHERE player_id = 1;
-- 
-- -- Find player by Google ID
-- SELECT player_id, email, display_name FROM players WHERE google_id = 'google-user-123456';
-- 
-- -- Check which OAuth providers a player has linked
-- SELECT player_id, email, oauth_providers FROM players WHERE player_id = 1;