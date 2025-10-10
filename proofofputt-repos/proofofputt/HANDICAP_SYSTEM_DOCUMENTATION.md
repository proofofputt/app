# Proof of Putt Handicap System Documentation

## Overview

The Proof of Putt handicap system provides fair competition between players of different skill levels by adjusting scores based on performance history. The system is built around the **Makes Per Minute (MPM)** metric, which scales appropriately for both timed sessions and shoot-out competitions.

---

## Handicap Calculation

### Qualifying Sessions

To receive a handicap, players must complete **21 qualifying sessions** with the following criteria:

- **Session Type**: Must be `timed` or `practice` sessions
- **Minimum Duration**: At least 5 minutes (300 seconds)
- **Valid Data**: Must have valid `makes_per_minute` data

### Calculation Method

The handicap is calculated using the **50th-75th percentile** of MPM values from all qualifying sessions:

1. **Collect all qualifying sessions** for the player
2. **Extract MPM values** and sort them
3. **Select middle-upper performance range** (50-75th percentile)
   - This avoids penalizing outlier great performances
   - This avoids including abandoned/poor sessions
4. **Average the selected values**
5. **Round to 2 decimal places**

#### Example Calculation

Player with 25 qualifying sessions, MPM values sorted: `[3.2, 3.5, 3.8, ..., 7.2, 7.5, 8.1]`

- 50th percentile index: `25 * 0.50 = 12` → MPM value: `5.4`
- 75th percentile index: `25 * 0.75 = 19` → MPM value: `6.8`
- Values used: MPM values from index 12 to 19 (8 values)
- Average: `(5.4 + 5.6 + 5.8 + 6.0 + 6.2 + 6.4 + 6.6 + 6.8) / 8 = 6.1`
- **Handicap: 6.10 MPM**

---

## Handicap Application in Competition

### Timed Sessions (Time Limit Mode)

For timed duels and leagues:

```
Adjusted Score = Raw Makes + Handicap Adjustment

Handicap Adjustment = (Actual MPM - Player Handicap) × Duration (minutes)
```

#### Example:
- Player handicap: **6.1 MPM**
- Session: **2 minutes**, **14 makes**
- Actual MPM: **14 / 2 = 7.0 MPM**
- Adjustment: **(7.0 - 6.1) × 2 = +1.8**
- **Adjusted Score: 14 + 1.8 = 15.8 makes**

This player performed **above** their handicap, so they receive a positive adjustment.

### Shoot-Out Mode

For shoot-out competitions, the handicap is converted to expected makes for the competition:

```
Estimated Time = Max Attempts / Avg Putts Per Minute (default: 12)
Expected Makes = Player Handicap × Estimated Time
Handicap Adjustment = Actual Makes - Expected Makes
Adjusted Score = ROUND(Actual Makes + Handicap Adjustment)
```

#### Example:
- Player handicap: **6.1 MPM**
- Shoot-out: **50 attempts max**
- Estimated time: **50 / 12 ≈ 4.17 minutes**
- Expected makes: **6.1 × 4.17 ≈ 25.4 makes**
- Actual makes: **28**
- Adjustment: **28 - 25.4 = +2.6**
- **Adjusted Score: ROUND(28 + 2.6) = 31 makes**

For shoot-out display, the score is **rounded to the nearest whole number**.

---

## Database Schema

### Users Table Additions

```sql
ALTER TABLE users ADD COLUMN handicap DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN handicap_last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE users ADD COLUMN handicap_qualifying_sessions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN profile_picture_url TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN social_links JSONB DEFAULT NULL;
```

### Handicap History Table

```sql
CREATE TABLE handicap_history (
    history_id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handicap_value DECIMAL(5,2) NOT NULL,
    qualifying_sessions INTEGER NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_data JSONB DEFAULT NULL
);
```

---

## API Endpoints

### GET `/api/calculate-handicap?player_id={id}`

Retrieve current handicap for a player.

**Response:**
```json
{
  "success": true,
  "handicap": 6.10,
  "lastCalculated": "2025-10-09T10:30:00Z",
  "qualifyingSessions": 25
}
```

### POST `/api/calculate-handicap`

Recalculate handicap for authenticated player.

**Request Body:**
```json
{
  "force": true  // Optional: force recalculation even if done recently
}
```

**Response:**
```json
{
  "success": true,
  "handicap": 6.15,
  "qualifyingSessions": 26,
  "percentileData": {
    "p50": 5.4,
    "p75": 6.8,
    "valuesUsed": 8,
    "range": [5.4, 6.8]
  },
  "message": "Handicap calculated successfully"
}
```

### PUT `/api/calculate-handicap`

Update player profile information.

**Request Body:**
```json
{
  "profile_picture_url": "https://example.com/avatar.jpg",
  "bio": "Avid putter from Portland",
  "social_links": {
    "twitter": "username",
    "instagram": "username",
    "youtube": "https://youtube.com/@username",
    "website": "https://example.com"
  }
}
```

---

## UI Components

### Career Stats Page - Profile Section

The career stats page now includes:

1. **Profile Information** (left side):
   - Avatar (profile picture or placeholder with initial)
   - Player name
   - Bio
   - Social media links

