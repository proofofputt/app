import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { setCORSHeaders } from '../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log('Setting up complete database schema...');
    
    // Hash passwords for users
    const popPasswordHash = await bcrypt.hash('passwordpop123', 10);
    const demoPasswordHash = await bcrypt.hash('demo', 10);
    
    // Complete database setup SQL
    const setupSQL = `
      -- Players table for user registration and authentication
      CREATE TABLE IF NOT EXISTS players (
          player_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          membership_tier VARCHAR(50) DEFAULT 'basic',
          subscription_status VARCHAR(50) DEFAULT 'inactive',
          timezone VARCHAR(100) DEFAULT 'America/New_York',
          reset_token VARCHAR(255),
          reset_token_expiry TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Insert or update the default Pop user as player_id = 1
      INSERT INTO players (name, email, password_hash, membership_tier, subscription_status, timezone) 
      VALUES ('Pop', 'pop@proofofputt.com', '${popPasswordHash}', 'premium', 'active', 'America/New_York')
      ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW();

      -- Insert or update demo user for testing
      INSERT INTO players (name, email, password_hash, membership_tier, subscription_status, timezone) 
      VALUES ('Demo User', 'demo@demo.com', '${demoPasswordHash}', 'basic', 'active', 'America/New_York')
      ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW();

      -- Sessions table for storing JSON session data
      CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          player_id INTEGER NOT NULL,
          data JSONB NOT NULL,
          stats_summary JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (player_id) REFERENCES players(player_id)
      );

      -- Player stats aggregation table
      CREATE TABLE IF NOT EXISTS player_stats (
          player_id INTEGER PRIMARY KEY,
          total_sessions INTEGER DEFAULT 0,
          total_putts INTEGER DEFAULT 0,
          total_makes INTEGER DEFAULT 0,
          total_misses INTEGER DEFAULT 0,
          make_percentage DECIMAL(5,2) DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          last_session_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (player_id) REFERENCES players(player_id)
      );

      -- Leaderboard contexts table
      CREATE TABLE IF NOT EXISTS leaderboard_contexts (
          context_id SERIAL PRIMARY KEY,
          context_type VARCHAR(50) NOT NULL,
          context_name VARCHAR(255) NOT NULL,
          description TEXT,
          created_by INTEGER,
          config JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          FOREIGN KEY (created_by) REFERENCES players(player_id)
      );

      -- Insert default contexts
      INSERT INTO leaderboard_contexts (context_type, context_name, description, created_by) VALUES
      ('global', 'Global Leaderboard', 'All players worldwide', 1),
      ('friends', 'Friends Leaderboard', 'Your friends only', 1)
      ON CONFLICT DO NOTHING;

      -- Coupons table for early access code redemption
      CREATE TABLE IF NOT EXISTS coupons (
          coupon_id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          redemption_limit INTEGER NULL,
          times_redeemed INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NULL
      );

      -- Insert sample early access codes
      INSERT INTO coupons (code, description, is_active, redemption_limit) 
      VALUES 
          ('EARLYACCESS2024', 'Early Access 2024 - Unlimited uses', TRUE, NULL),
          ('BETA100', 'Beta Access - Limited to 100 uses', TRUE, 100),
          ('POP2024', 'Pop Early Access Code', TRUE, NULL)
      ON CONFLICT (code) DO NOTHING;

      -- Add test player stats for immediate leaderboard testing
      INSERT INTO player_stats (player_id, total_sessions, total_putts, total_makes, total_misses, make_percentage, best_streak, last_session_at) VALUES
      (1, 15, 450, 327, 123, 72.67, 12, NOW() - INTERVAL '2 hours'),
      (2, 8, 240, 156, 84, 65.00, 8, NOW() - INTERVAL '1 day')
      ON CONFLICT (player_id) DO UPDATE SET
          total_sessions = EXCLUDED.total_sessions,
          total_putts = EXCLUDED.total_putts,
          total_makes = EXCLUDED.total_makes,
          total_misses = EXCLUDED.total_misses,
          make_percentage = EXCLUDED.make_percentage,
          best_streak = GREATEST(player_stats.best_streak, EXCLUDED.best_streak),
          last_session_at = EXCLUDED.last_session_at,
          updated_at = NOW();

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_players_reset_token ON players(reset_token) WHERE reset_token IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_player_stats_makes ON player_stats(total_makes DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_streak ON player_stats(best_streak DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_percentage ON player_stats(make_percentage DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_sessions ON player_stats(total_sessions DESC);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

      -- Fundraisers table for community fundraising campaigns
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

      -- Fundraising performance indexes
      CREATE INDEX IF NOT EXISTS idx_fundraisers_created_by ON fundraisers(created_by);
      CREATE INDEX IF NOT EXISTS idx_fundraisers_status ON fundraisers(status);
      CREATE INDEX IF NOT EXISTS idx_fundraisers_end_date ON fundraisers(end_date);
      CREATE INDEX IF NOT EXISTS idx_fundraisers_created_at ON fundraisers(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_donations_fundraiser_id ON donations(fundraiser_id);
      CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
      CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

      -- Insert sample fundraising campaigns for testing
      INSERT INTO fundraisers (title, description, goal_amount, end_date, created_by, status) VALUES
          ('New Putting Equipment', 'Help us purchase professional-grade putting equipment for our community practice sessions. We need mats, training aids, and portable putting greens.', 500.00, CURRENT_DATE + INTERVAL '30 days', 1, 'active'),
          ('Club Tournament Prize Fund', 'Building a prize fund for our quarterly putting tournaments. Winner takes 60%%, runner-up gets 30%%, third place receives 10%%.', 1000.00, CURRENT_DATE + INTERVAL '45 days', 1, 'active')
      ON CONFLICT DO NOTHING;

      -- Insert sample donations for testing  
      INSERT INTO donations (fundraiser_id, donor_id, amount, message, is_anonymous) VALUES
          (1, 2, 25.00, 'Great cause! Happy to help.', FALSE),
          (1, 1, 50.00, 'Love seeing community support', FALSE),
          (2, 2, 100.00, 'Let''s make this tournament epic!', FALSE)
      ON CONFLICT DO NOTHING;

      -- Update amount_raised based on donations
      UPDATE fundraisers 
      SET amount_raised = COALESCE((
          SELECT SUM(amount) 
          FROM donations 
          WHERE donations.fundraiser_id = fundraisers.fundraiser_id
      ), 0.00);
    `;

    // Execute the setup SQL
    await pool.query(setupSQL);

    // Verify the setup by checking for players table
    const verifyResult = await pool.query('SELECT COUNT(*) as player_count FROM players');
    const playerCount = verifyResult.rows[0].player_count;

    console.log(`✅ Database setup complete! Players table has ${playerCount} users.`);

    res.status(200).json({ 
      success: true, 
      message: 'Complete database schema created successfully',
      playerCount: parseInt(playerCount)
    });

  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database setup failed',
      error: error.message 
    });
  }
}