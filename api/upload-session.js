import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function verifyToken(req) {
  return new Promise((resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return resolve(null);
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return resolve(null);
      }
      resolve(decoded);
    });
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log('[upload-session] Request received at:', new Date().toISOString());
    console.log('[upload-session] Authorization header present:', !!req.headers.authorization);
    
    const { player_id, session_data, session_id, csv_data, duel_id, league_round_id } = req.body;

    // Check if this is a desktop upload (no auth required for desktop)
    const isDesktopUpload = req.headers['x-desktop-upload'] === 'true' || !req.headers.authorization;
    
    console.log('[upload-session] Headers:', {
      'x-desktop-upload': req.headers['x-desktop-upload'],
      'authorization': !!req.headers.authorization,
      'content-type': req.headers['content-type'],
      isDesktopUpload
    });
    
    // Verify the JWT from the Authorization header (skip for desktop)
    const user = isDesktopUpload ? { playerId: player_id } : await verifyToken(req);
    console.log('[upload-session] Auth mode:', isDesktopUpload ? 'desktop (no auth)' : 'web (JWT)');
    console.log('[upload-session] Token verification result:', user ? 'success' : 'failed');
    if (!user && !isDesktopUpload) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
    console.log('[upload-session] Request payload size:', JSON.stringify(req.body).length);
    console.log('[upload-session] Player ID received:', player_id);

    if (!player_id || !session_data) {
      console.log('[upload-session] Missing required fields');
      return res.status(400).json({ success: false, message: 'Player ID and session data are required.' });
    }

    // Skip player ID validation for desktop uploads
    if (!isDesktopUpload && parseInt(user.playerId, 10) !== parseInt(player_id, 10)) {
      console.log('[upload-session] Player ID mismatch:', user.playerId, 'vs', player_id);
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    console.log('[upload-session] Connecting to database...');
    const client = await pool.connect();
    try {
      // Generate session ID if not provided
      const finalSessionId = session_id || uuidv4();

      // Parse session data to extract stats summary
      let statsData = {};
      if (typeof session_data === 'object') {
        statsData = session_data;
      } else {
        try {
          statsData = JSON.parse(session_data);
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Invalid JSON in session data.' });
        }
      }

      // Extract key metrics for stats summary - handle field name variations
      const statsSummary = {
        total_putts: statsData.total_putts || 0,
        total_makes: statsData.total_makes || 0,
        total_misses: statsData.total_misses || 0,
        make_percentage: statsData.make_percentage || 0,
        best_streak: statsData.best_streak || 0,
        // Handle both session_duration and session_duration_seconds
        session_duration: statsData.session_duration_seconds || statsData.session_duration || 0,
        date_recorded: statsData.date_recorded || new Date().toISOString()
      };

      console.log('[upload-session] Stats summary extracted:', {
        totalPutts: statsSummary.total_putts,
        duration: statsSummary.session_duration,
        bestStreak: statsSummary.best_streak,
        originalFields: Object.keys(statsData).sort()
      });

      // Insert session data into sessions table
      await client.query(
        'INSERT INTO sessions (session_id, player_id, data, stats_summary, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (session_id) DO UPDATE SET data = $3, stats_summary = $4, updated_at = NOW()',
        [finalSessionId, player_id, JSON.stringify(statsData), JSON.stringify(statsSummary)]
      );

      // If CSV data is provided, store it in premium_reports table
      if (csv_data) {
        await client.query(
          'INSERT INTO premium_reports (session_id, player_id, report_content, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (session_id) DO UPDATE SET report_content = $3, updated_at = NOW()',
          [finalSessionId, player_id, csv_data]
        );
      }

      // Handle duel session association
      if (duel_id) {
        console.log(`[upload-session] Associating session ${finalSessionId} with duel ${duel_id}`);
        
        // Check if duel exists and player is part of it
        const duelResult = await client.query(
          'SELECT duel_id, challenger_id, challenged_id, status, challenger_session_id, challenged_session_id FROM duels WHERE duel_id = $1 AND (challenger_id = $2 OR challenged_id = $2)',
          [duel_id, player_id]
        );
        
        if (duelResult.rows.length > 0) {
          const duel = duelResult.rows[0];
          
          // Determine which session field to update
          const isChallenger = duel.challenger_id === parseInt(player_id);
          const sessionField = isChallenger ? 'challenger_session_id' : 'challenged_session_id';
          
          // Check if player has already submitted a session
          const existingSessionId = isChallenger ? duel.challenger_session_id : duel.challenged_session_id;
          if (existingSessionId) {
            console.log(`[upload-session] Warning: Player ${player_id} already has session ${existingSessionId} for duel ${duel_id}. Updating to ${finalSessionId}.`);
          }
          
          // Update duel with session ID
          await client.query(
            `UPDATE duels SET ${sessionField} = $1, updated_at = NOW() WHERE duel_id = $2`,
            [finalSessionId, duel_id]
          );
          
          // Check if both players have now submitted sessions
          const updatedDuelResult = await client.query(
            'SELECT challenger_session_id, challenged_session_id, challenger_id, challenged_id FROM duels WHERE duel_id = $1',
            [duel_id]
          );
          
          const updatedDuel = updatedDuelResult.rows[0];
          if (updatedDuel.challenger_session_id && updatedDuel.challenged_session_id) {
            console.log(`[upload-session] Both players have submitted sessions for duel ${duel_id}. Marking as ready for scoring.`);
            
            // TODO: Trigger automatic duel scoring here
            // This could call the duels-v2 scoring logic or trigger a background job
            
            // For now, we'll leave the duel in 'active' status and let the duels-v2 API handle completion
            console.log(`[upload-session] Duel ${duel_id} ready for completion via duels-v2 API`);
          }
          
          console.log(`[upload-session] Successfully linked session ${finalSessionId} to duel ${duel_id} as ${isChallenger ? 'challenger' : 'challenged'}`);
        } else {
          console.log(`[upload-session] Warning: Duel ${duel_id} not found or player ${player_id} is not part of it`);
        }
      }

      // Handle league session association (placeholder for future implementation)
      if (league_round_id) {
        console.log(`[upload-session] League session association for round ${league_round_id} - feature not yet implemented`);
        // TODO: Implement league session association logic
      }

      // Update player stats (aggregate statistics)
      await client.query(`
        INSERT INTO player_stats (player_id, total_sessions, total_putts, total_makes, total_misses, make_percentage, best_streak, last_session_at, created_at, updated_at)
        VALUES ($1, 1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
        ON CONFLICT (player_id) DO UPDATE SET
          total_sessions = player_stats.total_sessions + 1,
          total_putts = player_stats.total_putts + $2,
          total_makes = player_stats.total_makes + $3,
          total_misses = player_stats.total_misses + $4,
          make_percentage = CASE WHEN (player_stats.total_putts + $2) > 0 THEN ROUND(((player_stats.total_makes + $3)::decimal / (player_stats.total_putts + $2)::decimal) * 100, 2) ELSE 0 END,
          best_streak = GREATEST(player_stats.best_streak, $6),
          last_session_at = NOW(),
          updated_at = NOW()
      `, [player_id, statsSummary.total_putts, statsSummary.total_makes, statsSummary.total_misses, statsSummary.make_percentage, statsSummary.best_streak]);

      const response = { 
        success: true, 
        message: 'Session uploaded successfully', 
        session_id: finalSessionId,
        uploaded_at: new Date().toISOString()
      };
      
      // Add duel information to response if applicable
      if (duel_id) {
        response.duel_id = duel_id;
        response.duel_linked = true;
      }
      
      // Add league information to response if applicable
      if (league_round_id) {
        response.league_round_id = league_round_id;
        response.league_linked = true;
      }
      
      return res.status(200).json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[upload-session] Server error:', error.message);
    console.error('[upload-session] Stack trace:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${error.message}` 
    });
  }
}