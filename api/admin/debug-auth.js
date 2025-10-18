/**
 * Debug endpoint to troubleshoot admin authentication issues
 * GET /api/admin/debug-auth
 */

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const debug = {
    step: '',
    authHeader: null,
    tokenReceived: false,
    tokenDecoded: null,
    decodedPayload: null,
    playerIdFound: null,
    databaseQuery: null,
    playerRecord: null,
    isAdmin: null,
    error: null
  };

  try {
    // Step 1: Check Authorization header
    debug.step = '1_check_header';
    debug.authHeader = req.headers.authorization ? 'Present' : 'Missing';

    if (!req.headers.authorization) {
      debug.error = 'No Authorization header found';
      return res.status(200).json({ success: false, debug });
    }

    if (!req.headers.authorization.startsWith('Bearer ')) {
      debug.error = 'Authorization header does not start with "Bearer "';
      return res.status(200).json({ success: false, debug });
    }

    // Step 2: Extract token
    debug.step = '2_extract_token';
    const token = req.headers.authorization.split(' ')[1];
    debug.tokenReceived = !!token;

    if (!token) {
      debug.error = 'Token is empty after splitting Authorization header';
      return res.status(200).json({ success: false, debug });
    }

    // Step 3: Decode token (without verification first)
    debug.step = '3_decode_token';
    try {
      debug.tokenDecoded = jwt.decode(token);
      debug.decodedPayload = {
        hasPlayerId: 'playerId' in debug.tokenDecoded,
        hasPlayerIdSnakeCase: 'player_id' in debug.tokenDecoded,
        playerIdValue: debug.tokenDecoded.playerId || debug.tokenDecoded.player_id || null,
        email: debug.tokenDecoded.email || null,
        iat: debug.tokenDecoded.iat ? new Date(debug.tokenDecoded.iat * 1000).toISOString() : null,
        exp: debug.tokenDecoded.exp ? new Date(debug.tokenDecoded.exp * 1000).toISOString() : null,
        isExpired: debug.tokenDecoded.exp ? Date.now() >= debug.tokenDecoded.exp * 1000 : null
      };
    } catch (decodeError) {
      debug.error = `Failed to decode token: ${decodeError.message}`;
      return res.status(200).json({ success: false, debug });
    }

    // Step 4: Verify token signature
    debug.step = '4_verify_token';
    let verified;
    try {
      verified = jwt.verify(token, process.env.JWT_SECRET);
      debug.playerIdFound = verified.playerId || verified.player_id || null;
    } catch (verifyError) {
      debug.error = `Token verification failed: ${verifyError.message}`;
      return res.status(200).json({ success: false, debug });
    }

    if (!debug.playerIdFound) {
      debug.error = 'No playerId found in verified token (checked both playerId and player_id)';
      return res.status(200).json({ success: false, debug });
    }

    // Step 5: Query database for player
    debug.step = '5_query_database';
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT player_id, is_admin, name, email FROM players WHERE player_id = $1',
        [debug.playerIdFound]
      );

      debug.databaseQuery = {
        playerId: debug.playerIdFound,
        rowsReturned: result.rows.length
      };

      if (result.rows.length === 0) {
        debug.error = `No player found with ID ${debug.playerIdFound}`;
        return res.status(200).json({ success: false, debug });
      }

      const player = result.rows[0];
      debug.playerRecord = {
        player_id: player.player_id,
        name: player.name,
        email: player.email,
        is_admin: player.is_admin
      };

      debug.isAdmin = player.is_admin === true;

      if (!debug.isAdmin) {
        debug.error = `Player ${player.name} (${player.email}) exists but is_admin = ${player.is_admin}`;
        return res.status(200).json({ success: false, debug });
      }

      // Success!
      debug.step = '6_complete';
      return res.status(200).json({
        success: true,
        message: `✅ Authentication successful! Player ${player.name} is an admin.`,
        debug
      });

    } finally {
      client.release();
    }

  } catch (error) {
    debug.error = `Unexpected error at step ${debug.step}: ${error.message}`;
    debug.stackTrace = error.stack;
    return res.status(200).json({ success: false, debug });
  }
}
