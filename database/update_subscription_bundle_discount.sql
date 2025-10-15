-- Update Subscription Bundle Discounts
-- Date: 2025-10-04
-- Description: Updates discount percentages for subscription bundles

-- Update existing bundle discounts (if bundles already exist)
UPDATE subscription_bundles SET discount_percentage = 10.00 WHERE name = '3-Pack';
UPDATE subscription_bundles SET discount_percentage = 20.00 WHERE name = '5-Pack';
UPDATE subscription_bundles SET discount_percentage = 42.00 WHERE name = '10-Pack';
UPDATE subscription_bundles SET discount_percentage = 50.00 WHERE name = '21-Pack';
