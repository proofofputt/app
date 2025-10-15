-- ============================================================================
-- Club Outreach Tracking & CRM Integration
-- ============================================================================
-- Adds columns to track outreach efforts and integrates with HubSpot CRM
-- for remote call center operations
-- ============================================================================

-- Add outreach tracking columns to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS primary_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS primary_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_contact_notes TEXT,
ADD COLUMN IF NOT EXISTS outreach_status VARCHAR(50) DEFAULT 'not_contacted', -- not_contacted, contacted, interested, not_interested, representative_claimed
ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES players(player_id),
ADD COLUMN IF NOT EXISTS outreach_priority INTEGER DEFAULT 5, -- 1-10, higher = more important
ADD COLUMN IF NOT EXISTS last_synced_to_crm TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_synced_from_crm TIMESTAMP;

-- Create index for outreach queries
CREATE INDEX IF NOT EXISTS idx_clubs_outreach_status ON clubs(outreach_status);
CREATE INDEX IF NOT EXISTS idx_clubs_assigned_to ON clubs(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_clubs_hubspot_id ON clubs(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_clubs_last_contact ON clubs(last_contact_date);

-- ============================================================================
-- Pending Club Updates (Approval Queue)
-- ============================================================================
-- Stores updates from HubSpot that require admin approval before updating
-- the production database
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_club_updates (
  update_id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'hubspot', -- hubspot, manual, api
  source_user_email VARCHAR(255), -- Email of HubSpot user who made the change
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by_admin_id INTEGER REFERENCES players(player_id),
  review_notes TEXT,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_pending_updates_club ON pending_club_updates(club_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON pending_club_updates(status);
CREATE INDEX IF NOT EXISTS idx_pending_updates_created ON pending_club_updates(created_at DESC);

-- ============================================================================
-- CRM Sync Log
-- ============================================================================
-- Audit log of all CRM synchronization events
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_sync_log (
  log_id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- webhook_received, data_pushed, approval_applied
  club_id INTEGER REFERENCES clubs(club_id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  source VARCHAR(50) NOT NULL, -- hubspot, admin_panel
  payload JSONB,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_log_club ON crm_sync_log(club_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_created ON crm_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_type ON crm_sync_log(sync_type);

-- ============================================================================
-- Club Outreach Activity Log
-- ============================================================================
-- Detailed log of all outreach activities (calls, emails, meetings)
-- Synced from HubSpot engagement data
-- ============================================================================

CREATE TABLE IF NOT EXISTS club_outreach_activities (
  activity_id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  hubspot_engagement_id VARCHAR(50) UNIQUE,
  activity_type VARCHAR(50) NOT NULL, -- call, email, meeting, note
  subject VARCHAR(500),
  body TEXT,
  outcome VARCHAR(100), -- connected, left_voicemail, no_answer, email_sent, etc.
  duration_seconds INTEGER, -- for calls and meetings
  created_by_user_id INTEGER REFERENCES players(player_id),
  created_by_email VARCHAR(255), -- HubSpot user email
  activity_date TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outreach_activities_club ON club_outreach_activities(club_id);
CREATE INDEX IF NOT EXISTS idx_outreach_activities_date ON club_outreach_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_activities_type ON club_outreach_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_outreach_activities_hubspot ON club_outreach_activities(hubspot_engagement_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON COLUMN clubs.hubspot_contact_id IS 'HubSpot contact ID for CRM sync';
COMMENT ON COLUMN clubs.outreach_status IS 'Current status of outreach efforts';
COMMENT ON COLUMN clubs.outreach_priority IS 'Priority level for outreach (1-10)';
COMMENT ON TABLE pending_club_updates IS 'Approval queue for club data updates from HubSpot';
COMMENT ON TABLE crm_sync_log IS 'Audit log of all CRM synchronization events';
COMMENT ON TABLE club_outreach_activities IS 'Log of all outreach activities synced from HubSpot';
