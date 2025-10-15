-- Create oauth_sessions table for web OAuth flow
-- This table stores temporary OAuth session state for CSRF protection

CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,  -- 'google', 'linkedin', 'nostr'
  state VARCHAR(255) NOT NULL UNIQUE,  -- CSRF protection token
  mode VARCHAR(20) DEFAULT 'login',  -- 'login' or 'signup'
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on state for fast lookups during callback
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);

-- Create index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

-- Add comment for documentation
COMMENT ON TABLE oauth_sessions IS 'Temporary OAuth session storage for web OAuth flow with CSRF protection';
