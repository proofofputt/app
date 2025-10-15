# Networking Preferences System Design

> **Purpose:** Enable automated introductions between users based on locality, professional background, sports interests, and general interests.

---

## Table of Contents
1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [UI Components](#ui-components)
4. [Matching Algorithm](#matching-algorithm)
5. [Implementation Plan](#implementation-plan)

---

## Database Schema

### Option 1: Extended Players Table (Recommended for MVP)

Add columns to existing `players` table:

```sql
-- Networking Preferences Migration
ALTER TABLE players ADD COLUMN IF NOT EXISTS networking_preferences JSONB DEFAULT '{
  "locality": {
    "country": null,
    "state_province": null,
    "city": null,
    "postal_code": null,
    "willing_to_travel": false,
    "travel_radius_miles": null
  },
  "professional": {
    "industry": null,
    "role": null,
    "company_size": null,
    "years_experience": null,
    "looking_for": []
  },
  "sports": {
    "handicap": null,
    "years_playing_golf": null,
    "home_course": null,
    "play_frequency": null,
    "interested_in": [],
    "skill_level": null
  },
  "interests": {
    "categories": [],
    "goals": [],
    "open_to_mentoring": false,
    "seeking_mentor": false
  }
}'::jsonb;

-- Add networking opt-in flag
ALTER TABLE players ADD COLUMN IF NOT EXISTS networking_enabled BOOLEAN DEFAULT FALSE;

-- Add privacy settings
ALTER TABLE players ADD COLUMN IF NOT EXISTS networking_privacy JSONB DEFAULT '{
  "show_locality": true,
  "show_professional": true,
  "show_sports": true,
  "show_interests": true,
  "discoverable": true
}'::jsonb;

-- Index for JSON queries (performance)
CREATE INDEX IF NOT EXISTS idx_players_networking_prefs ON players USING gin(networking_preferences);
CREATE INDEX IF NOT EXISTS idx_players_networking_enabled ON players(networking_enabled) WHERE networking_enabled = TRUE;

COMMENT ON COLUMN players.networking_preferences IS 'User preferences for automated networking and introductions';
COMMENT ON COLUMN players.networking_enabled IS 'Whether user has opted into networking features';
COMMENT ON COLUMN players.networking_privacy IS 'Privacy settings for networking profile visibility';
```

### Option 2: Separate Preferences Table (Better for Scale)

```sql
-- User Networking Profiles Table
CREATE TABLE IF NOT EXISTS user_networking_profiles (
  profile_id SERIAL PRIMARY KEY,
  player_id INTEGER UNIQUE REFERENCES players(player_id) ON DELETE CASCADE,

  -- Locality
  country VARCHAR(100),
  state_province VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  willing_to_travel BOOLEAN DEFAULT FALSE,
  travel_radius_miles INTEGER,

  -- Professional
  industry VARCHAR(100),
  role VARCHAR(100),
  company_size VARCHAR(50), -- 'startup', 'small', 'medium', 'large', 'enterprise'
  years_experience INTEGER,
  professional_goals TEXT[], -- Array of goals

  -- Sports/Golf
  golf_handicap DECIMAL(4,1),
  years_playing_golf INTEGER,
  home_course VARCHAR(200),
  play_frequency VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'occasional'
  golf_interests TEXT[], -- 'competitive', 'casual', 'coaching', 'equipment'
  skill_level VARCHAR(50), -- 'beginner', 'intermediate', 'advanced', 'professional'

  -- General Interests
  interest_categories TEXT[], -- Array of interests
  networking_goals TEXT[], -- 'business', 'friendship', 'mentorship', 'collaboration'
  open_to_mentoring BOOLEAN DEFAULT FALSE,
  seeking_mentor BOOLEAN DEFAULT FALSE,

  -- Settings
  networking_enabled BOOLEAN DEFAULT FALSE,
  discoverable BOOLEAN DEFAULT TRUE,
  show_locality BOOLEAN DEFAULT TRUE,
  show_professional BOOLEAN DEFAULT TRUE,
  show_sports BOOLEAN DEFAULT TRUE,
  show_interests BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient matching
CREATE INDEX IF NOT EXISTS idx_networking_enabled ON user_networking_profiles(networking_enabled) WHERE networking_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_networking_locality ON user_networking_profiles(country, state_province, city) WHERE networking_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_networking_industry ON user_networking_profiles(industry) WHERE networking_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_networking_interests ON user_networking_profiles USING gin(interest_categories);
CREATE INDEX IF NOT EXISTS idx_networking_golf_interests ON user_networking_profiles USING gin(golf_interests);

-- Introduction matches table
CREATE TABLE IF NOT EXISTS networking_introductions (
  introduction_id SERIAL PRIMARY KEY,
  player_1_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
  player_2_id INTEGER REFERENCES players(player_id) ON DELETE CASCADE,
  match_score DECIMAL(5,2), -- 0-100 compatibility score
  match_reasons JSONB, -- Why they matched
  status VARCHAR(50) DEFAULT 'suggested', -- 'suggested', 'accepted', 'declined', 'connected'
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(player_1_id, player_2_id)
);

CREATE INDEX IF NOT EXISTS idx_introductions_player ON networking_introductions(player_1_id, status);
CREATE INDEX IF NOT EXISTS idx_introductions_score ON networking_introductions(match_score DESC) WHERE status = 'suggested';
```

---

## API Endpoints

### 1. Get Networking Preferences
```
GET /api/networking/preferences
Authorization: Bearer <token>

Response:
{
  "success": true,
  "preferences": {
    "locality": { ... },
    "professional": { ... },
    "sports": { ... },
    "interests": { ... }
  },
  "privacy": { ... },
  "networking_enabled": true
}
```

### 2. Update Networking Preferences
```
PUT /api/networking/preferences
Authorization: Bearer <token>

Body:
{
  "locality": {
    "country": "United States",
    "state_province": "California",
    "city": "San Francisco",
    "postal_code": "94102",
    "willing_to_travel": true,
    "travel_radius_miles": 50
  },
  "professional": {
    "industry": "Technology",
    "role": "Software Engineer",
    "company_size": "startup",
    "years_experience": 5,
    "looking_for": ["networking", "collaboration", "mentorship"]
  },
  "sports": {
    "handicap": 12.5,
    "years_playing_golf": 8,
    "home_course": "Pebble Beach Golf Links",
    "play_frequency": "weekly",
    "interested_in": ["competitive", "coaching"],
    "skill_level": "intermediate"
  },
  "interests": {
    "categories": ["technology", "entrepreneurship", "fitness"],
    "goals": ["business networking", "find golf partners"],
    "open_to_mentoring": true,
    "seeking_mentor": false
  }
}

Response:
{
  "success": true,
  "message": "Networking preferences updated",
  "preferences": { ... }
}
```

### 3. Get Suggested Introductions
```
GET /api/networking/suggestions?limit=10
Authorization: Bearer <token>

Response:
{
  "success": true,
  "suggestions": [
    {
      "player_id": 42,
      "name": "John Doe",
      "display_name": "JohnD",
      "match_score": 85,
      "match_reasons": [
        "Same city (San Francisco)",
        "Similar industry (Technology)",
        "Similar golf skill level (handicap 10-15)",
        "Both interested in competitive golf",
        "Both seeking business networking"
      ],
      "shared_interests": ["technology", "competitive golf"],
      "locality_match": true,
      "professional_match": true
    }
  ]
}
```

### 4. Respond to Introduction
```
POST /api/networking/respond
Authorization: Bearer <token>

Body:
{
  "introduction_id": 123,
  "action": "accept" // or "decline"
}

Response:
{
  "success": true,
  "message": "Introduction accepted. You can now connect with John Doe.",
  "connection": {
    "player_id": 42,
    "name": "John Doe",
    "contact_info": { ... }
  }
}
```

---

## UI Components

### Settings Page Integration

Add new section to existing Settings page:

```jsx
// In SettingsPage.jsx - New Section

<div className="settings-section">
  <h2>🤝 Networking Preferences</h2>
  <p className="section-description">
    Configure your networking profile to receive automated introductions
    to other players based on location, professional background, and interests.
  </p>

  {/* Master Toggle */}
  <div className="networking-toggle">
    <label>
      <input
        type="checkbox"
        checked={networkingEnabled}
        onChange={handleNetworkingToggle}
      />
      <span>Enable Automated Introductions</span>
    </label>
    <p className="toggle-help">
      When enabled, we'll suggest connections with other players who share
      your location, professional interests, or golf preferences.
    </p>
  </div>

  {networkingEnabled && (
    <>
      {/* Locality Section */}
      <div className="preference-group">
        <h3>📍 Locality</h3>

        <div className="form-group">
          <label>Country</label>
          <select value={preferences.locality.country} onChange={...}>
            <option value="">Select Country</option>
            <option value="United States">United States</option>
            <option value="Canada">Canada</option>
            <option value="United Kingdom">United Kingdom</option>
            {/* ... more countries */}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>State/Province</label>
            <input
              type="text"
              value={preferences.locality.state_province}
              onChange={...}
              placeholder="e.g., California"
            />
          </div>

          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              value={preferences.locality.city}
              onChange={...}
              placeholder="e.g., San Francisco"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={preferences.locality.willing_to_travel}
              onChange={...}
            />
            <span>Willing to travel for connections</span>
          </label>
        </div>

        {preferences.locality.willing_to_travel && (
          <div className="form-group">
            <label>Travel Radius (miles)</label>
            <input
              type="number"
              value={preferences.locality.travel_radius_miles}
              onChange={...}
              placeholder="e.g., 50"
            />
          </div>
        )}
      </div>

      {/* Professional Section */}
      <div className="preference-group">
        <h3>💼 Professional</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Industry</label>
            <select value={preferences.professional.industry} onChange={...}>
              <option value="">Select Industry</option>
              <option value="Technology">Technology</option>
              <option value="Finance">Finance</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Consulting">Consulting</option>
              <option value="Education">Education</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Retail">Retail</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Role</label>
            <input
              type="text"
              value={preferences.professional.role}
              onChange={...}
              placeholder="e.g., Software Engineer"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Company Size</label>
            <select value={preferences.professional.company_size} onChange={...}>
              <option value="">Select Size</option>
              <option value="startup">Startup (1-50)</option>
              <option value="small">Small (51-200)</option>
              <option value="medium">Medium (201-1000)</option>
              <option value="large">Large (1001-10000)</option>
              <option value="enterprise">Enterprise (10000+)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Years Experience</label>
            <input
              type="number"
              value={preferences.professional.years_experience}
              onChange={...}
              placeholder="e.g., 5"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Looking For (select all that apply)</label>
          <div className="checkbox-group">
            <label><input type="checkbox" value="networking" /> Business Networking</label>
            <label><input type="checkbox" value="collaboration" /> Collaboration Opportunities</label>
            <label><input type="checkbox" value="mentorship" /> Mentorship</label>
            <label><input type="checkbox" value="hiring" /> Hiring/Recruiting</label>
            <label><input type="checkbox" value="partnership" /> Business Partnership</label>
          </div>
        </div>
      </div>

      {/* Sports/Golf Section */}
      <div className="preference-group">
        <h3>⛳ Golf & Sports</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Golf Handicap</label>
            <input
              type="number"
              step="0.1"
              value={preferences.sports.handicap}
              onChange={...}
              placeholder="e.g., 12.5"
            />
          </div>

          <div className="form-group">
            <label>Years Playing Golf</label>
            <input
              type="number"
              value={preferences.sports.years_playing_golf}
              onChange={...}
              placeholder="e.g., 8"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Home Course</label>
          <input
            type="text"
            value={preferences.sports.home_course}
            onChange={...}
            placeholder="e.g., Pebble Beach Golf Links"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Play Frequency</label>
            <select value={preferences.sports.play_frequency} onChange={...}>
              <option value="">Select Frequency</option>
              <option value="daily">Daily</option>
              <option value="weekly">2-3 times per week</option>
              <option value="monthly">Once a week</option>
              <option value="occasional">Occasionally</option>
            </select>
          </div>

          <div className="form-group">
            <label>Skill Level</label>
            <select value={preferences.sports.skill_level} onChange={...}>
              <option value="">Select Level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="professional">Professional</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Interested In (select all that apply)</label>
          <div className="checkbox-group">
            <label><input type="checkbox" value="competitive" /> Competitive Golf</label>
            <label><input type="checkbox" value="casual" /> Casual Play</label>
            <label><input type="checkbox" value="coaching" /> Coaching/Instruction</label>
            <label><input type="checkbox" value="equipment" /> Equipment Discussion</label>
            <label><input type="checkbox" value="travel" /> Golf Travel</label>
          </div>
        </div>
      </div>

      {/* General Interests Section */}
      <div className="preference-group">
        <h3>🎯 Interests & Goals</h3>

        <div className="form-group">
          <label>Interest Categories (select all that apply)</label>
          <div className="checkbox-group">
            <label><input type="checkbox" value="technology" /> Technology</label>
            <label><input type="checkbox" value="entrepreneurship" /> Entrepreneurship</label>
            <label><input type="checkbox" value="finance" /> Finance & Investing</label>
            <label><input type="checkbox" value="fitness" /> Health & Fitness</label>
            <label><input type="checkbox" value="travel" /> Travel</label>
            <label><input type="checkbox" value="philanthropy" /> Philanthropy</label>
            <label><input type="checkbox" value="arts" /> Arts & Culture</label>
            <label><input type="checkbox" value="sports" /> Other Sports</label>
          </div>
        </div>

        <div className="form-group">
          <label>Networking Goals (select all that apply)</label>
          <div className="checkbox-group">
            <label><input type="checkbox" value="business" /> Business Networking</label>
            <label><input type="checkbox" value="friendship" /> Social Connections</label>
            <label><input type="checkbox" value="mentorship" /> Mentorship</label>
            <label><input type="checkbox" value="collaboration" /> Collaboration</label>
            <label><input type="checkbox" value="golf_partners" /> Find Golf Partners</label>
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={preferences.interests.open_to_mentoring}
              onChange={...}
            />
            <span>Open to mentoring others</span>
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={preferences.interests.seeking_mentor}
              onChange={...}
            />
            <span>Seeking a mentor</span>
          </label>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="preference-group">
        <h3>🔒 Privacy Settings</h3>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={privacy.discoverable}
              onChange={...}
            />
            <span>Make my profile discoverable for introductions</span>
          </label>
        </div>

        <div className="form-group">
          <label>What information to show in introduction suggestions:</label>
          <div className="checkbox-group">
            <label>
              <input type="checkbox" checked={privacy.show_locality} onChange={...} />
              Locality (city, state)
            </label>
            <label>
              <input type="checkbox" checked={privacy.show_professional} onChange={...} />
              Professional Info (industry, role)
            </label>
            <label>
              <input type="checkbox" checked={privacy.show_sports} onChange={...} />
              Golf Info (handicap, interests)
            </label>
            <label>
              <input type="checkbox" checked={privacy.show_interests} onChange={...} />
              General Interests
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSavePreferences}
        >
          💾 Save Networking Preferences
        </button>
      </div>
    </>
  )}
</div>
```

### New Networking Page

Create dedicated `/networking` page for viewing suggestions:

```jsx
// src/pages/NetworkingPage.jsx

const NetworkingPage = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <div className="networking-page">
      <div className="networking-header">
        <h1>🤝 Networking</h1>
        <p>Connect with other players based on shared interests and goals</p>
      </div>

      {!networkingEnabled ? (
        <div className="enable-networking-prompt">
          <h2>Enable Networking to Get Started</h2>
          <p>Configure your preferences in Settings to receive personalized introduction suggestions.</p>
          <Link to="/settings" className="btn btn-primary">
            Go to Settings
          </Link>
        </div>
      ) : (
        <div className="networking-content">
          <div className="suggestions-section">
            <h2>Suggested Connections</h2>
            <div className="suggestions-grid">
              {suggestions.map(suggestion => (
                <div key={suggestion.player_id} className="suggestion-card">
                  <div className="suggestion-header">
                    <div className="player-info">
                      <h3>{suggestion.display_name || suggestion.name}</h3>
                      <div className="match-score">
                        {suggestion.match_score}% Match
                      </div>
                    </div>
                  </div>

                  <div className="match-reasons">
                    <h4>Why you might connect:</h4>
                    <ul>
                      {suggestion.match_reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  {suggestion.shared_interests.length > 0 && (
                    <div className="shared-interests">
                      <strong>Shared interests:</strong>
                      <div className="interest-tags">
                        {suggestion.shared_interests.map(interest => (
                          <span key={interest} className="interest-tag">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="suggestion-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConnect(suggestion.introduction_id)}
                    >
                      Connect
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDecline(suggestion.introduction_id)}
                    >
                      Not Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## Matching Algorithm

### Scoring System (0-100 points)

**Locality Match (30 points max):**
- Same city: 30 points
- Same state/province (different city): 20 points
- Same country (different state): 10 points
- Within travel radius: 15 points

**Professional Match (25 points max):**
- Same industry: 15 points
- Similar role/seniority: 10 points
- Matching goals (e.g., both seeking collaboration): 10 points bonus
- Mentor/mentee match: 15 points bonus

**Golf/Sports Match (25 points max):**
- Similar handicap (within 5 strokes): 15 points
- Same home course: 10 points
- Matching play frequency: 5 points
- Shared golf interests: 10 points

**General Interests Match (20 points max):**
- Each shared interest category: 5 points (max 20)
- Matching networking goals: 10 points bonus

### Algorithm Implementation

```javascript
// Simplified matching logic
function calculateMatchScore(player1, player2) {
  let score = 0;
  const reasons = [];

  // Locality matching
  if (player1.locality.city === player2.locality.city) {
    score += 30;
    reasons.push(`Same city (${player1.locality.city})`);
  } else if (player1.locality.state_province === player2.locality.state_province) {
    score += 20;
    reasons.push(`Same state (${player1.locality.state_province})`);
  } else if (player1.locality.country === player2.locality.country) {
    score += 10;
    reasons.push(`Same country (${player1.locality.country})`);
  }

  // Check travel radius
  if (withinTravelRadius(player1, player2)) {
    score += 15;
    reasons.push('Within travel radius');
  }

  // Professional matching
  if (player1.professional.industry === player2.professional.industry) {
    score += 15;
    reasons.push(`Same industry (${player1.professional.industry})`);
  }

  const sharedGoals = intersection(
    player1.professional.looking_for,
    player2.professional.looking_for
  );
  if (sharedGoals.length > 0) {
    score += 10;
    reasons.push(`Shared professional goals: ${sharedGoals.join(', ')}`);
  }

  // Mentor/mentee matching
  if (player1.interests.open_to_mentoring && player2.interests.seeking_mentor) {
    score += 15;
    reasons.push('Mentor opportunity match');
  }

  // Golf matching
  const handicapDiff = Math.abs(player1.sports.handicap - player2.sports.handicap);
  if (handicapDiff <= 5) {
    score += 15;
    reasons.push(`Similar handicap (${player1.sports.handicap} vs ${player2.sports.handicap})`);
  }

  if (player1.sports.home_course === player2.sports.home_course) {
    score += 10;
    reasons.push(`Same home course (${player1.sports.home_course})`);
  }

  const sharedGolfInterests = intersection(
    player1.sports.interested_in,
    player2.sports.interested_in
  );
  if (sharedGolfInterests.length > 0) {
    score += 10;
    reasons.push(`Shared golf interests: ${sharedGolfInterests.join(', ')}`);
  }

  // General interests
  const sharedInterests = intersection(
    player1.interests.categories,
    player2.interests.categories
  );
  score += Math.min(sharedInterests.length * 5, 20);
  if (sharedInterests.length > 0) {
    reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
  }

  return {
    score: Math.min(score, 100), // Cap at 100
    reasons,
    shared_interests: sharedInterests
  };
}
```

---

## Implementation Plan

### Phase 1: Database & API (Week 1)
- [ ] Create migration for networking preferences
- [ ] Implement GET/PUT /api/networking/preferences
- [ ] Implement basic matching algorithm
- [ ] Create networking_introductions table
- [ ] Implement GET /api/networking/suggestions

### Phase 2: UI Components (Week 2)
- [ ] Add networking preferences section to Settings page
- [ ] Create form components for all preference categories
- [ ] Implement save/update functionality
- [ ] Add validation and error handling

### Phase 3: Suggestions Page (Week 3)
- [ ] Create new Networking page at /networking
- [ ] Implement suggestions grid with match scores
- [ ] Add connect/decline functionality
- [ ] Create introduction acceptance flow

### Phase 4: Notifications & Refinement (Week 4)
- [ ] Add notifications for new suggestions
- [ ] Implement email notifications for matches
- [ ] Add analytics for match success rates
- [ ] Refine matching algorithm based on feedback

### Phase 5: Advanced Features (Future)
- [ ] Group introductions (introduce 3+ people with shared interests)
- [ ] Event-based matching (golf tournaments, networking events)
- [ ] Integration with calendar for scheduling meetups
- [ ] AI-powered conversation starters based on shared interests

---

## Privacy & Safety Considerations

1. **Opt-in Only:** Networking must be explicitly enabled
2. **Granular Privacy:** Users control what information is visible
3. **Two-way Consent:** Both parties must accept introduction
4. **Report/Block:** Easy reporting of inappropriate behavior
5. **Data Protection:** Preferences encrypted at rest
6. **Transparency:** Users see exactly why they matched

---

## Success Metrics

- **Adoption Rate:** % of users who enable networking
- **Match Quality:** Average match score of accepted introductions
- **Conversion Rate:** % of suggestions that lead to connections
- **Engagement:** Active introductions per user per month
- **Retention:** Do networked users stay longer on platform?

---

## Future Enhancements

1. **Smart Scheduling:** Auto-suggest tee times based on shared availability
2. **Event Creation:** Create group golf outings from multiple matches
3. **Business Directory:** Opt-in professional directory for users
4. **Success Stories:** Share networking wins to encourage adoption
5. **Premium Matching:** AI-powered deeper analysis for subscribers

---

*End of Design Document*
