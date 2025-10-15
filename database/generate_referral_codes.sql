-- Generate referral codes for all players that don't have one
UPDATE players
SET referral_code = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3)) || LPAD((player_id % 10000)::text, 4, '0')
WHERE referral_code IS NULL OR referral_code = '';

-- Verify the update
SELECT player_id, name, referral_code
FROM players
ORDER BY player_id
LIMIT 10;
