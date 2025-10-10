-- User Feedback and Comments System
-- Tracks user feedback, suggestions, bug reports with conversation threading

-- Create feedback_threads table
CREATE TABLE IF NOT EXISTS feedback_threads (
  thread_id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'general_feedback',
    'feature_request',
    'bug_report',
    'page_issue',
    'ui_ux',
    'performance',
    'support',
    'other'
  )),
  page_location VARCHAR(100),  -- e.g., 'leagues', 'duels', 'profile', 'leaderboard'
  feature_area VARCHAR(100),   -- e.g., 'invite_system', 'scoring', 'navigation'
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT
);

-- Create feedback_messages table for threaded conversations
CREATE TABLE IF NOT EXISTS feedback_messages (
  message_id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES feedback_threads(thread_id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
  is_admin_response BOOLEAN DEFAULT false,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  attachments JSONB  -- For future file attachments
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_threads_player ON feedback_threads(player_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_status ON feedback_threads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_category ON feedback_threads(category, status);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread ON feedback_messages(thread_id, created_at ASC);

-- Create function to update thread updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feedback_threads
  SET updated_at = NOW()
  WHERE thread_id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update thread timestamp when new message is added
DROP TRIGGER IF EXISTS trigger_update_feedback_thread ON feedback_messages;
CREATE TRIGGER trigger_update_feedback_thread
  AFTER INSERT ON feedback_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_thread_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON feedback_threads TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON feedback_messages TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE feedback_threads_thread_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE feedback_messages_message_id_seq TO PUBLIC;
