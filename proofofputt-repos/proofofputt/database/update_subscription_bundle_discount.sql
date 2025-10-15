-- Update the discount for the 5-pack subscription bundle to be 20% as per the new pricing.
UPDATE subscription_bundles SET discount_percentage = 20.00 WHERE quantity = 5;
