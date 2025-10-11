-- ============================================
-- NEONDB SQL EDITOR: View All Users
-- ============================================
-- Make sure you're connected to database: neondb
-- Copy each query separately into NeonDB SQL Editor
-- ============================================

-- QUERY 1: List all users
-- ============================================
SELECT
    player_id,
    email,
    name,
    membership_tier,
    is_subscribed,
    subscription_status,
    subscription_expires_at,
    created_at,
    updated_at
FROM players
ORDER BY player_id;


-- QUERY 2: User summary statistics
-- ============================================
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_subscribed = TRUE THEN 1 END) as subscribed_users,
    COUNT(CASE WHEN membership_tier = 'premium' THEN 1 END) as premium_users,
    COUNT(CASE WHEN membership_tier = 'regular' THEN 1 END) as regular_users,
    COUNT(CASE WHEN membership_tier = 'basic' THEN 1 END) as basic_users,
    COUNT(CASE WHEN membership_tier = 'free' OR membership_tier IS NULL THEN 1 END) as free_users
FROM players;


-- QUERY 3: Users with active sessions
-- ============================================
SELECT
    p.player_id,
    p.email,
    p.name,
    p.membership_tier,
    s.last_activity
FROM players p
INNER JOIN sessions s ON p.player_id = s.player_id
ORDER BY s.last_activity DESC;


-- QUERY 4: Recent signups (last 7 days)
-- ============================================
SELECT
    player_id,
    email,
    name,
    membership_tier,
    created_at
FROM players
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;


-- QUERY 5: All signups chronologically
-- ============================================
SELECT
    player_id,
    email,
    name,
    membership_tier,
    created_at,
    EXTRACT(DAY FROM NOW() - created_at) as days_since_signup
FROM players
ORDER BY created_at DESC;


-- QUERY 6: Users with gift codes
-- ============================================
SELECT
    p.player_id,
    p.email,
    p.name,
    COUNT(ugs.id) as total_codes,
    SUM(CASE WHEN ugs.is_redeemed = TRUE THEN 1 ELSE 0 END) as redeemed,
    SUM(CASE WHEN ugs.is_redeemed = FALSE THEN 1 ELSE 0 END) as available
FROM players p
LEFT JOIN user_gift_subscriptions ugs ON p.player_id = ugs.owner_user_id
GROUP BY p.player_id, p.email, p.name
ORDER BY total_codes DESC;


-- QUERY 7: All tables in database (verify connection)
-- ============================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
