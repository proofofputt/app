-- Add admin role support to players table
-- Allows designated users to manage feedback system and respond to user submissions

-- Add is_admin column to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin user lookups
CREATE INDEX IF NOT EXISTS idx_players_admin ON players(is_admin) WHERE is_admin = true;

-- Create index for admin feedback queries (optimized for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_feedback_admin_view
  ON feedback_threads(status, priority, created_at DESC);

-- Add index for unread admin responses (helps users find new admin replies)
CREATE INDEX IF NOT EXISTS idx_feedback_messages_admin_responses
  ON feedback_messages(thread_id, is_admin_response, created_at DESC)
  WHERE is_admin_response = true;

-- Grant permissions
GRANT SELECT, UPDATE ON players TO PUBLIC;

-- Optional: Set initial admin users (uncomment and update player_id as needed)
-- UPDATE players SET is_admin = true WHERE player_id = 1; -- Replace with actual admin player ID
-- UPDATE players SET is_admin = true WHERE email = 'admin@proofofputt.com'; -- Or use email

COMMENT ON COLUMN players.is_admin IS 'Designates admin users who can manage feedback system and respond to user submissions';
