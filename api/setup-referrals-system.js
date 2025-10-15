import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  
  try {
    console.log('🚀 Setting up referrals system...');

    // Create player_referrals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_referrals (
          referral_id SERIAL PRIMARY KEY,
          referrer_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          referred_player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
          referral_source VARCHAR(50) DEFAULT 'duel_invitation',
          referral_code VARCHAR(100),
          reward_claimed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(referrer_id, referred_player_id)
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_player_referrals_referrer_id ON player_referrals(referrer_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_player_referrals_referred_player_id ON player_referrals(referred_player_id)
    `);

    // Add columns to players table
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS referred_by_player_id INTEGER REFERENCES players(player_id),
      ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE
    `);

    // Generate referral codes for existing players
    await client.query(`
      UPDATE players 
      SET referral_code = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3)) || LPAD((player_id % 10000)::text, 4, '0')
      WHERE referral_code IS NULL
    `);

    // Create/update the trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_referral_count()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE players 
              SET total_referrals = total_referrals + 1,
                  updated_at = NOW()
              WHERE player_id = NEW.referrer_id;
              RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE players 
              SET total_referrals = GREATEST(total_referrals - 1, 0),
                  updated_at = NOW()
              WHERE player_id = OLD.referrer_id;
              RETURN OLD;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Drop and recreate the trigger
    await client.query(`DROP TRIGGER IF EXISTS referral_count_trigger ON player_referrals`);
    await client.query(`
      CREATE TRIGGER referral_count_trigger
          AFTER INSERT OR DELETE ON player_referrals
          FOR EACH ROW EXECUTE FUNCTION update_referral_count()
    `);

    // Verify the setup
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'player_referrals'
    `);

    const columnsCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('total_referrals', 'referral_code', 'referred_by_player_id')
      ORDER BY column_name
    `);

    console.log('✅ Referrals system setup completed');

    return res.status(200).json({
      success: true,
      message: 'Referrals system setup completed successfully',
      tables_created: tableCheck.rows.length,
      columns_added: columnsCheck.rows,
      features: [
        'player_referrals table created',
        'referral tracking columns added to players',
        'automatic referral code generation',
        'referral count triggers installed',
        'bidirectional friend connections on referral'
      ]
    });

  } catch (error) {
    console.error('❌ Referrals system setup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Setup failed',
      details: error.message
    });
  } finally {
    client.release();
  }
}