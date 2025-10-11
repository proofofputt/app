// Script to create basic duels and leagues tables
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createBasicTables() {
  let client;
  try {
    client = await pool.connect();
    
    console.log('🏗️ Creating basic competition tables...');
    
    // Create duels table
    console.log('🥊 Creating duels table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS duels (
        duel_id SERIAL PRIMARY KEY,
        challenger_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        challengee_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined', 'cancelled')),
        rules JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        
        -- Session tracking
        challenger_session_id INTEGER,
        challengee_session_id INTEGER,
        challenger_session_data JSONB,
        challengee_session_data JSONB,
        
        -- Scoring and results
        challenger_score INTEGER DEFAULT 0,
        challengee_score INTEGER DEFAULT 0,
        winner_id INTEGER REFERENCES players(player_id),
        
        -- Timing
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        accepted_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
        
        -- Metadata
        duel_type VARCHAR(50) DEFAULT 'practice',
        invite_message TEXT,
        completion_reason VARCHAR(100),
        
        -- Prevent users from challenging themselves
        CONSTRAINT no_self_challenge CHECK (challenger_id != challengee_id)
      )
    `);
    
    // Create leagues table
    console.log('🏟️ Creating leagues table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leagues (
        league_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        league_type VARCHAR(50) DEFAULT 'tournament',
        status VARCHAR(20) DEFAULT 'registering' CHECK (status IN ('registering', 'active', 'completed', 'cancelled', 'paused')),
        
        rules JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        
        max_members INTEGER DEFAULT 50,
        min_members INTEGER DEFAULT 2,
        current_members INTEGER DEFAULT 0,
        
        current_round INTEGER DEFAULT 1,
        total_rounds INTEGER DEFAULT 4,
        round_duration_hours INTEGER DEFAULT 168,
        
        privacy_level VARCHAR(20) DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'invite_only')),
        invitation_only BOOLEAN DEFAULT false,
        auto_start_rounds BOOLEAN DEFAULT true,
        
        created_by INTEGER NOT NULL REFERENCES players(player_id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        registration_deadline TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `);
    
    // Create league memberships table
    console.log('👥 Creating league_memberships table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS league_memberships (
        membership_id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        
        member_role VARCHAR(20) DEFAULT 'member' CHECK (member_role IN ('owner', 'admin', 'member')),
        invite_permissions BOOLEAN DEFAULT false,
        
        total_score DECIMAL(10,2) DEFAULT 0,
        current_rank INTEGER,
        sessions_this_round INTEGER DEFAULT 0,
        
        is_active BOOLEAN DEFAULT true,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE,
        
        UNIQUE(league_id, player_id)
      )
    `);
    
    // Create league rounds table
    console.log('🔄 Creating league_rounds table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS league_rounds (
        round_id SERIAL PRIMARY KEY,
        league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
        scoring_completed BOOLEAN DEFAULT false,
        
        round_config JSONB DEFAULT '{}',
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(league_id, round_number)
      )
    `);
    
    // Create league round sessions table
    console.log('📝 Creating league_round_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS league_round_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        round_id INTEGER NOT NULL REFERENCES league_rounds(round_id) ON DELETE CASCADE,
        league_id INTEGER NOT NULL REFERENCES leagues(league_id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        session_data JSONB NOT NULL,
        round_score DECIMAL(10,2) DEFAULT 0,
        ranking_metrics JSONB DEFAULT '{}',
        
        is_valid BOOLEAN DEFAULT true,
        validation_notes TEXT
      )
    `);
    
    // Create basic indexes
    console.log('🔍 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_duels_challengee ON duels(challengee_id, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_league_memberships_league ON league_memberships(league_id, is_active)');
    
    console.log('✅ Basic tables created successfully!');
    
    // Verify table creation
    console.log('🔍 Verifying table creation...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%duel%' OR table_name LIKE '%league%')
      ORDER BY table_name
    `);
    
    console.log('🏆 Competition tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the script
createBasicTables()
  .then(() => {
    console.log('Table creation completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Table creation failed:', error);
    process.exit(1);
  });