/**
 * HubSpot Contact Update Webhook
 * ============================================================================
 * POST /api/webhooks/hubspot/contact-update
 *
 * Receives contact property changes from HubSpot and creates pending updates
 * for admin approval or auto-applies them based on configuration.
 *
 * HubSpot Webhook Setup:
 * 1. Go to Settings > Integrations > Private Apps
 * 2. Create app with contacts.write and contacts.read scopes
 * 3. Set webhook URL to: https://app.proofofputt.com/api/webhooks/hubspot/contact-update
 * 4. Subscribe to: contact.propertyChange
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import crypto from 'crypto';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Fields that auto-update without approval
const AUTO_APPROVE_FIELDS = [
  'last_contact_date',
  'last_contact_notes',
  'outreach_status',
  'outreach_priority',
];

// Fields that require admin approval
const APPROVAL_REQUIRED_FIELDS = [
  'name',
  'phone',
  'website',
  'primary_contact_name',
  'primary_contact_email',
  'primary_contact_phone',
  'address_line1',
  'address_line2',
  'address_city',
  'address_state',
  'address_postcode',
  'address_country',
];

// HubSpot property name mapping to database columns
const PROPERTY_MAP = {
  'company': 'name',
  'phone': 'phone',
  'website': 'website',
  'contact_name': 'primary_contact_name',
  'contact_email': 'primary_contact_email',
  'contact_phone': 'primary_contact_phone',
  'address': 'address_line1',
  'address2': 'address_line2',
  'city': 'address_city',
  'state': 'address_state',
  'zip': 'address_postcode',
  'country': 'address_country',
  'last_contact': 'last_contact_date',
  'notes': 'last_contact_notes',
  'outreach_status': 'outreach_status',
  'outreach_priority': 'outreach_priority',
};

/**
 * Verify HubSpot webhook signature
 */
function verifyHubSpotSignature(req, body) {
  if (!process.env.HUBSPOT_CLIENT_SECRET) {
    console.warn('HUBSPOT_CLIENT_SECRET not set - skipping signature verification');
    return true; // Skip verification in development
  }

  const signature = req.headers['x-hubspot-signature-v3'];
  if (!signature) return false;

  const timestamp = req.headers['x-hubspot-request-timestamp'];
  const sourceString = `${process.env.HUBSPOT_CLIENT_SECRET}${timestamp}${body}`;

  const hash = crypto
    .createHash('sha256')
    .update(sourceString)
    .digest('hex');

  return hash === signature;
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    // Verify webhook signature
    const rawBody = JSON.stringify(req.body);
    if (!verifyHubSpotSignature(req, rawBody)) {
      console.error('Invalid HubSpot webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    // Parse HubSpot webhook payload
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const event of events) {
      try {
        const result = await processContactUpdate(event);
        results.push(result);
      } catch (error) {
        console.error('Error processing event:', error);
        results.push({ success: false, error: error.message });
      }
    }

    // Log sync event
    await pool.query(
      `INSERT INTO crm_sync_log (sync_type, direction, source, payload, success)
       VALUES ($1, $2, $3, $4, $5)`,
      ['webhook_received', 'inbound', 'hubspot', JSON.stringify(req.body), true]
    );

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error processing HubSpot webhook:', error);

    // Log failed sync
    await pool.query(
      `INSERT INTO crm_sync_log (sync_type, direction, source, payload, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['webhook_received', 'inbound', 'hubspot', JSON.stringify(req.body), false, error.message]
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Process a single contact update event
 */
async function processContactUpdate(event) {
  const { objectId, propertyName, propertyValue, occurredAt, email } = event;

  // Map HubSpot property to database column
  const dbField = PROPERTY_MAP[propertyName];
  if (!dbField) {
    console.log(`Ignoring unmapped property: ${propertyName}`);
    return { success: true, action: 'ignored', reason: 'unmapped_property' };
  }

  // Find club by HubSpot contact ID
  const clubResult = await pool.query(
    'SELECT club_id, name, phone, website FROM clubs WHERE hubspot_contact_id = $1',
    [objectId]
  );

  if (clubResult.rows.length === 0) {
    console.warn(`Club not found for HubSpot contact ${objectId}`);
    return { success: false, action: 'skipped', reason: 'club_not_found' };
  }

  const club = clubResult.rows[0];
  const oldValue = club[dbField];

  // Check if value actually changed
  if (oldValue === propertyValue) {
    return { success: true, action: 'skipped', reason: 'no_change' };
  }

  // Determine if auto-approve or requires approval
  if (AUTO_APPROVE_FIELDS.includes(dbField)) {
    // Auto-update directly
    await pool.query(
      `UPDATE clubs SET ${dbField} = $1, last_synced_from_crm = NOW() WHERE club_id = $2`,
      [propertyValue, club.club_id]
    );

    await pool.query(
      `INSERT INTO crm_sync_log (sync_type, club_id, direction, source, payload, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'auto_update',
        club.club_id,
        'inbound',
        'hubspot',
        JSON.stringify({ field: dbField, oldValue, newValue: propertyValue }),
        true,
      ]
    );

    return { success: true, action: 'auto_updated', field: dbField };
  } else if (APPROVAL_REQUIRED_FIELDS.includes(dbField)) {
    // Create pending update for approval
    await pool.query(
      `INSERT INTO pending_club_updates (
        club_id, field_name, old_value, new_value, source, source_user_email
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [club.club_id, dbField, oldValue, propertyValue, 'hubspot', email]
    );

    return { success: true, action: 'pending_approval', field: dbField };
  }

  return { success: false, action: 'unknown', reason: 'field_not_configured' };
}
