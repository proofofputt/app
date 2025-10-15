/**
 * Export Clubs to HubSpot CRM
 * ============================================================================
 * Exports club data from PostgreSQL to HubSpot as contacts/companies
 *
 * Usage:
 *   HUBSPOT_API_KEY=your_key node scripts/export-clubs-to-hubspot.js
 *   HUBSPOT_API_KEY=your_key node scripts/export-clubs-to-hubspot.js --limit=100
 *   HUBSPOT_API_KEY=your_key node scripts/export-clubs-to-hubspot.js --dry-run
 *
 * Setup:
 * 1. Go to HubSpot Settings > Integrations > Private Apps
 * 2. Create an app with these scopes: crm.objects.companies.write, crm.objects.companies.read
 * 3. Copy the access token and set as HUBSPOT_API_KEY environment variable
 * ============================================================================
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';
const BATCH_SIZE = 100;

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value === undefined ? true : value;
  return acc;
}, {});

const DRY_RUN = args['dry-run'] || false;
const LIMIT = args.limit ? parseInt(args.limit) : null;

/**
 * Create a company in HubSpot
 */
async function createHubSpotCompany(club) {
  const properties = {
    name: club.name,
    phone: club.phone || '',
    website: club.website || '',
    address: club.address_line1 || '',
    address2: club.address_line2 || '',
    city: club.address_city || '',
    state: club.address_state || '',
    zip: club.address_postcode || '',
    country: club.address_country || 'USA',
    // Custom properties (you'll need to create these in HubSpot first)
    club_id: club.club_id.toString(),
    latitude: club.latitude ? club.latitude.toString() : '',
    longitude: club.longitude ? club.longitude.toString() : '',
    outreach_status: club.outreach_status || 'not_contacted',
    outreach_priority: club.outreach_priority ? club.outreach_priority.toString() : '5',
    primary_contact_name: club.primary_contact_name || '',
    primary_contact_email: club.primary_contact_email || '',
    primary_contact_phone: club.primary_contact_phone || '',
  };

  // Remove empty values
  Object.keys(properties).forEach(key => {
    if (properties[key] === '' || properties[key] === null) {
      delete properties[key];
    }
  });

  const response = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/companies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`HubSpot API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Update club with HubSpot contact ID
 */
async function updateClubWithHubSpotId(clubId, hubspotContactId) {
  await pool.query(
    'UPDATE clubs SET hubspot_contact_id = $1, last_synced_to_crm = NOW() WHERE club_id = $2',
    [hubspotContactId, clubId]
  );
}

/**
 * Get clubs that haven't been synced yet
 */
async function getUnsyncedClubs(limit = null) {
  const query = `
    SELECT
      club_id, name, phone, website,
      address_line1, address_line2, address_city,
      address_state, address_postcode, address_country,
      latitude, longitude,
      primary_contact_name, primary_contact_email, primary_contact_phone,
      outreach_status, outreach_priority
    FROM clubs
    WHERE hubspot_contact_id IS NULL
    AND is_active = TRUE
    ORDER BY club_id
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main export function
 */
async function exportClubsToHubSpot() {
  console.log('🚀 Club to HubSpot Export Tool');
  console.log('==========================================');

  if (!HUBSPOT_API_KEY) {
    console.error('❌ Error: HUBSPOT_API_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  HUBSPOT_API_KEY=your_key node scripts/export-clubs-to-hubspot.js');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be sent to HubSpot\n');
  }

  console.log(`📊 Fetching unsynced clubs${LIMIT ? ` (limit: ${LIMIT})` : ''}...`);
  const clubs = await getUnsyncedClubs(LIMIT);
  console.log(`✅ Found ${clubs.length} clubs to export\n`);

  if (clubs.length === 0) {
    console.log('✨ All clubs are already synced to HubSpot!');
    await pool.end();
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i];
    const progress = `[${i + 1}/${clubs.length}]`;

    try {
      console.log(`${progress} Processing: ${club.name} (ID: ${club.club_id})`);

      if (!DRY_RUN) {
        const hubspotCompany = await createHubSpotCompany(club);
        await updateClubWithHubSpotId(club.club_id, hubspotCompany.id);
        console.log(`  ✅ Created HubSpot company: ${hubspotCompany.id}`);
      } else {
        console.log(`  🔍 Would create HubSpot company for club ${club.club_id}`);
      }

      successCount++;

      // Rate limiting - HubSpot free tier has 100 requests per 10 seconds
      if ((i + 1) % 90 === 0) {
        console.log('  ⏸️  Rate limit pause (10 seconds)...\n');
        await sleep(10000);
      } else {
        await sleep(110); // ~100ms between requests
      }
    } catch (error) {
      errorCount++;
      console.error(`  ❌ Error: ${error.message}`);
      errors.push({ club_id: club.club_id, name: club.name, error: error.message });
    }
  }

  console.log('\n==========================================');
  console.log('📊 Export Summary');
  console.log('==========================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach(err => {
      console.log(`  - Club ${err.club_id} (${err.name}): ${err.error}`);
    });
  }

  await pool.end();
  console.log('\n✨ Export complete!');
}

// Run the export
exportClubsToHubSpot().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
