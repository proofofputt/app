-- Fix league_invitations foreign keys to reference players table instead of users table
-- The system uses player_id values, not user IDs

-- Drop existing foreign key constraints
ALTER TABLE league_invitations
DROP CONSTRAINT IF EXISTS league_invitations_inviting_user_id_fkey;

ALTER TABLE league_invitations
DROP CONSTRAINT IF EXISTS league_invitations_invited_user_id_fkey;

-- Add new foreign key constraints referencing the players table
ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_inviting_user_id_fkey
FOREIGN KEY (inviting_user_id) REFERENCES players(player_id) ON DELETE CASCADE;

ALTER TABLE league_invitations
ADD CONSTRAINT league_invitations_invited_user_id_fkey
FOREIGN KEY (invited_user_id) REFERENCES players(player_id) ON DELETE CASCADE;
