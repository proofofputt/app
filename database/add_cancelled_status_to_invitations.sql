-- Add 'cancelled' status to league_invitations
-- Allows invit senders to cancel pending invitations

-- First check if constraint exists and what values it allows
DO $$
BEGIN
  -- Try to add the 'cancelled' status to the existing check constraint
  -- This will update the constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_status'
    AND conrelid = 'league_invitations'::regclass
  ) THEN
    ALTER TABLE league_invitations
    DROP CONSTRAINT valid_status;
  END IF;
END $$;

-- Add updated constraint with 'cancelled' status
ALTER TABLE league_invitations
ADD CONSTRAINT valid_status
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- Add comment
COMMENT ON CONSTRAINT valid_status ON league_invitations IS 'Valid invitation statuses: pending (awaiting response), accepted (player joined), declined (player rejected), expired (time limit passed), cancelled (sender cancelled)';
