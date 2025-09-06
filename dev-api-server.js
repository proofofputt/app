#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory storage for demo
let sessions = [
  {
    session_id: 'session_demo_1',
    player_id: 1,
    data: {
      total_putts: 15,
      total_makes: 12,
      total_misses: 3,
      make_percentage: 80.0,
      best_streak: 8,
      session_duration: 240.5,
      putts_per_minute: 3.75,
      makes_per_minute: 3.0,
      most_makes_in_60_seconds: 15,
      fastest_21_makes: 420.0,
      makes_overview: { TOP: 3, LOW: 4, LEFT: 3, RIGHT: 2 },
      misses_overview: { CATCH: 1, TIMEOUT: 1, RETURN: 1, 'QUICK PUTT': 0 }
    },
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    session_id: 'session_demo_2', 
    player_id: 1,
    data: {
      total_putts: 25,
      total_makes: 18,
      total_misses: 7,
      make_percentage: 72.0,
      best_streak: 6,
      session_duration: 480.2,
      putts_per_minute: 3.12,
      makes_per_minute: 2.25,
      most_makes_in_60_seconds: 12,
      fastest_21_makes: 560.0,
      makes_overview: { TOP: 4, LOW: 6, LEFT: 5, RIGHT: 3 },
      misses_overview: { CATCH: 2, TIMEOUT: 2, RETURN: 3, 'QUICK PUTT': 0 }
    },
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    session_id: 'session_demo_3',
    player_id: 1,
    data: {
      total_putts: 30,
      total_makes: 22,
      total_misses: 8,
      make_percentage: 73.33,
      best_streak: 11,
      session_duration: 600.1,
      putts_per_minute: 3.0,
      makes_per_minute: 2.2,
      most_makes_in_60_seconds: 18,
      fastest_21_makes: 385.0,
      makes_overview: { TOP: 5, LOW: 8, LEFT: 6, RIGHT: 3 },
      misses_overview: { CATCH: 3, TIMEOUT: 1, RETURN: 4, 'QUICK PUTT': 0 }
    },
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    updated_at: new Date(Date.now() - 1800000).toISOString()
  }
];
let players = { 
  1: { id: 1, player_id: 1, name: 'Demo Player', email: 'demo@demo.com', username: 'demo' },
  2: { id: 2, player_id: 2, name: 'Test Player 1', email: 'test1@test.com', username: 'test1' },
  3: { id: 3, player_id: 3, name: 'Test Player 2', email: 'test2@test.com', username: 'test2' }
};

console.log('🚀 Starting Proof of Putt Dev API Server...');

