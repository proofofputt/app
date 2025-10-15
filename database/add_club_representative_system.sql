-- ============================================================================
-- Club Representative System - Database Migration
-- ============================================================================
-- This migration adds comprehensive club/organization management capabilities
-- including club profiles, representatives, subscription bundles, and player
-- affiliations.
--
-- Created: October 15, 2025
-- Status: Production Ready
-- ============================================================================

-- ============================================================================
-- 1. CLUBS TABLE
-- ============================================================================
-- Stores golf courses, clubs, and organizations
-- Initially populated with ~11,600 US golf courses from OpenStreetMap data

CREATE TABLE IF NOT EXISTS clubs (
  club_id SERIAL PRIMARY KEY,

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'pebble-beach-golf-links')
  club_type VARCHAR(50) DEFAULT 'golf_course', -- golf_course, country_club, organization, etc.

  -- Location Data (from OSM CSV)
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postcode VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'USA',
  full_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Contact Information
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),

  -- Social Media Links
  facebook_url VARCHAR(500),
  instagram_url VARCHAR(500),
  twitter_url VARCHAR(500),

  -- OpenStreetMap Data
  osm_id BIGINT UNIQUE, -- Original OpenStreetMap ID
  osm_data JSONB, -- Store original CSV data for reference

  -- Club Settings
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE, -- Admin verification for official clubs
  subscription_bundle_balance INTEGER DEFAULT 0, -- Remaining gifted subscriptions

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_admin_id INTEGER REFERENCES players(player_id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT check_bundle_balance CHECK (subscription_bundle_balance >= 0)
);

