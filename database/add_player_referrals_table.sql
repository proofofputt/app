-- Create player referrals tracking table for viral growth system
-- This table tracks who referred each new player for analytics and rewards

-- Create player_referrals table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_referrals (
    referral_id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    referred_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    referral_source VARCHAR(50) DEFAULT 'duel_invitation', -- duel_invitation, league_invitation, direct_link, etc.
    referral_code VARCHAR(100), -- For future referral code system
    reward_claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate referrals
    UNIQUE(referrer_id, referred_player_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_referrals_referrer_id ON player_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_player_referrals_referred_player_id ON player_referrals(referred_player_id);
CREATE INDEX IF NOT EXISTS idx_player_referrals_created_at ON player_referrals(created_at);
CREATE INDEX IF NOT EXISTS idx_player_referrals_source ON player_referrals(referral_source);

-- Add columns to players table for referral tracking
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS referred_by_player_id INTEGER REFERENCES players(player_id),
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- Generate unique referral codes for existing players
-- Format: First 3 letters of name + last 4 digits of player_id
UPDATE players 
SET referral_code = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3)) || LPAD((player_id % 10000)::text, 4, '0')
WHERE referral_code IS NULL;

-- Create trigger to update total_referrals count
CREATE OR REPLACE FUNCTION update_referral_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE players 
        SET total_referrals = total_referrals + 1,
            updated_at = NOW()
        WHERE player_id = NEW.referrer_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE players 
        SET total_referrals = GREATEST(total_referrals - 1, 0),
            updated_at = NOW()
        WHERE player_id = OLD.referrer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for referral count updates
DROP TRIGGER IF EXISTS referral_count_trigger ON player_referrals;
CREATE TRIGGER referral_count_trigger
    AFTER INSERT OR DELETE ON player_referrals
    FOR EACH ROW EXECUTE FUNCTION update_referral_count();

-- Verify the tables exist
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('player_referrals', 'players') 
AND column_name IN ('referral_id', 'referrer_id', 'referred_player_id', 'referral_source', 'total_referrals', 'referral_code')
ORDER BY table_name, column_name;