// Upload session endpoint
app.post('/api/upload-session', (req, res) => {
  console.log('\n📊 SESSION UPLOAD RECEIVED');
  console.log('================================');
  
  const { player_id, session_data, session_id } = req.body;
  
  console.log(`👤 Player ID: ${player_id}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`📝 Headers:`, req.headers['x-desktop-upload'] ? 'Desktop Upload' : 'Web Upload');
  
  if (session_data) {
    console.log(`📊 Session Data Summary:`);
    console.log(`   Total Putts: ${session_data.total_putts || 0}`);
    console.log(`   Total Makes: ${session_data.total_makes || 0}`);
    console.log(`   Best Streak: ${session_data.best_streak || 0}`);
    console.log(`   Duration: ${session_data.session_duration || 0}s`);
    console.log(`   Make %: ${session_data.make_percentage || 0}%`);
    
    if (session_data.makes_overview) {
      console.log(`   Makes Overview:`, session_data.makes_overview);
    }
    if (session_data.misses_overview) {
      console.log(`   Misses Overview:`, session_data.misses_overview);
    }
  }
  
  // Generate session ID
  const finalSessionId = session_id || `session_${Date.now()}`;
  
  // Store session
  const sessionRecord = {
    session_id: finalSessionId,
    player_id,
    data: session_data,
    stats_summary: {
      total_putts: session_data?.total_putts || 0,
      total_makes: session_data?.total_makes || 0,
      total_misses: session_data?.total_misses || 0,
      make_percentage: session_data?.make_percentage || 0,
      best_streak: session_data?.best_streak || 0,
      session_duration: session_data?.session_duration || 0,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  sessions.push(sessionRecord);
  console.log(`✅ Session stored with ID: ${finalSessionId}`);
  console.log(`📈 Total sessions in memory: ${sessions.length}`);
  console.log('================================\n');
  
  res.json({
    success: true,
    message: 'Session uploaded successfully',
    session_id: finalSessionId,
    uploaded_at: new Date().toISOString()
  });
});

// Get player sessions
app.get('/api/player/:playerId/sessions', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 21;
  
  const allPlayerSessions = sessions
    .filter(s => s.player_id === playerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
  // Calculate pagination
  const totalSessions = allPlayerSessions.length;
  const totalPages = Math.ceil(totalSessions / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedSessions = allPlayerSessions
    .slice(startIndex, endIndex)
    .map(session => ({
      ...session,
      // Map fields for compatibility with frontend
      session_duration: session.data?.session_duration || 0,
      makes: session.data?.total_makes || 0,
      misses: session.data?.total_misses || 0,
      total_putts: session.data?.total_putts || 0,
      make_percentage: session.data?.make_percentage || 0,
      best_streak: session.data?.best_streak || 0,
      fastest_21_makes: session.data?.fastest_21_makes,
      putts_per_minute: session.data?.putts_per_minute || 0,
      makes_per_minute: session.data?.makes_per_minute || 0,
      most_makes_in_60_seconds: session.data?.most_makes_in_60_seconds || 0
    }));
  
  console.log(`📋 GET /api/player/${playerId}/sessions?page=${page}&limit=${limit} - returning ${paginatedSessions.length}/${totalSessions} sessions (page ${page}/${totalPages})`);
  res.json({ 
    sessions: paginatedSessions,
    pagination: {
      current_page: page,
      total_pages: totalPages,
      total_count: totalSessions,
      per_page: limit
    }
  });
});

// Get player stats
app.get('/api/player/:playerId/stats', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const playerSessions = sessions.filter(s => s.player_id === playerId);
  const player = players[playerId];
  
  const stats = {
    player_id: playerId,
    player_name: player?.name || `Player ${playerId}`,
    is_subscribed: true, // For dev/testing purposes
    total_sessions: playerSessions.length,
    total_putts: playerSessions.reduce((sum, s) => sum + (s.data?.total_putts || 0), 0),
    total_makes: playerSessions.reduce((sum, s) => sum + (s.data?.total_makes || 0), 0),
    best_streak: Math.max(...playerSessions.map(s => s.data?.best_streak || 0), 0),
    last_session_at: playerSessions.length > 0 ? playerSessions[0].created_at : null
  };
  
  stats.make_percentage = stats.total_putts > 0 ? (stats.total_makes / stats.total_putts * 100).toFixed(2) : 0;
  
  console.log(`📊 GET /api/player/${playerId}/stats - ${stats.player_name}, ${stats.total_sessions} sessions, ${stats.total_putts} putts`);
  res.json(stats);
});

// Real leaderboards calculated from session data
app.get('/api/leaderboards-v2', (req, res) => {
  const metric = req.query.metric || 'total_makes';
  console.log(`🏆 GET /api/leaderboards-v2?metric=${metric}`);
  
  // Calculate leaderboards from actual session data
  const playerStats = {};
  
  // Aggregate data for each player
  Object.keys(players).forEach(playerId => {
    const playerSessions = sessions.filter(s => s.player_id === parseInt(playerId));
    const player = players[playerId];
    
    if (playerSessions.length > 0) {
      playerStats[playerId] = {
        player_id: parseInt(playerId),
        player_name: player.name,
        sessions_count: playerSessions.length,
        total_makes: playerSessions.reduce((sum, s) => sum + (s.data?.total_makes || 0), 0),
        total_putts: playerSessions.reduce((sum, s) => sum + (s.data?.total_putts || 0), 0),
        best_streak: Math.max(...playerSessions.map(s => s.data?.best_streak || 0), 0),
        makes_per_minute: playerSessions.reduce((sum, s) => sum + (s.data?.makes_per_minute || 0), 0) / playerSessions.length,
        fastest_21_makes_seconds: Math.min(...playerSessions.map(s => s.data?.fastest_21_makes || Infinity).filter(x => x !== Infinity), Infinity)
      };
      
      // Handle edge case where no valid fastest_21 times exist
      if (playerStats[playerId].fastest_21_makes_seconds === Infinity) {
        playerStats[playerId].fastest_21_makes_seconds = 0;
      }
    }
  });
  
  // Generate leaderboard based on metric
  let leaderboard = [];
  let sortKey, unit, displayName;
  
  switch(metric) {
    case 'makes':
    case 'total_makes':
      sortKey = 'total_makes';
      unit = 'makes';
      displayName = 'Total Makes';
      break;
    case 'best_streak':
      sortKey = 'best_streak';
      unit = 'consecutive';
      displayName = 'Best Streak';
      break;
    case 'makes_per_minute':
      sortKey = 'makes_per_minute';
      unit = 'per min';
      displayName = 'Makes Per Minute';
      break;
    case 'fastest_21_makes_seconds':
      sortKey = 'fastest_21_makes_seconds';
      unit = 'seconds';
      displayName = 'Fastest 21 Makes';
      break;
    default:
      sortKey = 'total_makes';
      unit = 'makes';
      displayName = 'Total Makes';
  }
  
  leaderboard = Object.values(playerStats)
    .filter(stats => stats[sortKey] > 0) // Only include players with valid data
    .sort((a, b) => {
      // For fastest_21, lower is better
      if (sortKey === 'fastest_21_makes_seconds') {
        return a[sortKey] - b[sortKey];
      }
      // For all others, higher is better
      return b[sortKey] - a[sortKey];
    })
    .map((stats, index) => ({
      player_id: stats.player_id,
      player_name: stats.player_name,
      value: sortKey === 'makes_per_minute' ? Math.round(stats[sortKey] * 10) / 10 : stats[sortKey],
      sessions_count: stats.sessions_count,
      rank: index + 1
    }));
  
  res.json({
    success: true,
    leaderboard,
    context: { context_name: 'All Players', context_type: 'global' },
    metric: { name: metric, display_name: displayName, unit }
  });
});

// Login endpoint for webapp
app.post('/api/login', (req, res) => {
  const { email, password, username } = req.body;
  const loginField = email || username;
  console.log(`🔐 LOGIN ATTEMPT - email/username: ${loginField}`);
  
  // Authentication for multiple test players
  let authenticatedPlayer = null;
  
  if ((loginField === 'demo@demo.com' || loginField === 'demo') && password === 'demo') {
    authenticatedPlayer = players[1];
  } else if ((loginField === 'test1@test.com' || loginField === 'test1') && password === 'test1') {
    authenticatedPlayer = players[2];
  } else if ((loginField === 'test2@test.com' || loginField === 'test2') && password === 'test2') {
    authenticatedPlayer = players[3];
  }
  
  if (authenticatedPlayer) {
    const token = `${authenticatedPlayer.username}-jwt-token-${Date.now()}`;
    console.log(`✅ LOGIN SUCCESS - Player ID ${authenticatedPlayer.player_id} (${authenticatedPlayer.name}) - issuing token: ${token}`);
    res.json({
      success: true,
      token,
      player: { 
        player_id: authenticatedPlayer.player_id, 
        id: authenticatedPlayer.id, 
        email: authenticatedPlayer.email, 
        name: authenticatedPlayer.name,
        username: authenticatedPlayer.username
      }
    });
  } else {
    console.log(`❌ LOGIN FAILED - invalid credentials for: ${loginField}`);
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Desktop status endpoint (used for connectivity verification)
app.get('/api/desktop/status', (req, res) => {
  console.log(`🖥️  GET /api/desktop/status - desktop connectivity check`);
  res.json({ 
    status: 'ok', 
    message: 'Desktop API ready', 
    server: 'dev-api-server',
    timestamp: new Date().toISOString()
  });
});

// Player data endpoint (fallback for connectivity verification)
app.get('/api/player/:playerId/data', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  console.log(`👤 GET /api/player/${playerId}/data - player data request`);
  
  if (players[playerId]) {
    res.json({
      success: true,
      player_id: playerId,
      name: players[playerId].name,
      email: 'demo@demo.com',
      username: players[playerId].name
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
  }
});

// Get latest sessions (for dashboard)
app.get('/api/player/:playerId/sessions/latest', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const limit = parseInt(req.query.limit) || 5;
  
  const latestSessions = sessions
    .filter(s => s.player_id === playerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(session => ({
      ...session,
      session_duration: session.data?.session_duration || 0,
      makes: session.data?.total_makes || 0,
      misses: session.data?.total_misses || 0,
      total_putts: session.data?.total_putts || 0,
      make_percentage: session.data?.make_percentage || 0,
      best_streak: session.data?.best_streak || 0
    }));
  
  console.log(`📋 GET /api/player/${playerId}/sessions/latest - returning ${latestSessions.length} recent sessions`);
  res.json({ sessions: latestSessions });
});

// Get player data (full profile)
app.get('/api/player/:playerId/data', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const player = players[playerId];
  
  if (player) {
    res.json({
      success: true,
      player_id: playerId,
      name: player.name,
      email: player.email,
      username: player.username,
      membership_tier: 'premium', // For dev/testing
      timezone: 'America/New_York',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
      last_active: new Date().toISOString(),
      total_sessions: sessions.filter(s => s.player_id === playerId).length,
      profile_complete: true
    });
    console.log(`👤 GET /api/player/${playerId}/data - returning profile for ${player.name}`);
  } else {
    res.status(404).json({ success: false, error: 'Player not found' });
  }
});

// Check desktop status
app.get('/api/desktop/check-status', (req, res) => {
  console.log(`🖥️  GET /api/desktop/check-status - desktop connectivity check`);
  res.json({
    status: 'connected',
    message: 'Desktop app is connected',
    server_time: new Date().toISOString()
  });
});

// Get notifications (empty for dev)
app.get('/api/player/:playerId/notifications', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  console.log(`🔔 GET /api/player/${playerId}/notifications - returning empty notifications`);
  res.json({ notifications: [], unread_count: 0 });
});

// Get unread notifications count
app.get('/api/player/:playerId/notifications/unread-count', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  console.log(`🔔 GET /api/player/${playerId}/notifications/unread-count - returning 0`);
  res.json({ unread_count: 0 });
});

// List duels (empty for dev)
app.get('/api/duels', (req, res) => {
  const playerId = parseInt(req.query.player_id);
  console.log(`⚔️ GET /api/duels?player_id=${playerId} - returning empty duels`);
  res.json({ duels: [] });
});

// List leagues (empty for dev)
app.get('/api/leagues', (req, res) => {
  const playerId = parseInt(req.query.player_id);
  console.log(`🏆 GET /api/leagues?player_id=${playerId} - returning empty leagues`);
  res.json({ leagues: [] });
});

// Start calibration (mock)
app.post('/api/start-calibration', (req, res) => {
  const { player_id } = req.body;
  console.log(`🎯 POST /api/start-calibration - player ${player_id}`);
  res.json({
    success: true,
    message: 'Calibration started (dev mode)',
    calibration_id: `cal_${Date.now()}`
  });
});

// Get calibration status
app.get('/api/player/:playerId/calibration', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  console.log(`🎯 GET /api/player/${playerId}/calibration - returning calibration status`);
  res.json({
    calibration_complete: true,
    last_calibrated: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  });
});

// Search players (mock)
app.get('/api/players/search', (req, res) => {
  const term = req.query.term || '';
  const excludeId = parseInt(req.query.exclude_player_id) || null;
  
  console.log(`🔍 GET /api/players/search?term=${term} - returning mock players`);
  
  const mockPlayers = Object.values(players)
    .filter(p => p.player_id !== excludeId)
    .filter(p => p.name.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 10);
    
  res.json({ players: mockPlayers });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Dev API server running', sessions: sessions.length });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Dev API Server running on http://localhost:${PORT}`);
  console.log(`🔗 Ready to receive session uploads at /api/upload-session`);
  console.log(`📊 Sessions will be stored in memory and logged to console`);
  console.log(`🌐 CORS enabled for webapp-clean development`);
  console.log('');
});