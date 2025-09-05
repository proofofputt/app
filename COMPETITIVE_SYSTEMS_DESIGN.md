# Competitive Systems Design: Asynchronous Duels & Leagues

## Overview
This document outlines the architecture for asynchronous competitive features in Proof of Putt, allowing players to compete without being online simultaneously.

## 1. Asynchronous Duel System

### 1.1 Duel Flow Architecture
```
Player A Challenge → Duel Created (pending) → Player B Session → Duel Active → Player A Session → Duel Completed
```

**Key Features:**
- **Time-shifted competition**: Players complete sessions at different times
- **Multiple duel types**: Practice matches, ranked duels, tournament brackets
- **Auto-expiration**: Duels expire if not completed within timeframe
- **Session validation**: Ensures fair play through session data analysis

### 1.2 Database Schema (Already Implemented)
```sql
duels (
  duel_id SERIAL PRIMARY KEY,
  challenger_id INTEGER,      -- Player who initiated
  challenged_id INTEGER,      -- Player who was challenged  
  status VARCHAR(20),         -- 'pending', 'active', 'completed', 'cancelled'
  rules JSONB,               -- Duel configuration
  challenger_session_id VARCHAR(255),
  challenged_session_id VARCHAR(255),
  winner_id INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

### 1.3 Duel Rules Configuration
```json
{
  "duel_type": "standard|speed|endurance|accuracy",
  "time_limit_hours": 48,
  "target_putts": 50,
  "scoring_method": "total_makes|make_percentage|best_streak|fastest_time",
  "handicap_enabled": true,
  "entry_stakes": 0,
  "auto_accept": false
}
```

### 1.4 Duel States & Transitions
1. **PENDING**: Challenge sent, waiting for acceptance
2. **ACTIVE**: Both players accepted, sessions being completed
3. **COMPLETED**: Both sessions submitted, winner determined  
4. **CANCELLED**: Expired or manually cancelled
5. **DISPUTED**: Flagged for review (future feature)

## 2. Asynchronous League System

### 2.1 League Round Architecture
```
League Created → Round 1 Starts → Players Submit Sessions → Round 1 Ends → Scoring → Round 2 Starts...
```

**Key Features:**
- **Round-based competition**: Weekly/monthly rounds with specific challenges
- **Flexible scheduling**: Players complete sessions within round timeframe
- **Progressive scoring**: Points accumulate across multiple rounds
- **Division system**: Players compete in skill-appropriate tiers

### 2.2 Database Schema (Already Implemented)
```sql
leagues (
  league_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  league_type VARCHAR(50),    -- 'weekly', 'monthly', 'season'
  status VARCHAR(20),         -- 'draft', 'active', 'completed'
  rules JSONB,               -- League configuration
  max_members INTEGER,
  start_date TIMESTAMP,
  end_date TIMESTAMP
)

