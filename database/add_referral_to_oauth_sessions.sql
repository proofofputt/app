-- Add mode and referral_code columns to oauth_sessions table
-- mode: tracks whether OAuth flow is 'login' or 'signup'
-- referral_code: preserves referral attribution through OAuth flow
ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS mode VARCHAR(20),
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'oauth_sessions'
AND column_name IN ('mode', 'referral_code')
ORDER BY column_name;
