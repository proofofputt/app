import React, { useState, useEffect } from 'react';
import { apiCreateLeague } from '../api';
import { useAuth } from '../context/AuthContext';
import './CreateLeagueModal.css';

const CreateLeagueModal = ({ onClose, onLeagueCreated }) => {
  const { playerData } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [competitionMode, setCompetitionMode] = useState('time_limit');
  const [numRounds, setNumRounds] = useState(10); // Updated default
  const [roundDuration, setRoundDuration] = useState(2); // Updated default to 2 hours
  const [timeLimit, setTimeLimit] = useState(2); // Updated default to 2 minutes
  const [maxAttempts, setMaxAttempts] = useState(21); // Default for shoot-out mode
  const [puttingDistance, setPuttingDistance] = useState(7.0);
  const [allowPlayerInvites, setAllowPlayerInvites] = useState(true);
  const [allowLateJoiners, setAllowLateJoiners] = useState(true);
  const [allowCatchUpSubmissions, setAllowCatchUpSubmissions] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Add 1 hour
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  });
  const [isIRL, setIsIRL] = useState(false);
  const [numPlayers, setNumPlayers] = useState(4);
  const [playerNames, setPlayerNames] = useState({});
  const [savedPlayerNames, setSavedPlayerNames] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved player names from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('irl_player_names');
    if (saved) {
      try {
        setSavedPlayerNames(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to parse saved player names:', e);
      }
    }
  }, []);

  // Initialize player names when numPlayers changes
  useEffect(() => {
    if (isIRL) {
      const newPlayerNames = {};
      for (let i = 1; i <= numPlayers; i++) {
        newPlayerNames[i] = playerNames[i] || `Player ${i}`;
      }
      setPlayerNames(newPlayerNames);
    }
  }, [isIRL, numPlayers]);

  const handlePlayerNameChange = (playerIndex, newName) => {
    setPlayerNames(prev => ({
      ...prev,
      [playerIndex]: newName
    }));
  };

  const savePlayerNames = () => {
    const uniqueNames = [...new Set(Object.values(playerNames).filter(name => 
      name && name.trim() !== '' && !name.startsWith('Player ')
    ))];
    const updatedSaved = [...new Set([...savedPlayerNames, ...uniqueNames])];
    setSavedPlayerNames(updatedSaved);
    localStorage.setItem('irl_player_names', JSON.stringify(updatedSaved));
  };

  const selectSavedName = (playerIndex, savedName) => {
    setPlayerNames(prev => ({
      ...prev,
      [playerIndex]: savedName
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Save player names to localStorage for future use
      if (isIRL) {
        savePlayerNames();
      }

      // Calculate round duration hours
      let roundDurationHours;
      if (roundDuration === 'monthly') {
        // Calculate hours from start date to same day next month
        const startDateTime = new Date(startDate);
        const nextMonth = new Date(startDateTime);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        // Handle edge cases for days that don't exist in next month
        if (nextMonth.getDate() !== startDateTime.getDate()) {
          // If the day doesn't exist in next month (e.g., Jan 31 -> Feb 28/29)
          nextMonth.setDate(0); // Set to last day of previous month
        }

        roundDurationHours = Math.round((nextMonth - startDateTime) / (1000 * 60 * 60));
      } else {
        roundDurationHours = parseInt(roundDuration, 10);
      }

      // Build settings based on competition mode
      const baseSettings = {
        competition_mode: competitionMode,
        num_rounds: parseInt(numRounds, 10),
        round_duration_hours: roundDurationHours,
        putting_distance_feet: parseFloat(puttingDistance),
        allow_player_invites: isIRL ? false : allowPlayerInvites,
        allow_late_joiners: isIRL ? false : allowLateJoiners,
        allow_catch_up_submissions: isIRL ? false : allowCatchUpSubmissions,
        is_irl: isIRL,
        num_players: isIRL ? numPlayers : undefined,
        player_names: isIRL ? playerNames : undefined,
      };

      // Add mode-specific settings
      if (competitionMode === 'shoot_out') {
        baseSettings.max_attempts = parseInt(maxAttempts, 10);
      } else {
        baseSettings.time_limit_minutes = parseInt(timeLimit, 10);
      }

      const leagueData = {
        creator_id: playerData.player_id,
        name,
        description,
        privacy_type: privacy,
        start_time: startDate,
        settings: baseSettings,
      };
      await apiCreateLeague(leagueData);
      onLeagueCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create league');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create New League</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="league-name">League Name</label>
            <input
              id="league-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="league-description">Description</label>
            <textarea
              id="league-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Privacy</label>
            <div className="privacy-toggle-group">
              <button
                type="button"
                className={`privacy-toggle-btn ${privacy === 'private' ? 'active' : ''}`}
                onClick={() => setPrivacy('private')}
              >
                Private
              </button>
              <button
                type="button"
                className={`privacy-toggle-btn ${privacy === 'public' ? 'active' : ''}`}
                onClick={() => setPrivacy('public')}
              >
                Public
              </button>
            </div>
            <small className="form-help">
              <strong>Public:</strong> League and results visible to everyone, anyone can join.<br/>
              <strong>Private:</strong> League and results only visible to members.
            </small>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isIRL}
                onChange={(e) => setIsIRL(e.target.checked)}
              />
              In Real Life (IRL) Mode
            </label>
            <small className="form-help">Create a local multiplayer tournament without online invitations. Perfect for in-person events and group competitions.</small>
          </div>
          {isIRL && (
            <>
              <div className="form-group">
                <label htmlFor="num-players">Number of Players</label>
                <select 
                  id="num-players" 
                  value={numPlayers} 
                  onChange={(e) => setNumPlayers(parseInt(e.target.value, 10))}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map(n => (
                    <option key={n} value={n}>{n} Players</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Player Names</label>
                <small className="form-help">Customize player names for this IRL tournament. Names are automatically saved for future tournaments.</small>
                {Array.from({ length: numPlayers }, (_, i) => {
                  const playerIndex = i + 1;
                  return (
                    <div key={playerIndex} className="player-name-row">
                      <input
                        type="text"
                        value={playerNames[playerIndex] || ''}
                        onChange={(e) => handlePlayerNameChange(playerIndex, e.target.value)}
                        placeholder={`Player ${playerIndex}`}
                        className="player-name-input"
                      />
                      {savedPlayerNames.length > 0 && (
                        <select
                          className="saved-names-select"
                          value=""
                          onChange={(e) => e.target.value && selectSavedName(playerIndex, e.target.value)}
                        >
                          <option value="">Select saved name...</option>
                          {savedPlayerNames.map(savedName => (
                            <option key={savedName} value={savedName}>{savedName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!isIRL && (
            <>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowPlayerInvites}
                    onChange={(e) => setAllowPlayerInvites(e.target.checked)}
                  />
                  Allow members to invite others
                </label>
                <small className="form-help">When disabled, only the league administrator can invite new players.</small>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowLateJoiners}
                    onChange={(e) => setAllowLateJoiners(e.target.checked)}
                  />
                  Allow late joiners after league starts
                </label>
                <small className="form-help">When enabled, players can join the league even after it has started. Disable to require registration before the first round begins.</small>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={allowCatchUpSubmissions}
                    onChange={(e) => setAllowCatchUpSubmissions(e.target.checked)}
                  />
                  Allow catch-up submissions for previous rounds
                </label>
                <small className="form-help">When enabled, players can complete earlier rounds even after missing deadlines. Disable for strict tournament timing.</small>
              </div>
            </>
          )}
          <div className="form-group">
            <label htmlFor="start-date">Start Date and Time</label>
            <input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Competition Mode</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  value="time_limit"
                  checked={competitionMode === 'time_limit'}
                  onChange={(e) => setCompetitionMode(e.target.value)}
                />
                <span>Time Limit</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  value="shoot_out"
                  checked={competitionMode === 'shoot_out'}
                  onChange={(e) => setCompetitionMode(e.target.value)}
                />
                <span>Shoot Out</span>
              </label>
            </div>
          </div>
          {competitionMode === 'time_limit' ? (
            <div className="form-group">
              <label htmlFor="time-limit">Time Limit (minutes)</label>
              <select id="time-limit" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)}>
                {[2, 5, 10, 15, 21].map(n => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="max-attempts">Number of Putts</label>
              <select id="max-attempts" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10))}>
                <option value={5}>5 Putts</option>
                <option value={10}>10 Putts</option>
                <option value={21}>21 Putts</option>
                <option value={50}>50 Putts</option>
                <option value={77}>77 Putts</option>
                <option value={100}>100 Putts</option>
                <option value={210}>210 Putts</option>
                <option value={420}>420 Putts</option>
                <option value={777}>777 Putts</option>
                <option value={1000}>1000 Putts</option>
                <option value={2100}>2100 Putts</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="putting-distance">
              Length: {puttingDistance.toFixed(1)} feet
            </label>
            <input
              id="putting-distance"
              type="range"
              min="3.0"
              max="10.0"
              step="0.1"
              value={puttingDistance}
              onChange={(e) => setPuttingDistance(parseFloat(e.target.value))}
              className="distance-slider"
            />
            <div className="slider-labels">
              <span>3.0'</span>
              <span>7.0'</span>
              <span>10.0'</span>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="num-rounds">Number of Rounds</label>
            <select id="num-rounds" value={numRounds} onChange={(e) => setNumRounds(e.target.value)}>
              {[2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Rounds</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="round-duration">Round Schedule</label>
            <select id="round-duration" value={roundDuration} onChange={(e) => setRoundDuration(e.target.value)}>
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={4}>4 Hours</option>
              <option value={12}>12 Hours</option>
              <option value={24}>1 Day</option>
              <option value={48}>2 Days</option>
              <option value={72}>3 Days</option>
              <option value={96}>4 Days</option>
              <option value={168}>7 Days</option>
              <option value={336}>14 Days</option>
              <option value={504}>21 Days</option>
              <option value="monthly">Monthly on Start Day</option>
            </select>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : isIRL ? 'Create IRL Tournament' : 'Create League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLeagueModal;