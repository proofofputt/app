-- Fix league_invitations unique constraint
-- The current constraint prevents re-inviting players who have declined/expired invitations
-- We only want to prevent duplicate PENDING invitations

-- Drop the existing constraint
ALTER TABLE league_invitations
DROP CONSTRAINT IF EXISTS league_invitations_league_id_league_invited_player_id_invitati_key;

-- Add a partial unique index that only applies to pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_invitations_pending_unique
ON league_invitations(league_id, league_invited_player_id)
WHERE invitation_status = 'pending';

-- This allows:
-- 1. Multiple declined/expired invitations for the same player
-- 2. Re-inviting a player after they declined
-- 3. Only prevents duplicate pending invitations
