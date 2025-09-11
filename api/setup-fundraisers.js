import { Pool } from 'pg';

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

  let client;
  try {
    client = await pool.connect();
    console.log('Creating fundraisers and donations tables...');
    
    // Create tables with the exact SQL from our migration
    const setupSQL = `
      -- Create fundraisers table for community fundraising campaigns
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
    await client.query(setupSQL);

    // Verify the setup
    const fundraiserResult = await client.query('SELECT COUNT(*) as fundraiser_count FROM fundraisers');
    const fundraiserCount = fundraiserResult.rows[0].fundraiser_count;

    const donationResult = await client.query('SELECT COUNT(*) as donation_count FROM donations');
    const donationCount = donationResult.rows[0].donation_count;

    console.log(`✅ Fundraisers setup complete! Found ${fundraiserCount} fundraisers and ${donationCount} donations.`);

    res.status(200).json({ 
      success: true, 
      message: 'Fundraisers database setup completed successfully',
      fundraiserCount: parseInt(fundraiserCount),
      donationCount: parseInt(donationCount)
    });

  } catch (error) {
    console.error('Fundraisers setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fundraisers setup failed',
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
}