league_memberships (
  league_id INTEGER,
  player_id INTEGER,
  joined_at TIMESTAMP,
  is_active BOOLEAN
)
```

### 2.3 League Rules Configuration
```json
{
  "league_type": "weekly|monthly|season",
  "round_duration_days": 7,
  "rounds_total": 12,
  "min_sessions_per_round": 3,
  "max_sessions_per_round": 10,
  "scoring_method": "cumulative|average|best_session",
  "handicap_system": "elo|percentage|none",
  "promotion_relegation": true,
  "entry_fee": 0,
  "prize_distribution": [50, 30, 20]
}
```

## 3. Session Integration

### 3.1 Competitive Session Metadata
When a session is uploaded, it can be linked to competitive contexts:
```json
{
  "session_id": "uuid",
  "player_id": 1,
  "competitive_context": {
    "type": "duel|league|tournament",
    "context_id": 123,
    "round_id": 456,
    "submitted_at": "2025-09-05T12:00:00Z"
  },
  "session_data": {
    // Standard SessionReporter data
  }
}
```

### 3.2 Scoring Algorithms

#### Duel Scoring
```javascript
function scoreDuel(session1, session2, rules) {
  switch(rules.scoring_method) {
    case 'total_makes':
      return session1.total_makes > session2.total_makes ? 1 : 2;
    case 'make_percentage':
      return session1.make_percentage > session2.make_percentage ? 1 : 2;
    case 'best_streak':
      return session1.best_streak > session2.best_streak ? 1 : 2;
    case 'fastest_time':
      return session1.fastest_21_makes < session2.fastest_21_makes ? 1 : 2;
  }
}
```

#### League Scoring
```javascript
function scoreLeagueRound(sessions, rules) {
  return sessions.map(session => {
    let points = 0;
    switch(rules.scoring_method) {
      case 'cumulative':
        points = session.total_makes;
        break;
      case 'percentage':
        points = session.make_percentage * 100;
        break;
      case 'streak':
        points = session.best_streak * 10;
        break;
    }
    return { player_id: session.player_id, points, session_id: session.session_id };
  });
}
```

## 4. API Endpoints Architecture

### 4.1 Duel Management APIs
```
POST   /api/duels              - Create new duel challenge
GET    /api/duels              - List player's duels
GET    /api/duels/{id}         - Get duel details
POST   /api/duels/{id}/accept  - Accept duel challenge
POST   /api/duels/{id}/submit  - Submit session for duel
DELETE /api/duels/{id}         - Cancel/decline duel
```

### 4.2 League Management APIs
```
POST   /api/leagues            - Create new league
GET    /api/leagues            - List available leagues
GET    /api/leagues/{id}       - Get league details
POST   /api/leagues/{id}/join  - Join league
GET    /api/leagues/{id}/rounds - Get league rounds
GET    /api/leagues/{id}/leaderboard - Get league standings
```

## 5. Implementation Priority

### Phase 1: Basic Duels ✅ (Next)
- Duel creation and acceptance
- Session submission and basic scoring
- Winner determination for standard metrics

### Phase 2: Enhanced Duels
- Multiple duel types (speed, accuracy, endurance)
- Handicap system
- Duel history and statistics

### Phase 3: Basic Leagues
- League creation and membership
- Round-based competition
- Simple point accumulation

### Phase 4: Advanced Features
- Tournament brackets
- Division/promotion system
- Prize pool management
- Real-time notifications

## 6. Data Flow Examples

### 6.1 Typical Duel Flow
1. **Player A creates duel**: `POST /api/duels { challenged_id: 2, rules: {...} }`
2. **Player B sees challenge**: `GET /api/duels` (status: pending)
3. **Player B accepts**: `POST /api/duels/123/accept`
4. **Player B completes session**: Normal session upload with `competitive_context`
5. **System updates duel**: Status → active, challenged_session_id set
6. **Player A completes session**: Upload with competitive context
7. **System scores duel**: Calculate winner, status → completed
8. **Players see results**: `GET /api/duels/123` shows winner and detailed comparison

### 6.2 Typical League Round Flow
1. **Round starts automatically**: System creates new round for active leagues
2. **Players submit sessions**: Normal uploads with league context
3. **Round deadline approaches**: Notifications sent to incomplete players
4. **Round ends**: System calculates scores and updates leaderboard
5. **New round starts**: Process repeats with updated standings

## 7. Technical Considerations

### 7.1 Session Validation
- Prevent session replay attacks
- Validate session timestamps
- Check for anomalous performance patterns
- Ensure sessions meet minimum requirements

### 7.2 Performance Optimization
- Index competitive context queries
- Cache active duel/league lists
- Batch scoring calculations
- Use triggers for automatic state updates

### 7.3 Fairness Mechanisms
- Session similarity detection
- Statistical outlier flagging
- Handicap system for skill matching
- Time zone considerations for deadlines

This architecture provides a robust foundation for competitive features while maintaining the asynchronous, practice-focused nature of Proof of Putt.