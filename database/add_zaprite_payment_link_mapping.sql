-- Zaprite Payment Link to Bundle Mapping
-- Maps payment links to bundle configurations for automatic gift code generation

CREATE TABLE IF NOT EXISTS zaprite_payment_link_bundles (
  id SERIAL PRIMARY KEY,
  payment_link_id VARCHAR(255) UNIQUE NOT NULL,  -- e.g., 'pl_sLPDlcXmej'
  bundle_id INTEGER REFERENCES subscription_bundles(id),
  bundle_name VARCHAR(100) NOT NULL,
  bundle_quantity INTEGER NOT NULL,
  bundle_price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert current payment link mappings
INSERT INTO zaprite_payment_link_bundles (payment_link_id, bundle_id, bundle_name, bundle_quantity, bundle_price)
VALUES
  ('pl_5GiV3AIMVc', 1, '3-Pack', 3, 56.70),
  ('pl_sLPDlcXmej', 2, '5-Pack', 5, 84.00),
  ('pl_qwz5BPb1Th', 3, '10-Pack', 10, 121.00),
  ('pl_c5uK0HOPlu', 4, '21-Pack', 21, 221.00)
ON CONFLICT (payment_link_id) DO NOTHING;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_link_id ON zaprite_payment_link_bundles(payment_link_id);

-- Add comment
COMMENT ON TABLE zaprite_payment_link_bundles IS 'Maps Zaprite payment links to bundle configurations for webhook processing';
