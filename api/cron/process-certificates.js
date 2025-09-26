/**
 * Satoshi Sunday Certificate Processing
 *
 * Weekly cron job that processes queued achievement certificates
 * and timestamps them on the Bitcoin blockchain using OpenTimestamps.
 *
 * Runs every Sunday at 21:00 UTC (Satoshi Sunday)
 *
 * Process:
 * 1. Fetch all unprocessed certificates from the queue
 * 2. Create a Merkle tree of all certificate hashes
 * 3. Submit the Merkle root to OpenTimestamps for blockchain timestamping
 * 4. Move certificates from queue to final certificates table
 * 5. Send notifications to players about their new certificates
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { MerkleTree } from 'merkletreejs';
import OpenTimestamps from 'opentimestamps';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Create a SHA256 hash of certificate data
 */
function createCertificateHash(certificateData) {
  const dataString = JSON.stringify(certificateData, Object.keys(certificateData).sort());
  return createHash('sha256').update(dataString).digest('hex');
}

/**
 * Fetch all unprocessed certificates from the queue
 */
async function fetchQueuedCertificates(client) {
  try {
    const result = await client.query(`
      SELECT
        queue_id,
        player_id,
        achievement_type,
        achievement_value,
        achievement_data,
        session_id,
        achieved_at,
        queued_at
      FROM certificate_queue
      WHERE is_processed = FALSE
      ORDER BY queued_at ASC
    `);

    console.log(`[process-certificates] Found ${result.rows.length} queued certificates`);
    return result.rows;
  } catch (error) {
    console.error('[process-certificates] Error fetching queued certificates:', error);
    throw error;
  }
}

/**
 * Create certificate batch with Merkle tree
 */
async function createCertificateBatch(client, queuedCertificates) {
  if (queuedCertificates.length === 0) {
    console.log('[process-certificates] No certificates to process');
    return null;
  }

  try {
    // Generate certificate hashes
    const certificateHashes = queuedCertificates.map(cert => {
      const hash = createCertificateHash(cert.achievement_data);
      console.log(`[process-certificates] Certificate ${cert.queue_id}: ${hash.substring(0, 16)}...`);
      return Buffer.from(hash, 'hex');
    });

    // Create Merkle tree
    const merkleTree = new MerkleTree(certificateHashes, createHash('sha256'));
    const merkleRoot = merkleTree.getRoot().toString('hex');

    console.log(`[process-certificates] Created Merkle tree with root: ${merkleRoot.substring(0, 16)}...`);

    // Create batch record
    const batchName = `Satoshi Sunday ${new Date().toISOString().split('T')[0]}`;
    const batchId = uuidv4();

    await client.query(`
      INSERT INTO certificate_batches (
        batch_id, batch_name, processed_at, certificate_count,
        merkle_root, is_confirmed, total_cost_satoshis
      ) VALUES ($1, $2, NOW(), $3, $4, FALSE, 0)
    `, [batchId, batchName, queuedCertificates.length, merkleRoot]);

    console.log(`[process-certificates] Created batch ${batchId}: ${batchName} with ${queuedCertificates.length} certificates`);

    return {
      batchId,
      batchName,
      merkleRoot,
      merkleTree,
      certificateHashes: certificateHashes.map(hash => hash.toString('hex'))
    };

  } catch (error) {
    console.error('[process-certificates] Error creating certificate batch:', error);
    throw error;
  }
}

/**
 * Submit batch to OpenTimestamps for blockchain timestamping
 */
async function submitToOpenTimestamps(merkleRoot) {
  try {
    console.log(`[process-certificates] Submitting Merkle root to OpenTimestamps: ${merkleRoot.substring(0, 16)}...`);

    // Create OpenTimestamps proof
    const rootBuffer = Buffer.from(merkleRoot, 'hex');
    const detachedTimestamp = OpenTimestamps.DetachedTimestampFile.fromBytes(new OpenTimestamps.Ops.OpSHA256(), rootBuffer);

    // Submit to OpenTimestamps servers
    await OpenTimestamps.stamp(detachedTimestamp);

    // Serialize the timestamp for storage
    const otsFileBuffer = detachedTimestamp.serializeToBytes();

    console.log(`[process-certificates] Successfully submitted to OpenTimestamps. OTS file size: ${otsFileBuffer.length} bytes`);

    return otsFileBuffer;

  } catch (error) {
    console.error('[process-certificates] Error submitting to OpenTimestamps:', error);
    console.error('[process-certificates] This is non-blocking - certificates will still be issued without blockchain timestamp');
    return null; // Non-blocking - certificates can still be issued
  }
}

/**
 * Process queued certificates into final certificates table
 */
