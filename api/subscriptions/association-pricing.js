import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const {
    name,
    email,
    phone,
    comments,
    club_name,
    office_address,
    number_of_users,
    onboarding_support,
    implementation_support,
    event_management
  } = req.body;

  // Validation
  if (!name || !email || !comments || !number_of_users) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, comments, and number of users.'
    });
  }

  if (number_of_users < 1) {
    return res.status(400).json({
      success: false,
      message: 'Number of users must be at least 1.'
    });
  }

  try {
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS association_pricing_requests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        comments TEXT NOT NULL,
        club_name VARCHAR(255),
        office_address TEXT,
        number_of_users INTEGER NOT NULL,
        onboarding_support BOOLEAN DEFAULT FALSE,
        implementation_support BOOLEAN DEFAULT FALSE,
        event_management BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert the request
    const result = await pool.query(
      `INSERT INTO association_pricing_requests
       (name, email, phone, comments, club_name, office_address, number_of_users,
        onboarding_support, implementation_support, event_management)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        name,
        email,
        phone || null,
        comments,
        club_name || null,
        office_address || null,
        number_of_users,
        onboarding_support || false,
        implementation_support || false,
        event_management || false
      ]
    );

    console.log(`✅ Association pricing request #${result.rows[0].id} created:`, {
      name,
      email,
      club_name: club_name || 'N/A',
      number_of_users
    });

    // TODO: Send email notification to sales team
    // TODO: Consider integrating with CRM system

    return res.status(200).json({
      success: true,
      message: 'Your request has been submitted successfully. We will contact you within 1-2 business days.',
      requestId: result.rows[0].id
    });

  } catch (error) {
    console.error('❌ Association pricing request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request. Please try again or contact support.'
    });
  }
}
