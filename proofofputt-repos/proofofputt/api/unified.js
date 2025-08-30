export default function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const route = path ? path.join('/') : '';
  
  // Route to appropriate handler based on path
  if (route.startsWith('leagues')) {
    return handleLeagues(req, res, route);
  } else if (route.startsWith('duels')) {
    return handleDuels(req, res, route);
  } else if (route.startsWith('notifications')) {
    return handleNotifications(req, res, route);
  } else if (route.startsWith('players')) {
    return handlePlayers(req, res, route);
  }
  
  return res.status(404).json({ error: 'Route not found' });
}

function handleLeagues(req, res, route) {
  const { method } = req;
  
  if (route === 'leagues') {
    if (method === 'GET') {
      return res.status(200).json({
        leagues: [
          { id: 1, name: "Masters Champions", member_count: 24, is_member: true }
        ]
      });
    }
    if (method === 'POST') {
      return res.status(200).json({ success: true, league: { id: Date.now() } });
    }
  }
  
  if (route.includes('leaderboard')) {
    return res.status(200).json({
      leaderboard: [
        { player_id: 1, name: "Pop", sessions: 12, make_percentage: 74.4, rank: 1 }
      ]
    });
  }
  
  if (route.includes('join')) {
    return res.status(200).json({ success: true, message: "Joined league" });
  }
  
  return res.status(404).json({ error: 'League route not found' });
}

function handleDuels(req, res, route) {
  const { method } = req;
  
  if (route === 'duels') {
    if (method === 'POST') {
      return res.status(200).json({ success: true, duel: { id: Date.now() } });
    }
  }
  
  if (route.includes('list')) {
    return res.status(200).json({
      duels: [
        { id: 1, challenger_name: "Pop", opponent_name: "Tiger", status: "active" }
      ]
    });
  }
  
  if (route.includes('respond')) {
    return res.status(200).json({ success: true, message: "Duel response recorded" });
  }
  
  return res.status(404).json({ error: 'Duel route not found' });
}

function handleNotifications(req, res, route) {
  return res.status(200).json({
    notifications: [
      { id: 1, type: "duel_challenge", title: "New Challenge", read: false }
    ],
    unread_count: 1
  });
}

function handlePlayers(req, res, route) {
  if (route.includes('search')) {
    return res.status(200).json({
      players: [
        { id: 1, name: "Pop", make_percentage: 74.4 },
        { id: 2, name: "Tiger", make_percentage: 71.2 }
      ]
    });
  }
  
  if (route.includes('vs')) {
    return res.status(200).json({
      duels: [],
      head_to_head: { player1_wins: 1, player2_wins: 0 }
    });
  }
  
  return res.status(404).json({ error: 'Player route not found' });
}