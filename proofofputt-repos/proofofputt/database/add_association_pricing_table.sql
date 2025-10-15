-- Association Pricing Requests Table
-- This table stores contact form submissions from golf clubs, associations,
-- and enterprises requesting custom pricing for bulk subscriptions.

CREATE TABLE IF NOT EXISTS association_pricing_requests (
    id SERIAL PRIMARY KEY,

    -- Contact Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),

    -- Organization Details
    club_name VARCHAR(255),
    office_address TEXT,

    -- Requirements
    number_of_users INTEGER NOT NULL CHECK (number_of_users > 0),
    comments TEXT NOT NULL,

    -- Additional Services
    onboarding_support BOOLEAN DEFAULT FALSE,
    implementation_support BOOLEAN DEFAULT FALSE,
    event_management BOOLEAN DEFAULT FALSE,

    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'quoted', 'converted', 'declined')),

    -- Sales Team Notes (optional future enhancement)
    internal_notes TEXT,
    assigned_to INTEGER REFERENCES players(player_id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contacted_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups by status
CREATE INDEX IF NOT EXISTS idx_association_pricing_status
ON association_pricing_requests(status);

-- Index for email lookups (to prevent duplicate submissions)
CREATE INDEX IF NOT EXISTS idx_association_pricing_email
ON association_pricing_requests(email);

-- Index for created date (for reporting)
CREATE INDEX IF NOT EXISTS idx_association_pricing_created
ON association_pricing_requests(created_at DESC);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_association_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_association_pricing_updated_at
    BEFORE UPDATE ON association_pricing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_association_pricing_updated_at();

-- View for pending requests (for sales team dashboard)
CREATE OR REPLACE VIEW pending_association_requests AS
SELECT
    id,
    name,
    email,
    phone,
    club_name,
    number_of_users,
    comments,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS hours_since_request
FROM association_pricing_requests
WHERE status = 'pending'
ORDER BY created_at ASC;

COMMENT ON TABLE association_pricing_requests IS 'Contact form submissions for association/enterprise pricing';
COMMENT ON COLUMN association_pricing_requests.number_of_users IS 'Minimum 1, default 50 in form';
COMMENT ON COLUMN association_pricing_requests.status IS 'Lifecycle: pending → contacted → quoted → converted/declined';
