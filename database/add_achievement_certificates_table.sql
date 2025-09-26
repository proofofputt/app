-- Achievement Certificates Table for OpenTimestamps Blockchain Verification
-- This table stores blockchain-verified achievement certificates

-- Main certificate table
CREATE TABLE IF NOT EXISTS achievement_certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,

    -- Achievement details
    achievement_type VARCHAR(50) NOT NULL, -- 'consecutive_makes', 'perfect_session', 'competition_win', 'career_milestone', 'accuracy_milestone'
    achievement_value INTEGER NOT NULL,   -- The numeric value (21 consecutive, 1000 career makes, etc.)
    achievement_subtype VARCHAR(50),      -- Additional context like 'first_duel_victory', 'league_championship'

    -- Achievement context
    session_id VARCHAR(255),              -- The session where the achievement occurred
    achieved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    achievement_data JSONB NOT NULL,      -- Full achievement details and metadata

    -- Blockchain/OpenTimestamps data
    data_hash VARCHAR(64) NOT NULL,       -- SHA256 hash of achievement data
    ots_file BYTEA,                       -- OpenTimestamps proof file (.ots)
    merkle_root VARCHAR(64),              -- Merkle root for batch processing
    batch_id UUID,                        -- Reference to processing batch

    -- Certificate status tracking
    certificate_issued_at TIMESTAMP WITH TIME ZONE,
    bitcoin_block_height INTEGER,         -- Block where timestamp was confirmed
    is_verified BOOLEAN DEFAULT FALSE,    -- Whether blockchain confirmation is complete
    verification_attempted_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure only first instance of each achievement gets a certificate
    UNIQUE(player_id, achievement_type, achievement_value)
);

-- Certificate processing batches (for Satoshi Sunday processing)
CREATE TABLE IF NOT EXISTS certificate_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100) NOT NULL,     -- e.g., "Satoshi Sunday 2025-09-22"
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    certificate_count INTEGER NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    ots_file BYTEA,
    bitcoin_block_height INTEGER,
    total_cost_satoshis INTEGER,          -- Bitcoin network fee cost
    is_confirmed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Certificate queue for weekly batch processing
CREATE TABLE IF NOT EXISTS certificate_queue (
    queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    achievement_value INTEGER NOT NULL,
    achievement_data JSONB NOT NULL,
    session_id VARCHAR(255),
    achieved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_batch_id UUID REFERENCES certificate_batches(batch_id),
    is_processed BOOLEAN DEFAULT FALSE,

    -- Prevent duplicate queue entries
    UNIQUE(player_id, achievement_type, achievement_value)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_achievement_certificates_player_id ON achievement_certificates(player_id);
CREATE INDEX IF NOT EXISTS idx_achievement_certificates_type_value ON achievement_certificates(achievement_type, achievement_value);
CREATE INDEX IF NOT EXISTS idx_achievement_certificates_achieved_at ON achievement_certificates(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_achievement_certificates_verified ON achievement_certificates(is_verified, bitcoin_block_height);

CREATE INDEX IF NOT EXISTS idx_certificate_queue_player_id ON certificate_queue(player_id);
CREATE INDEX IF NOT EXISTS idx_certificate_queue_processed ON certificate_queue(is_processed, queued_at);

CREATE INDEX IF NOT EXISTS idx_certificate_batches_processed_at ON certificate_batches(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificate_batches_confirmed ON certificate_batches(is_confirmed, bitcoin_block_height);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_achievement_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER achievement_certificates_update_trigger
    BEFORE UPDATE ON achievement_certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_achievement_certificates_updated_at();

-- Helper function to check if achievement already has certificate
CREATE OR REPLACE FUNCTION has_achievement_certificate(
    p_player_id INTEGER,
    p_achievement_type VARCHAR(50),
    p_achievement_value INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM achievement_certificates
        WHERE player_id = p_player_id
          AND achievement_type = p_achievement_type
          AND achievement_value = p_achievement_value
    );
END;
$$ LANGUAGE plpgsql;

-- Helper function to queue achievement for certificate
CREATE OR REPLACE FUNCTION queue_achievement_certificate(
    p_player_id INTEGER,
    p_achievement_type VARCHAR(50),
    p_achievement_value INTEGER,
    p_achievement_data JSONB,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS UUID AS $$
DECLARE
    queue_id UUID;
BEGIN
    -- Check if already has certificate or already queued
    IF has_achievement_certificate(p_player_id, p_achievement_type, p_achievement_value) THEN
        RETURN NULL; -- Already has certificate
    END IF;

    -- Insert into queue (ON CONFLICT handles race conditions)
    INSERT INTO certificate_queue (
        player_id, achievement_type, achievement_value,
        achievement_data, session_id, achieved_at
    )
    VALUES (
        p_player_id, p_achievement_type, p_achievement_value,
        p_achievement_data, p_session_id, p_achieved_at
    )
    ON CONFLICT (player_id, achievement_type, achievement_value) DO NOTHING
    RETURNING certificate_queue.queue_id INTO queue_id;

    RETURN queue_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for future reference
COMMENT ON TABLE achievement_certificates IS 'Blockchain-verified achievement certificates using OpenTimestamps';
COMMENT ON COLUMN achievement_certificates.data_hash IS 'SHA256 hash of achievement_data for blockchain timestamping';
COMMENT ON COLUMN achievement_certificates.ots_file IS 'OpenTimestamps proof file for blockchain verification';
COMMENT ON COLUMN achievement_certificates.merkle_root IS 'Merkle root when batched with other certificates';
COMMENT ON TABLE certificate_queue IS 'Queue for achievements awaiting certificate processing on Satoshi Sundays';
COMMENT ON TABLE certificate_batches IS 'Weekly batches of certificates processed together for Bitcoin blockchain timestamping';