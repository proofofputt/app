-- Add zaprite_payment_profile_id column to players table
-- This stores the saved payment method ID for auto-pay monthly subscriptions

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players'
    AND column_name = 'zaprite_payment_profile_id'
  ) THEN
    ALTER TABLE players
    ADD COLUMN zaprite_payment_profile_id VARCHAR(255) DEFAULT NULL;

    -- Add comment for documentation
    COMMENT ON COLUMN players.zaprite_payment_profile_id IS 'Zaprite payment profile ID for auto-pay (saved Square payment method)';

    RAISE NOTICE 'Added zaprite_payment_profile_id column to players table';
  ELSE
    RAISE NOTICE 'Column zaprite_payment_profile_id already exists in players table';
  END IF;
END $$;

-- Create index for faster lookups by payment profile
CREATE INDEX IF NOT EXISTS idx_players_zaprite_payment_profile_id
ON players(zaprite_payment_profile_id)
WHERE zaprite_payment_profile_id IS NOT NULL;

-- Display current subscription-related columns for verification
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
  AND column_name LIKE '%zaprite%'
ORDER BY column_name;
