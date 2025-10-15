-- Fix leagues.created_by foreign key constraint
-- The constraint is currently pointing to users.id instead of players.player_id

-- Drop the incorrect foreign key constraint
ALTER TABLE leagues
DROP CONSTRAINT IF EXISTS leagues_created_by_fkey;

-- Add the correct foreign key constraint pointing to players.player_id
ALTER TABLE leagues
ADD CONSTRAINT leagues_created_by_fkey
FOREIGN KEY (created_by) REFERENCES players(player_id) ON DELETE SET NULL;

-- Verify the fix
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'leagues'
  AND kcu.column_name = 'created_by';
