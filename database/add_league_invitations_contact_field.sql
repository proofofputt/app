-- Add invited_contact field to league_invitations table
-- This allows inviting new players by email or phone who don't have accounts yet

ALTER TABLE league_invitations
ADD COLUMN IF NOT EXISTS invited_contact VARCHAR(255);

-- Create index for looking up invitations by contact
CREATE INDEX IF NOT EXISTS idx_league_invitations_contact
ON league_invitations(invited_contact)
WHERE invited_contact IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN league_invitations.invited_contact IS 'Email or phone number for invitations to new players who don''t have accounts yet. NULL for invitations to existing players (use invited_player_id instead).';

-- Update constraint to allow NULL invited_player_id when invited_contact is provided
-- The existing foreign key should already allow NULL, but let's ensure it
ALTER TABLE league_invitations
ALTER COLUMN invited_player_id DROP NOT NULL;

-- Add check constraint to ensure either invited_player_id OR invited_contact is provided
ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_invitee_check
CHECK (
  (invited_player_id IS NOT NULL AND invited_contact IS NULL) OR
  (invited_player_id IS NULL AND invited_contact IS NOT NULL)
);
