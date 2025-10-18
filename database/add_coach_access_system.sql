-- Coach Access System
-- Allows students to grant coaches/pros access to their session history and practice data
-- This enables data-driven coaching without requiring league participation

-- Create coach access grants table
CREATE TABLE IF NOT EXISTS coach_access_grants (
  grant_id SERIAL PRIMARY KEY,
  student_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  coach_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,

  -- Access configuration
  access_level VARCHAR(50) DEFAULT 'full_sessions', -- 'full_sessions', 'stats_only', 'current_month'
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'revoked', 'expired'

  -- Relationship context
  notes TEXT, -- Optional note from student about coaching relationship

  -- Ensure one grant per coach-student pair
  UNIQUE(student_player_id, coach_player_id)
);

-- Indexes for efficient coach and student queries
CREATE INDEX IF NOT EXISTS idx_coach_access_coach
  ON coach_access_grants(coach_player_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_coach_access_student
  ON coach_access_grants(student_player_id, status)
  WHERE status = 'active';

-- Index for checking access permissions quickly
CREATE INDEX IF NOT EXISTS idx_coach_access_lookup
  ON coach_access_grants(coach_player_id, student_player_id, status);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON coach_access_grants TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE coach_access_grants_grant_id_seq TO PUBLIC;

-- Verification query
SELECT
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'coach_access_grants'
ORDER BY ordinal_position;
