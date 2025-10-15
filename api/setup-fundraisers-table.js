import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
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

  let client;
  try {
    client = await pool.connect();
    console.log('Setting up fundraisers table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'migrations', 'create-fundraisers-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration SQL
    await client.query(migrationSQL);

    // Verify the setup by checking for fundraisers table
    const verifyResult = await client.query('SELECT COUNT(*) as fundraiser_count FROM fundraisers');
    const fundraiserCount = verifyResult.rows[0].fundraiser_count;

    console.log(`✅ Fundraisers table setup complete! Found ${fundraiserCount} fundraisers.`);

    // Also check if donations table was created
    const donationsResult = await client.query('SELECT COUNT(*) as donation_count FROM donations');
    const donationCount = donationsResult.rows[0].donation_count;

    console.log(`✅ Donations table has ${donationCount} donations.`);

    res.status(200).json({ 
      success: true, 
      message: 'Fundraisers database schema created successfully',
      fundraiserCount: parseInt(fundraiserCount),
      donationCount: parseInt(donationCount)
    });

  } catch (error) {
    console.error('Fundraisers table setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Fundraisers table setup failed',
      error: error.message 
    });
  } finally {
    if (client) client.release();
  }
}