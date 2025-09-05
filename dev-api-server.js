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
let sessions = [];
let players = { 1: { id: 1, name: 'Demo Player' } };

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
  const limit = parseInt(req.query.limit) || 10;
  
  const playerSessions = sessions
    .filter(s => s.player_id === playerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
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
  
  console.log(`📋 GET /api/player/${playerId}/sessions - returning ${playerSessions.length} sessions`);
  res.json({ sessions: playerSessions });
});

// Get player stats
app.get('/api/player/:playerId/stats', (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const playerSessions = sessions.filter(s => s.player_id === playerId);
  
  const stats = {
    total_sessions: playerSessions.length,
    total_putts: playerSessions.reduce((sum, s) => sum + (s.data?.total_putts || 0), 0),
    total_makes: playerSessions.reduce((sum, s) => sum + (s.data?.total_makes || 0), 0),
    best_streak: Math.max(...playerSessions.map(s => s.data?.best_streak || 0), 0),
    last_session_at: playerSessions.length > 0 ? playerSessions[0].created_at : null
  };
  
  stats.make_percentage = stats.total_putts > 0 ? (stats.total_makes / stats.total_putts * 100).toFixed(2) : 0;
  
  console.log(`📊 GET /api/player/${playerId}/stats - ${stats.total_sessions} sessions, ${stats.total_putts} putts`);
  res.json(stats);
});

// Mock leaderboards
app.get('/api/leaderboards-v2', (req, res) => {
  const metric = req.query.metric || 'total_makes';
  console.log(`🏆 GET /api/leaderboards-v2?metric=${metric}`);
  
  res.json({
    success: true,
    leaderboard: [
      { player_id: 1, player_name: 'Demo Player', value: 150, sessions_count: 10, rank: 1 }
    ],
    context: { context_name: 'All Players', context_type: 'global' },
    metric: { name: metric, display_name: metric.replace('_', ' '), unit: 'putts' }
  });
});

// Login endpoint for webapp
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 LOGIN ATTEMPT - username: ${username}`);
  
  // Simple demo authentication
  if (username === 'demo' && password === 'demo') {
    const token = 'demo-jwt-token-' + Date.now();
    console.log(`✅ LOGIN SUCCESS - issuing token: ${token}`);
    res.json({
      success: true,
      token,
      user: { id: 1, username: 'demo', name: 'Demo Player' }
    });
  } else {
    console.log(`❌ LOGIN FAILED - invalid credentials`);
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
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