-- Indexes for clubs table
CREATE INDEX IF NOT EXISTS idx_clubs_slug ON clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_location ON clubs(address_city, address_state);
CREATE INDEX IF NOT EXISTS idx_clubs_coordinates ON clubs(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_clubs_active ON clubs(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clubs_osm_id ON clubs(osm_id);

-- ============================================================================
-- 2. CLUB REPRESENTATIVES TABLE
-- ============================================================================
-- Links players to clubs as representatives with specific roles

CREATE TABLE IF NOT EXISTS club_representatives (
  rep_id SERIAL PRIMARY KEY,

  -- Relationships
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,

  -- Role & Permissions
  role VARCHAR(50) DEFAULT 'rep', -- 'rep' or 'admin' (admin unlocked with association pricing)

  -- Permissions
  can_invite_players BOOLEAN DEFAULT TRUE,
  can_create_leagues BOOLEAN DEFAULT TRUE,
  can_grant_subscriptions BOOLEAN DEFAULT TRUE,
  can_manage_reps BOOLEAN DEFAULT TRUE, -- All reps can add other reps

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by_player_id INTEGER REFERENCES players(player_id),

  -- Constraints
  CONSTRAINT unique_club_rep UNIQUE(club_id, player_id)
);

-- Indexes for club_representatives table
CREATE INDEX IF NOT EXISTS idx_club_reps_club ON club_representatives(club_id);
CREATE INDEX IF NOT EXISTS idx_club_reps_player ON club_representatives(player_id);
CREATE INDEX IF NOT EXISTS idx_club_reps_active ON club_representatives(club_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 3. CLUB SUBSCRIPTION BUNDLES TABLE
-- ============================================================================
-- Tracks bundle purchases made by clubs (via Zaprite)

CREATE TABLE IF NOT EXISTS club_subscription_bundles (
  bundle_purchase_id SERIAL PRIMARY KEY,

  -- Relationships
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  purchased_by_player_id INTEGER REFERENCES players(player_id),

  -- Bundle Details
  bundle_id INTEGER REFERENCES subscription_bundles(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),

  -- Payment Information
  zaprite_order_id VARCHAR(255),
  zaprite_event_id INTEGER REFERENCES zaprite_events(event_id),
  payment_amount DECIMAL(10, 2),
  payment_currency VARCHAR(10) DEFAULT 'USD',

  -- Subscription Distribution
  total_granted INTEGER DEFAULT 0,
  remaining INTEGER NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional: bundle expiration

  -- Constraints
  CONSTRAINT check_remaining CHECK (remaining >= 0 AND remaining <= quantity),
  CONSTRAINT check_granted CHECK (total_granted >= 0 AND total_granted <= quantity)
);

-- Indexes for club_subscription_bundles table
CREATE INDEX IF NOT EXISTS idx_club_bundles_club ON club_subscription_bundles(club_id);
CREATE INDEX IF NOT EXISTS idx_club_bundles_zaprite ON club_subscription_bundles(zaprite_order_id);
CREATE INDEX IF NOT EXISTS idx_club_bundles_active ON club_subscription_bundles(club_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. CLUB SUBSCRIPTION GRANTS TABLE
-- ============================================================================
-- Logs individual subscription grants from club bundles to players

CREATE TABLE IF NOT EXISTS club_subscription_grants (
  grant_id SERIAL PRIMARY KEY,

  -- Relationships
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  bundle_purchase_id INTEGER REFERENCES club_subscription_bundles(bundle_purchase_id),
  player_id INTEGER NOT NULL REFERENCES players(player_id),

  -- Grant Details
  granted_by_rep_id INTEGER REFERENCES club_representatives(rep_id),
  subscription_duration_months INTEGER DEFAULT 1, -- Usually matches bundle type

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_redeemed BOOLEAN DEFAULT FALSE,

  -- Metadata
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_active_grant UNIQUE(club_id, player_id, is_active)
);

-- Indexes for club_subscription_grants table
CREATE INDEX IF NOT EXISTS idx_club_grants_club ON club_subscription_grants(club_id);
CREATE INDEX IF NOT EXISTS idx_club_grants_player ON club_subscription_grants(player_id);
CREATE INDEX IF NOT EXISTS idx_club_grants_bundle ON club_subscription_grants(bundle_purchase_id);
CREATE INDEX IF NOT EXISTS idx_club_grants_active ON club_subscription_grants(is_active, is_redeemed);

-- ============================================================================
-- 5. PLAYER CLUB AFFILIATIONS TABLE
-- ============================================================================
-- Tracks player relationships with clubs (members, guests, etc.)

CREATE TABLE IF NOT EXISTS player_club_affiliations (
  affiliation_id SERIAL PRIMARY KEY,

  -- Relationships
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,

  -- Affiliation Details
  affiliation_type VARCHAR(50) DEFAULT 'guest', -- member, guest, invited, etc.

  -- How they joined
  invited_by_rep_id INTEGER REFERENCES club_representatives(rep_id),
  joined_via_league_id INTEGER REFERENCES leagues(league_id),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  affiliated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_player_club UNIQUE(player_id, club_id)
);

-- Indexes for player_club_affiliations table
CREATE INDEX IF NOT EXISTS idx_affiliations_player ON player_club_affiliations(player_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_club ON player_club_affiliations(club_id);
CREATE INDEX IF NOT EXISTS idx_affiliations_active ON player_club_affiliations(club_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 6. CLUB PLAYER INVITES TABLE
-- ============================================================================
-- Tracks invitations sent by club reps to players

CREATE TABLE IF NOT EXISTS club_player_invites (
  invite_id SERIAL PRIMARY KEY,

  -- Relationships
  club_id INTEGER NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  invited_by_rep_id INTEGER REFERENCES club_representatives(rep_id),

  -- Invitee Information
  player_id INTEGER REFERENCES players(player_id), -- If inviting existing user
  invite_email VARCHAR(255), -- If inviting new user
  invite_name VARCHAR(255),

  -- Invitation Details
  invite_type VARCHAR(50) DEFAULT 'league', -- league, membership, event, etc.
  league_id INTEGER REFERENCES leagues(league_id), -- If inviting to specific league
  message TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined, expired

  -- Metadata
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),

  -- Constraints
  CONSTRAINT check_invitee CHECK (player_id IS NOT NULL OR invite_email IS NOT NULL)
);

-- Indexes for club_player_invites table
CREATE INDEX IF NOT EXISTS idx_club_invites_club ON club_player_invites(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_player ON club_player_invites(player_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_email ON club_player_invites(invite_email);
CREATE INDEX IF NOT EXISTS idx_club_invites_status ON club_player_invites(status);

-- ============================================================================
-- 7. ALTER EXISTING TABLES
-- ============================================================================

-- Add is_club_rep flag to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS is_club_rep BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_players_club_rep ON players(is_club_rep) WHERE is_club_rep = TRUE;

-- Add host_club_id to leagues table (link leagues to clubs)
ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS host_club_id INTEGER REFERENCES clubs(club_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leagues_host_club ON leagues(host_club_id);

-- Add club tracking to player_referrals table
ALTER TABLE player_referrals
ADD COLUMN IF NOT EXISTS referred_by_club_id INTEGER REFERENCES clubs(club_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_club ON player_referrals(referred_by_club_id);

-- ============================================================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp for clubs
CREATE OR REPLACE FUNCTION update_club_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_club_timestamp
BEFORE UPDATE ON clubs
FOR EACH ROW
EXECUTE FUNCTION update_club_updated_at();

-- Auto-update club bundle balance when grants are made
CREATE OR REPLACE FUNCTION update_club_bundle_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Decrement bundle remaining count
    UPDATE club_subscription_bundles
    SET
      remaining = remaining - 1,
      total_granted = total_granted + 1
    WHERE bundle_purchase_id = NEW.bundle_purchase_id;

    -- Update club total balance
    UPDATE clubs
    SET subscription_bundle_balance = subscription_bundle_balance - 1
    WHERE club_id = NEW.club_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bundle_balance
AFTER INSERT ON club_subscription_grants
FOR EACH ROW
EXECUTE FUNCTION update_club_bundle_balance();

-- Auto-create player affiliation when subscription is granted
CREATE OR REPLACE FUNCTION create_affiliation_on_grant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO player_club_affiliations (player_id, club_id, affiliation_type, invited_by_rep_id)
  VALUES (NEW.player_id, NEW.club_id, 'member', NEW.granted_by_rep_id)
  ON CONFLICT (player_id, club_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_affiliation
AFTER INSERT ON club_subscription_grants
FOR EACH ROW
EXECUTE FUNCTION create_affiliation_on_grant();

-- ============================================================================
-- 9. INITIAL DATA & CLEANUP
-- ============================================================================

-- No initial data inserted here - golf courses will be imported via CSV script
-- (scripts/import-golf-courses.js)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 6 new tables
-- Tables modified: 3 existing tables (players, leagues, player_referrals)
-- Indexes created: 20+ optimized indexes
-- Triggers created: 3 automation triggers
--
-- Next steps:
-- 1. Run CSV import script to populate ~11,600 golf courses
-- 2. Create club rep authentication utilities
-- 3. Build admin club management endpoints
-- 4. Implement club rep dashboard
-- ============================================================================
