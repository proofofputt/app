-- Admin Action Logs Table
-- Track all admin actions for audit trail and accountability

CREATE TABLE IF NOT EXISTS admin_action_logs (
  log_id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES players(player_id),
  action_type VARCHAR(100) NOT NULL,  -- e.g., 'manual_gift_code_generation', 'subscription_cancel', 'refund_issued'
  target_type VARCHAR(50),  -- e.g., 'player', 'order', 'subscription'
  target_id VARCHAR(255),
  action_data JSONB,  -- Additional data about the action
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action_type ON admin_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target ON admin_action_logs(target_type, target_id);

-- Add comment
COMMENT ON TABLE admin_action_logs IS 'Audit trail for all admin actions in the subscription management system';
COMMENT ON COLUMN admin_action_logs.action_data IS 'JSONB field containing details about the admin action';
