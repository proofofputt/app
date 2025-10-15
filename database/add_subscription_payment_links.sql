-- Subscription Payment Link Mapping
-- Maps Zaprite payment links to subscription types

CREATE TABLE IF NOT EXISTS zaprite_subscription_links (
  id SERIAL PRIMARY KEY,
  payment_link_id VARCHAR(255) UNIQUE NOT NULL,
  subscription_type VARCHAR(50) NOT NULL,  -- 'monthly' or 'annual'
  amount DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  includes_gift BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert subscription payment links
INSERT INTO zaprite_subscription_links (payment_link_id, subscription_type, amount, billing_cycle, includes_gift)
VALUES
  ('pl_F32s4VbLaN', 'monthly', 2.10, 'monthly', FALSE),
  ('pl_NC6B3oH3dJ', 'annual', 21.00, 'annual', TRUE)
ON CONFLICT (payment_link_id) DO UPDATE SET
  amount = EXCLUDED.amount,
  billing_cycle = EXCLUDED.billing_cycle,
  includes_gift = EXCLUDED.includes_gift,
  updated_at = CURRENT_TIMESTAMP;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscription_payment_link ON zaprite_subscription_links(payment_link_id);

-- Comment
COMMENT ON TABLE zaprite_subscription_links IS 'Maps Zaprite payment links to subscription configurations';
