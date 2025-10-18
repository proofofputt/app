-- Add 5-level referral tracking to players table
-- This enables multi-level marketing (MLM) style referral chain tracking
-- Each player can see their entire upline (5 levels of referrers)

-- Add referral level columns (denormalized for performance)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS referrer_level_1 INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referrer_level_2 INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referrer_level_3 INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referrer_level_4 INTEGER REFERENCES players(player_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referrer_level_5 INTEGER REFERENCES players(player_id) ON DELETE SET NULL;

-- Create indexes for efficient querying of referral chains
CREATE INDEX IF NOT EXISTS idx_players_referrer_l1 ON players(referrer_level_1);
CREATE INDEX IF NOT EXISTS idx_players_referrer_l2 ON players(referrer_level_2);
CREATE INDEX IF NOT EXISTS idx_players_referrer_l3 ON players(referrer_level_3);
CREATE INDEX IF NOT EXISTS idx_players_referrer_l4 ON players(referrer_level_4);
CREATE INDEX IF NOT EXISTS idx_players_referrer_l5 ON players(referrer_level_5);

-- Add comments for documentation
COMMENT ON COLUMN players.referrer_level_1 IS 'Direct referrer (immediate upline)';
COMMENT ON COLUMN players.referrer_level_2 IS 'Referrer of referrer (2nd level upline)';
COMMENT ON COLUMN players.referrer_level_3 IS '3rd level upline in referral chain';
COMMENT ON COLUMN players.referrer_level_4 IS '4th level upline in referral chain';
COMMENT ON COLUMN players.referrer_level_5 IS '5th level upline in referral chain';

-- Function to automatically populate referral chain when new player signs up
CREATE OR REPLACE FUNCTION populate_referral_chain()
RETURNS TRIGGER AS $$
BEGIN
    -- Only populate if the player was referred by someone
    IF NEW.referred_by_player_id IS NOT NULL THEN
        -- Level 1: Direct referrer
        NEW.referrer_level_1 := NEW.referred_by_player_id;

        -- Levels 2-5: Walk up the referral chain from the direct referrer
        SELECT
            referrer_level_1,  -- This becomes our level 2
            referrer_level_2,  -- This becomes our level 3
            referrer_level_3,  -- This becomes our level 4
            referrer_level_4   -- This becomes our level 5
        INTO
            NEW.referrer_level_2,
            NEW.referrer_level_3,
            NEW.referrer_level_4,
            NEW.referrer_level_5
        FROM players
        WHERE player_id = NEW.referred_by_player_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate referral chain on INSERT
DROP TRIGGER IF EXISTS trigger_populate_referral_chain ON players;
CREATE TRIGGER trigger_populate_referral_chain
    BEFORE INSERT ON players
    FOR EACH ROW
    EXECUTE FUNCTION populate_referral_chain();

-- Function to backfill referral chains for existing players
CREATE OR REPLACE FUNCTION backfill_referral_chains()
RETURNS void AS $$
DECLARE
    player_record RECORD;
    rows_updated INTEGER := 0;
BEGIN
    -- Process players in chronological order (oldest first)
    -- This ensures parent referrers are processed before their referrals
    FOR player_record IN
        SELECT player_id, referred_by_player_id
        FROM players
        WHERE referred_by_player_id IS NOT NULL
        AND referrer_level_1 IS NULL  -- Only process players that haven't been backfilled yet
        ORDER BY created_at ASC
    LOOP
        -- Update the player's referral chain based on their direct referrer's chain
        UPDATE players p
        SET
            referrer_level_1 = player_record.referred_by_player_id,
            referrer_level_2 = r1.referrer_level_1,
            referrer_level_3 = r1.referrer_level_2,
            referrer_level_4 = r1.referrer_level_3,
            referrer_level_5 = r1.referrer_level_4
        FROM players r1
        WHERE p.player_id = player_record.player_id
        AND r1.player_id = player_record.referred_by_player_id;

        rows_updated := rows_updated + 1;
    END LOOP;

    RAISE NOTICE 'Backfilled referral chains for % players', rows_updated;
END;
$$ LANGUAGE plpgsql;

-- Execute backfill for existing players
SELECT backfill_referral_chains();

-- Verify the migration worked
SELECT
    'Total players' as metric,
    COUNT(*) as count
FROM players
UNION ALL
SELECT
    'Players with Level 1 referrer' as metric,
    COUNT(*) as count
FROM players
WHERE referrer_level_1 IS NOT NULL
UNION ALL
SELECT
    'Players with Level 2 referrer' as metric,
    COUNT(*) as count
FROM players
WHERE referrer_level_2 IS NOT NULL
UNION ALL
SELECT
    'Players with Level 3 referrer' as metric,
    COUNT(*) as count
FROM players
WHERE referrer_level_3 IS NOT NULL
UNION ALL
SELECT
    'Players with Level 4 referrer' as metric,
    COUNT(*) as count
FROM players
WHERE referrer_level_4 IS NOT NULL
UNION ALL
SELECT
    'Players with Level 5 referrer' as metric,
    COUNT(*) as count
FROM players
WHERE referrer_level_5 IS NOT NULL;
