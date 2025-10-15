-- Create player_invitations table for new player duel invites
-- This table handles invitations sent to email addresses or phone numbers for players who don't have accounts yet

CREATE TABLE IF NOT EXISTS player_invitations (
  invitation_id SERIAL PRIMARY KEY,
  inviter_id INTEGER NOT NULL,
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('email', 'phone', 'username')),
  contact_value VARCHAR(255) NOT NULL,
  invitation_type VARCHAR(20) NOT NULL DEFAULT 'duel' CHECK (invitation_type IN ('duel', 'league', 'friend')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '72 hours'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by_player_id INTEGER,
  metadata JSONB,
  
  -- Foreign key constraints
  CONSTRAINT fk_inviter FOREIGN KEY (inviter_id) REFERENCES players(player_id) ON DELETE CASCADE,
  CONSTRAINT fk_accepted_by FOREIGN KEY (accepted_by_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  
  -- Unique constraint to prevent duplicate active invitations
  CONSTRAINT unique_active_invitation UNIQUE (contact_value, invitation_type, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_invitations_inviter ON player_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_player_invitations_contact ON player_invitations(contact_value);
CREATE INDEX IF NOT EXISTS idx_player_invitations_status ON player_invitations(status);
CREATE INDEX IF NOT EXISTS idx_player_invitations_expires ON player_invitations(expires_at);

-- Add column to duels table to reference new player invitations
ALTER TABLE duels 
ADD COLUMN IF NOT EXISTS new_player_invitation_id INTEGER 
REFERENCES player_invitations(invitation_id) ON DELETE SET NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_duels_new_player_invitation ON duels(new_player_invitation_id);

-- Insert sample comment for documentation
COMMENT ON TABLE player_invitations IS 'Stores invitations sent to email/phone for players who do not have accounts yet';
COMMENT ON COLUMN player_invitations.contact_type IS 'Type of contact method: email, phone, or username';
COMMENT ON COLUMN player_invitations.contact_value IS 'The actual email, phone number, or username';
COMMENT ON COLUMN player_invitations.invitation_type IS 'Type of invitation: duel, league, or friend request';
COMMENT ON COLUMN player_invitations.metadata IS 'Additional invitation data (duel settings, league info, etc.)';