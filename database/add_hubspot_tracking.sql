-- Add HubSpot tracking columns to players table
-- This enables syncing Proof of Putt users to HubSpot CRM for marketing automation and prospect management

ALTER TABLE players
ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS hubspot_last_sync_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS hubspot_sync_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_players_hubspot_contact_id ON players(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_players_hubspot_sync_status ON players(hubspot_sync_status);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);

-- Add comment for documentation
COMMENT ON COLUMN players.hubspot_contact_id IS 'HubSpot contact ID for CRM integration';
COMMENT ON COLUMN players.hubspot_last_sync_at IS 'Last time this player record was synced to HubSpot';
COMMENT ON COLUMN players.hubspot_sync_status IS 'Sync status: pending, synced, failed, skipped';
COMMENT ON COLUMN players.first_name IS 'Player first name (for personalization and HubSpot sync)';
COMMENT ON COLUMN players.last_name IS 'Player last name (for personalization and HubSpot sync)';
