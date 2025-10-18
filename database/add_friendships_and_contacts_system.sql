-- Friendships and Contacts System
-- Automatically creates friendship between referrer and referred player
-- Integrates coach access into the contacts interface

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  friendship_id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,

  -- Friendship metadata
  status VARCHAR(20) DEFAULT 'accepted', -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,

  -- Source of friendship
  source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'referral', 'league', 'duel'
  source_context JSONB, -- Store additional context like league_id, duel_id, etc.

  -- Prevent duplicate friendships
  UNIQUE(player_id, friend_id),

  -- Prevent self-friending
  CHECK (player_id != friend_id)
);

-- Indexes for efficient friendship queries
CREATE INDEX IF NOT EXISTS idx_friendships_player
  ON friendships(player_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend
  ON friendships(friend_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_both
  ON friendships(player_id, friend_id);

-- Function to create bidirectional friendship
CREATE OR REPLACE FUNCTION create_bidirectional_friendship(
  p_player_id INTEGER,
  p_friend_id INTEGER,
  p_source VARCHAR(50) DEFAULT 'manual',
  p_source_context JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Insert friendship from player -> friend
  INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
  VALUES (p_player_id, p_friend_id, 'accepted', NOW(), p_source, p_source_context)
  ON CONFLICT (player_id, friend_id) DO NOTHING;

  -- Insert reverse friendship from friend -> player
  INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
  VALUES (p_friend_id, p_player_id, 'accepted', NOW(), p_source, p_source_context)
  ON CONFLICT (player_id, friend_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-create friendship on referral
CREATE OR REPLACE FUNCTION auto_friend_referrer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-friend if there's a referrer
  IF NEW.referred_by_player_id IS NOT NULL THEN
    -- Create bidirectional friendship between referrer and new player
    PERFORM create_bidirectional_friendship(
      NEW.player_id,
      NEW.referred_by_player_id,
      'referral',
      jsonb_build_object(
        'referral_code', NEW.referral_code,
        'auto_created', true
      )
    );

    RAISE NOTICE 'Auto-created friendship: Player % <-> Referrer %', NEW.player_id, NEW.referred_by_player_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on players table
DROP TRIGGER IF EXISTS trigger_auto_friend_referrer ON players;

CREATE TRIGGER trigger_auto_friend_referrer
  AFTER INSERT ON players
  FOR EACH ROW
  WHEN (NEW.referred_by_player_id IS NOT NULL)
  EXECUTE FUNCTION auto_friend_referrer();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON friendships TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE friendships_friendship_id_seq TO PUBLIC;
GRANT EXECUTE ON FUNCTION create_bidirectional_friendship TO PUBLIC;

-- Backfill existing referrals as friendships
-- This creates friendships for all existing referral relationships
INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
SELECT
  p.player_id,
  p.referred_by_player_id,
  'accepted',
  p.created_at, -- Use signup date as friendship date
  'referral',
  jsonb_build_object('referral_code', r.referral_code, 'backfilled', true)
FROM players p
INNER JOIN players r ON p.referred_by_player_id = r.player_id
WHERE p.referred_by_player_id IS NOT NULL
ON CONFLICT (player_id, friend_id) DO NOTHING;

-- Create reverse friendships for backfill
INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
SELECT
  p.referred_by_player_id,
  p.player_id,
  'accepted',
  p.created_at,
  'referral',
  jsonb_build_object('referral_code', r.referral_code, 'backfilled', true)
FROM players p
INNER JOIN players r ON p.referred_by_player_id = r.player_id
WHERE p.referred_by_player_id IS NOT NULL
ON CONFLICT (player_id, friend_id) DO NOTHING;

-- Verification queries
SELECT 'Friendships table created' as status;

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'friendships'
ORDER BY ordinal_position;

-- Show sample of auto-created friendships
SELECT
  f.friendship_id,
  p1.display_name as player,
  p2.display_name as friend,
  f.source,
  f.created_at
FROM friendships f
INNER JOIN players p1 ON f.player_id = p1.player_id
INNER JOIN players p2 ON f.friend_id = p2.player_id
WHERE f.source = 'referral'
LIMIT 10;
