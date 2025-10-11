-- NeonDB SQL Editor Script: List All Users
-- Copy and paste this into NeonDB SQL Editor to see all users who have signed up
-- This script shows comprehensive user information including subscription status

-- Main user listing with all relevant fields
SELECT
    p.player_id,
    p.email,
    p.name,
    p.membership_tier,
    p.is_subscribed,
    p.subscription_status,
    p.subscription_expires_at,
    p.subscription_tier,
    p.zaprite_customer_id,
    p.created_at,
    p.updated_at,
    -- Check if user has active session
    CASE
        WHEN s.token IS NOT NULL THEN 'Active'
        ELSE 'Inactive'
    END as session_status,
    s.last_activity as last_login
FROM players p
LEFT JOIN sessions s ON p.player_id = s.player_id
ORDER BY p.player_id;

-- Summary statistics
SELECT
    'Total Users' as metric,
    COUNT(*) as count
FROM players

UNION ALL

SELECT
    'Subscribed Users' as metric,
    COUNT(*) as count
FROM players
WHERE is_subscribed = TRUE

UNION ALL

SELECT
    'Active Sessions' as metric,
    COUNT(DISTINCT player_id) as count
FROM sessions

UNION ALL

SELECT
    'Premium Tier' as metric,
    COUNT(*) as count
FROM players
WHERE membership_tier = 'premium'

UNION ALL

SELECT
    'Regular Tier' as metric,
    COUNT(*) as count
FROM players
WHERE membership_tier = 'regular'

UNION ALL

SELECT
    'Basic Tier' as metric,
    COUNT(*) as count
FROM players
WHERE membership_tier = 'basic'

UNION ALL

SELECT
    'Free Tier' as metric,
    COUNT(*) as count
FROM players
WHERE membership_tier = 'free' OR membership_tier IS NULL;

-- Users with gift codes
SELECT
    p.player_id,
    p.email,
    p.name,
    COUNT(ugs.id) as total_gift_codes,
    SUM(CASE WHEN ugs.is_redeemed THEN 1 ELSE 0 END) as redeemed_codes,
    SUM(CASE WHEN NOT ugs.is_redeemed THEN 1 ELSE 0 END) as available_codes
FROM players p
LEFT JOIN user_gift_subscriptions ugs ON p.player_id = ugs.owner_user_id
GROUP BY p.player_id, p.email, p.name
HAVING COUNT(ugs.id) > 0
ORDER BY p.player_id;

-- Recent signups (last 30 days)
SELECT
    player_id,
    email,
    name,
    membership_tier,
    created_at,
    AGE(NOW(), created_at) as account_age
FROM players
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Users with active subscriptions
SELECT
    player_id,
    email,
    name,
    subscription_tier,
    subscription_status,
    subscription_expires_at,
    CASE
        WHEN subscription_expires_at > NOW() THEN 'Valid'
        WHEN subscription_expires_at <= NOW() THEN 'Expired'
        ELSE 'No Expiration'
    END as expiration_status,
    created_at
FROM players
WHERE is_subscribed = TRUE
ORDER BY subscription_expires_at DESC;
