-- Create a table to define the subscription bundles
CREATE TABLE subscription_bundles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    -- Assuming you have a base price for a single subscription
    -- The final price will be calculated in the application logic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a table to track user-owned gift subscriptions
CREATE TABLE user_gift_subscriptions (
    id SERIAL PRIMARY KEY,
    owner_user_id INT REFERENCES players(id) NOT NULL,
    bundle_id INT REFERENCES subscription_bundles(id), -- Can be null for single gifts like the intro offer
    gift_code VARCHAR(255) UNIQUE NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_user_id INT REFERENCES players(id),
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Populate the subscription_bundles table
INSERT INTO subscription_bundles (name, quantity, discount_percentage) VALUES
('3-Pack', 3, 10.00),
('5-Pack', 5, 21.00),
('10-Pack', 10, 42.00),
('21-Pack', 21, 50.00);

-- Add a column to the players table to track their subscription status
ALTER TABLE players ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
