-- Create fundraisers table for community fundraising campaigns
-- This table stores fundraising campaigns created by premium/regular members

CREATE TABLE IF NOT EXISTS fundraisers (
    fundraiser_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    goal_amount DECIMAL(10,2) NOT NULL CHECK (goal_amount > 0),
    amount_raised DECIMAL(10,2) DEFAULT 0.00 CHECK (amount_raised >= 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    created_by INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (created_by) REFERENCES players(player_id)
);

-- Donations table for tracking individual donations
CREATE TABLE IF NOT EXISTS donations (
    donation_id SERIAL PRIMARY KEY,
    fundraiser_id INTEGER NOT NULL,
    donor_id INTEGER, -- NULL for anonymous donations
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    message TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(fundraiser_id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES players(player_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fundraisers_created_by ON fundraisers(created_by);
CREATE INDEX IF NOT EXISTS idx_fundraisers_status ON fundraisers(status);
CREATE INDEX IF NOT EXISTS idx_fundraisers_end_date ON fundraisers(end_date);
CREATE INDEX IF NOT EXISTS idx_fundraisers_created_at ON fundraisers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_fundraiser_id ON donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

-- Create a view that includes player names for easy querying
CREATE OR REPLACE VIEW fundraisers_with_organizer AS
SELECT 
    f.*,
    p.name as player_name,
    p.email as organizer_email,
    COALESCE(d.total_donated, 0.00) as calculated_amount_raised,
    COALESCE(d.donation_count, 0) as donation_count
FROM fundraisers f
JOIN players p ON f.created_by = p.player_id
LEFT JOIN (
    SELECT 
        fundraiser_id,
        SUM(amount) as total_donated,
        COUNT(*) as donation_count
    FROM donations
    GROUP BY fundraiser_id
) d ON f.fundraiser_id = d.fundraiser_id;

-- Function to update amount_raised when donations are added
CREATE OR REPLACE FUNCTION update_fundraiser_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE fundraisers 
    SET 
        amount_raised = COALESCE((
            SELECT SUM(amount) 
            FROM donations 
            WHERE fundraiser_id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id)
        ), 0.00),
        updated_at = NOW()
    WHERE fundraiser_id = COALESCE(NEW.fundraiser_id, OLD.fundraiser_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update amount_raised
CREATE TRIGGER trigger_update_fundraiser_amount_insert
    AFTER INSERT ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_amount();

CREATE TRIGGER trigger_update_fundraiser_amount_update
    AFTER UPDATE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_amount();

CREATE TRIGGER trigger_update_fundraiser_amount_delete
    AFTER DELETE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_fundraiser_amount();

-- Insert sample fundraising campaigns for testing
INSERT INTO fundraisers (title, description, goal_amount, end_date, created_by, status) VALUES
    ('New Putting Equipment', 'Help us purchase professional-grade putting equipment for our community practice sessions. We need mats, training aids, and portable putting greens.', 500.00, CURRENT_DATE + INTERVAL '30 days', 1, 'active'),
    ('Club Tournament Prize Fund', 'Building a prize fund for our quarterly putting tournaments. Winner takes 60%, runner-up gets 30%, third place receives 10%.', 1000.00, CURRENT_DATE + INTERVAL '45 days', 1, 'active'),
    ('Youth Golf Program', 'Supporting young golfers in our community with equipment, lessons, and tournament fees. Every dollar helps a kid learn the beautiful game of golf.', 750.00, CURRENT_DATE + INTERVAL '60 days', 2, 'active')
ON CONFLICT DO NOTHING;

-- Insert sample donations for testing
INSERT INTO donations (fundraiser_id, donor_id, amount, message, is_anonymous) VALUES
    (1, 2, 25.00, 'Great cause! Happy to help.', FALSE),
    (1, 1, 50.00, 'Love seeing community support', FALSE),
    (2, 2, 100.00, 'Let''s make this tournament epic!', FALSE),
    (3, 1, 75.00, NULL, TRUE)
ON CONFLICT DO NOTHING;