async function processCertificatesFromQueue(client, queuedCertificates, batchInfo, otsFile) {
  try {
    console.log(`[process-certificates] Processing ${queuedCertificates.length} certificates from queue to certificates table`);

    for (let i = 0; i < queuedCertificates.length; i++) {
      const cert = queuedCertificates[i];
      const certificateHash = batchInfo.certificateHashes[i];

      // Insert into achievement_certificates table
      await client.query(`
        INSERT INTO achievement_certificates (
          player_id, achievement_type, achievement_value, achievement_subtype,
          session_id, achieved_at, achievement_data, data_hash,
          merkle_root, batch_id, certificate_issued_at, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
        ON CONFLICT (player_id, achievement_type, achievement_value) DO NOTHING
      `, [
        cert.player_id,
        cert.achievement_type,
        cert.achievement_value,
        cert.achievement_data.achievement_subtype || null,
        cert.session_id,
        cert.achieved_at,
        cert.achievement_data,
        certificateHash,
        batchInfo.merkleRoot,
        batchInfo.batchId,
        otsFile ? true : false // Mark as verified if we have OTS file
      ]);

      // Mark queue item as processed
      await client.query(`
        UPDATE certificate_queue
        SET is_processed = TRUE, processed_batch_id = $1
        WHERE queue_id = $2
      `, [batchInfo.batchId, cert.queue_id]);

      console.log(`[process-certificates] Processed certificate ${cert.queue_id} for player ${cert.player_id}: ${cert.achievement_type}=${cert.achievement_value}`);
    }

    // Update batch with OTS file if available
    if (otsFile) {
      await client.query(`
        UPDATE certificate_batches
        SET ots_file = $1, is_confirmed = TRUE
        WHERE batch_id = $2
      `, [otsFile, batchInfo.batchId]);

      console.log(`[process-certificates] Updated batch ${batchInfo.batchId} with OTS file (${otsFile.length} bytes)`);
    }

    console.log(`[process-certificates] Successfully processed all ${queuedCertificates.length} certificates`);

  } catch (error) {
    console.error('[process-certificates] Error processing certificates from queue:', error);
    throw error;
  }
}

/**
 * Generate summary statistics for the processing run
 */
function generateProcessingSummary(queuedCertificates, batchInfo) {
  const summary = {
    total_certificates: queuedCertificates.length,
    batch_id: batchInfo?.batchId || null,
    merkle_root: batchInfo?.merkleRoot || null,
    certificates_by_type: {},
    certificates_by_rarity: {},
    unique_players: new Set()
  };

  queuedCertificates.forEach(cert => {
    // Count by achievement type
    const type = cert.achievement_type;
    summary.certificates_by_type[type] = (summary.certificates_by_type[type] || 0) + 1;

    // Count by rarity
    const rarity = cert.achievement_data?.rarity_tier || 'unknown';
    summary.certificates_by_rarity[rarity] = (summary.certificates_by_rarity[rarity] || 0) + 1;

    // Track unique players
    summary.unique_players.add(cert.player_id);
  });

  summary.unique_players_count = summary.unique_players.size;
  delete summary.unique_players; // Don't include the Set in the final summary

  return summary;
}

/**
 * Main cron job handler
 */
export default async function handler(req, res) {
  // Security: Only allow POST requests with correct authorization
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Verify cron job authorization (Vercel Cron uses Authorization header)
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[process-certificates] Unauthorized cron job request');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`[process-certificates] Satoshi Sunday certificate processing started at ${new Date().toISOString()}`);

  let client;
  try {
    client = await pool.connect();
    console.log('[process-certificates] Connected to database');

    // Step 1: Fetch queued certificates
    const queuedCertificates = await fetchQueuedCertificates(client);

    if (queuedCertificates.length === 0) {
      console.log('[process-certificates] No certificates to process this week');
      return res.status(200).json({
        success: true,
        message: 'No certificates to process',
        certificates_processed: 0,
        processing_time_ms: Date.now() - startTime
      });
    }

    // Step 2: Create certificate batch and Merkle tree
    const batchInfo = await createCertificateBatch(client, queuedCertificates);

    // Step 3: Submit to OpenTimestamps (non-blocking)
    const otsFile = await submitToOpenTimestamps(batchInfo.merkleRoot);

    // Step 4: Process certificates from queue to final table
    await processCertificatesFromQueue(client, queuedCertificates, batchInfo, otsFile);

    // Step 5: Generate processing summary
    const summary = generateProcessingSummary(queuedCertificates, batchInfo);

    const processingTime = Date.now() - startTime;
    console.log(`[process-certificates] Satoshi Sunday processing completed in ${processingTime}ms`);
    console.log(`[process-certificates] Summary:`, summary);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Certificate processing completed successfully',
      certificates_processed: queuedCertificates.length,
      batch_id: batchInfo.batchId,
      merkle_root: batchInfo.merkleRoot.substring(0, 16) + '...',
      blockchain_submitted: !!otsFile,
      processing_time_ms: processingTime,
      summary: summary
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[process-certificates] Fatal error during certificate processing:', error);
    console.error('[process-certificates] Stack trace:', error.stack);

    return res.status(500).json({
      success: false,
      message: 'Certificate processing failed',
      error: error.message,
      processing_time_ms: processingTime
    });

  } finally {
    if (client) {
      client.release();
      console.log('[process-certificates] Database connection released');
    }
  }
}

/**
 * Configuration for Vercel Cron Jobs
 * Add this to vercel.json:
 *
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/process-certificates",
 *       "schedule": "0 21 * * 0"
 *     }
 *   ]
 * }
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - CRON_SECRET: Secret token for cron job authorization
 */