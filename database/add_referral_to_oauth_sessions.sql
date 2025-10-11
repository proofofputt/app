-- Add referral_code column to oauth_sessions table to preserve referral attribution through OAuth flow
ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- Verify the column was added
\d oauth_sessions;