2. **Handicap Display** (right side - prominent square):
   - Handicap value in large text
   - "Makes Per Minute" subtitle
   - Recalculate button (for own profile)
   - OR progress toward 21 sessions

#### Display States:

**With Handicap:**
```
┌─────────────────┐
│    HANDICAP     │
│      6.15       │
│ Makes Per Minute│
│  [Recalculate]  │
└─────────────────┘
```

**Without Handicap:**
```
┌─────────────────┐
│    HANDICAP     │
│       —         │
│  12 / 21        │
│ Complete 9 more │
│ 5+ min sessions │
└─────────────────┘
```

---

## Competition Rules Integration

### Enabling Handicap in Duels

```javascript
// When creating a duel
{
  "invited_player_id": 2,
  "rules": {
    "competition_mode": "time_limit",
    "session_duration_limit_minutes": 5,
    "handicap_enabled": true,  // Enable handicap
    "scoring_method": "total_makes"
  }
}
```

### Enabling Handicap in Leagues

```javascript
// When creating a league
{
  "name": "Masters Championship",
  "rules": {
    "round_duration_days": 7,
    "handicap_system": "mpm",  // Use MPM-based handicap
    "scoring_method": "cumulative"
  }
}
```

---

## Fair Play Principles

### Why 50-75th Percentile?

1. **Avoids Over-Penalizing Great Golfers**: Using only top performances would punish skilled players
2. **Ignores Abandoned Sessions**: Very poor performances (bottom 50%) are excluded
3. **Represents Consistent Ability**: Middle-upper range shows sustainable skill level
4. **Prevents Sandbagging**: Can't artificially lower handicap through poor play

### Why 21 Sessions Minimum?

1. **Statistical Significance**: Need adequate sample size for accurate handicap
2. **Prevents Gaming**: Too few sessions could be manipulated
3. **Skill Development**: Gives new players time to establish their true ability
4. **Golf Tradition**: Matches USGA handicap minimum rounds (20)

### Recalculation Frequency

- **Automatic**: Triggered when player requests (max once per 24 hours)
- **Manual**: Players can force recalculation via UI
- **Recommended**: Recalculate after every 5-10 new qualifying sessions

---

## Testing Checklist

### Handicap Calculation
- [ ] Player with 0 sessions → handicap = NULL, message shown
- [ ] Player with 15 sessions → handicap = NULL, "6 more needed" message
- [ ] Player with 21+ sessions → handicap calculated correctly
- [ ] 50-75th percentile logic verified with sample data
- [ ] Recalculation respects 24-hour cooldown
- [ ] Force recalculation works

### Timed Competition Scoring
- [ ] Non-handicap duel: raw scores used
- [ ] Handicap-enabled duel: adjusted scores calculated
- [ ] Player above handicap gets positive adjustment
- [ ] Player below handicap gets negative adjustment
- [ ] Scores never go below 0

### Shoot-Out Competition Scoring
- [ ] Non-handicap shootout: raw scores used
- [ ] Handicap-enabled shootout: adjusted scores calculated
- [ ] Scores round to whole numbers
- [ ] Various max_attempts values work correctly

### UI Components
- [ ] Profile section displays correctly
- [ ] Handicap square shows value when available
- [ ] Progress display shows sessions/21 when no handicap
- [ ] Recalculate button works for own profile
- [ ] Social links display and work correctly
- [ ] Mobile responsive layout functions

---

## Future Enhancements

### Potential Improvements

1. **Handicap Trends**: Show graph of handicap changes over time
2. **Handicap Divisions**: Create skill-based leagues (0-3 MPM, 3-6 MPM, 6+ MPM)
3. **Seasonal Handicaps**: Reset or adjust handicaps each season
4. **Team Handicaps**: Combined handicap for team competitions
5. **Handicap Verification**: Require minimum sessions in specific time period
6. **Performance Index**: Additional metric beyond MPM (accuracy, streaks, etc.)

---

## Support and Maintenance

### Common Issues

**Issue**: Handicap not calculating
- **Check**: Player has 21+ qualifying sessions (5+ minutes, timed/practice)
- **Check**: Sessions have valid `makes_per_minute` data
- **Solution**: Review session data quality

**Issue**: Handicap seems incorrect
- **Check**: Calculation percentile range (50-75th)
- **Check**: Session filtering criteria
- **Solution**: Manually verify sample calculation

**Issue**: Scores not adjusting in competition
- **Check**: `handicap_enabled` flag in competition rules
- **Check**: Both players have valid handicaps
- **Solution**: Verify handicap exists in database

---

## Migration Instructions

To deploy the handicap system:

1. **Run database migration**:
   ```bash
   psql $DATABASE_URL -f database/add_handicap_system.sql
   ```

2. **Deploy API updates**:
   - `app/api/calculate-handicap.js`
   - `app/api/duels-v2.js`
   - `app/utils/handicap.js`

3. **Deploy frontend updates**:
   - `app/src/pages/PlayerCareerPage.jsx`
   - `app/src/pages/PlayerCareerPage.css`
   - `app/src/components/AchievementCertificates.jsx`
   - `app/src/components/AchievementCertificates.css`

4. **Test in production**:
   - Create test duel with handicap enabled
   - Verify score calculations
   - Check UI display

---

**Last Updated**: October 9, 2025
**Version**: 1.0
**Status**: Production Ready
