-- Backfill existing referrals as friendships
-- This creates friendships for all existing referral relationships

-- Backfill friendships: referred player -> referrer
INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
SELECT
  p.player_id,
  p.referred_by_player_id,
  'accepted',
  p.created_at, -- Use signup date as friendship date
  'referral',
  jsonb_build_object('referral_code', p.referral_code, 'backfilled', true)
FROM players p
WHERE p.referred_by_player_id IS NOT NULL
ON CONFLICT (player_id, friend_id) DO NOTHING;

-- Create reverse friendships: referrer -> referred player
INSERT INTO friendships (player_id, friend_id, status, accepted_at, source, source_context)
SELECT
  p.referred_by_player_id,
  p.player_id,
  'accepted',
  p.created_at,
  'referral',
  jsonb_build_object('referral_code', p.referral_code, 'backfilled', true)
FROM players p
WHERE p.referred_by_player_id IS NOT NULL
ON CONFLICT (player_id, friend_id) DO NOTHING;

-- Verification: show count of backfilled friendships
SELECT
  COUNT(*) as total_friendships,
  COUNT(*) / 2 as unique_relationships
FROM friendships
WHERE source = 'referral';

-- Show sample of auto-created friendships
SELECT
  f.friendship_id,
  COALESCE(p1.display_name, p1.name, p1.email) as player,
  COALESCE(p2.display_name, p2.name, p2.email) as friend,
  f.source,
  f.created_at
FROM friendships f
INNER JOIN players p1 ON f.player_id = p1.player_id
INNER JOIN players p2 ON f.friend_id = p2.player_id
WHERE f.source = 'referral'
LIMIT 10;
