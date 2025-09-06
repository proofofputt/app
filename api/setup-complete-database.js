import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_player_stats_makes ON player_stats(total_makes DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_streak ON player_stats(best_streak DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_percentage ON player_stats(make_percentage DESC);
      CREATE INDEX IF NOT EXISTS idx_player_stats_sessions ON player_stats(total_sessions DESC);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
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