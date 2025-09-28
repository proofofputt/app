import React, { useState } from 'react';
import { apiSearchPlayers, apiCreateDuel } from '../api';
import { useAuth } from '../context/AuthContext';
import './CreateDuelModal.css';

// Email validation utility
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Detect input type (username or email)
const detectInputType = (input) => {
  if (isValidEmail(input)) return 'email';
  return 'username';
};

const CreateDuelModal = ({ onClose, onDuelCreated, rematchData = null }) => {
  const { playerData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(rematchData?.opponent || null);
  const [selectedNewPlayer, setSelectedNewPlayer] = useState(null); // For new player invites
  const [competitionMode, setCompetitionMode] = useState(rematchData?.competitionMode || 'time_limit');
  const [duration, setDuration] = useState(rematchData?.duration || 5);
  const [maxAttempts, setMaxAttempts] = useState(rematchData?.maxAttempts || 21); // Default 21 for shoot-out
  const [inviteExpiration, setInviteExpiration] = useState(rematchData?.expiration || 72); // Default to 72 hours
  const [puttingDistance, setPuttingDistance] = useState(rematchData?.puttingDistance || 7.0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPlayerOption, setShowNewPlayerOption] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    setIsLoading(true);
    setError('');
    setSelectedPlayer(null);
    setSelectedNewPlayer(null);
    
    try {
      const results = await apiSearchPlayers(searchTerm, playerData.player_id);
      setSearchResults(results);
      
      // Determine if we should show "New Player Invite" option
      const inputType = detectInputType(searchTerm);
      const hasExactMatch = results.some(player => 
        player.name.toLowerCase() === searchTerm.toLowerCase() ||
        player.email?.toLowerCase() === searchTerm.toLowerCase()
      );
      
      // Only show new player option if:
      // 1. No exact match was found AND
      // 2. The search term is a valid email
      setShowNewPlayerOption(!hasExactMatch && inputType === 'email');
      
    } catch (err) {
      setError(err.message || 'Failed to search for players.');
      // Still show new player option for valid emails even if search fails
      const inputType = detectInputType(searchTerm);
      setShowNewPlayerOption(inputType === 'email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectNewPlayer = () => {
    const inputType = detectInputType(searchTerm);
    const newPlayerData = {
      isNewPlayer: true,
      inputType,
      contact: searchTerm,
      displayName: searchTerm
    };
    setSelectedNewPlayer(newPlayerData);
    setSelectedPlayer(null);
  };

  const handleSelectExistingPlayer = (player) => {
    setSelectedPlayer(player);
    setSelectedNewPlayer(null);
  };

  const handleCreate = async () => {
    if (!selectedPlayer && !selectedNewPlayer) return;
    setIsLoading(true);
    setError('');
    try {
      let duelData;
      
      // Build settings based on competition mode
      const baseSettings = {
        competition_mode: competitionMode,
        invitation_expiry_minutes: inviteExpiration * 60, // Convert hours to minutes
        putting_distance_feet: parseFloat(puttingDistance),
      };

      // Add mode-specific settings
      if (competitionMode === 'shoot_out') {
        baseSettings.max_attempts = maxAttempts;
      } else {
        baseSettings.session_duration_limit_minutes = duration;
      }

      if (selectedPlayer) {
        // Existing player duel
        duelData = {
          creator_id: playerData.player_id,
          invited_player_id: selectedPlayer.player_id,
          settings: baseSettings,
        };
      } else if (selectedNewPlayer) {
        // New player invitation
        duelData = {
          creator_id: playerData.player_id,
          invite_new_player: true,
          new_player_contact: {
            type: selectedNewPlayer.inputType,
            value: selectedNewPlayer.contact
          },
          settings: baseSettings,
        };
      }
      
      await apiCreateDuel(duelData);
      onDuelCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create duel.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{rematchData ? 'Challenge to Rematch' : 'Create a New Duel'}</h2>
        
        {rematchData ? (
          // Rematch mode - show pre-selected opponent
          <div className="rematch-info">
            <div className="selected-opponent">
              <strong>Opponent:</strong> {rematchData.opponent.name}
            </div>
            <p className="rematch-description">
              Challenge {rematchData.opponent.name} to a rematch with the same settings as your previous duel.
            </p>
          </div>
        ) : (
          // Regular duel creation - show search
          <div className="search-section">
            <form onSubmit={handleSearch}>
              <div className="form-group">
                <label htmlFor="player-search">Find Opponent</label>
                <input
                  id="player-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Invite by username or email"
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {(searchResults.length > 0 || showNewPlayerOption) && (
              <ul className="search-results">
                {searchResults.map(player => (
                  <li
                    key={player.player_id}
                    onClick={() => handleSelectExistingPlayer(player)}
                    className={selectedPlayer?.player_id === player.player_id ? 'selected' : ''}
                  >
                    <div className="player-info">
                      <span className="player-name">{player.name}</span>
                      {player.email && <span className="player-email">({player.email})</span>}
                    </div>
                  </li>
                ))}
                
                {showNewPlayerOption && (
                  <li
                    key="new-player"
                    onClick={handleSelectNewPlayer}
                    className={selectedNewPlayer ? 'selected new-player-invite' : 'new-player-invite'}
                  >
                    <div className="new-player-info">
                      <span className="new-player-label">📧 New Player Invite</span>
                      <span className="new-player-contact">
                        {detectInputType(searchTerm) === 'email' ? `Email: ${searchTerm}` : `Username: ${searchTerm}`}
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {selectedPlayer && (
              <div className="selection-info">
                <p><strong>Selected:</strong> {selectedPlayer.name}</p>
                {selectedPlayer.email && <p className="selected-email">{selectedPlayer.email}</p>}
              </div>
            )}
            
            {selectedNewPlayer && (
              <div className="selection-info new-player-selection">
                <p><strong>New Player Invite:</strong> {selectedNewPlayer.displayName}</p>
                <p className="invite-method">
                  Will be invited via {selectedNewPlayer.inputType === 'email' ? 'email' : 'username lookup'}
                </p>
              </div>
            )}
          </div>
        )}

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
              <span>⏱️ Time Limit</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                value="shoot_out"
                checked={competitionMode === 'shoot_out'}
                onChange={(e) => setCompetitionMode(e.target.value)}
              />
              <span>🎯 Shoot Out</span>
            </label>
          </div>
        </div>

        {competitionMode === 'time_limit' ? (
          <div className="form-group">
            <label htmlFor="duration">Session Duration</label>
            <select id="duration" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))}>
              <option value={2}>2 Minutes</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
              <option value={21}>21 Minutes</option>
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
          <label htmlFor="invite-expiration">Invite Expiration</label>
          <select id="invite-expiration" value={inviteExpiration} onChange={(e) => setInviteExpiration(parseInt(e.target.value, 10))}>
            <option value={24}>24 Hours</option>
            <option value={48}>48 Hours</option>
            <option value={72}>72 Hours</option>
            <option value={168}>1 Week</option>
          </select>
        </div>

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

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            onClick={handleCreate}
            disabled={(!selectedPlayer && !selectedNewPlayer) || isLoading}
          >
            {isLoading ? 'Sending...' : 
             selectedNewPlayer ? 'Send New Player Invite' :
             rematchData ? 'Send Rematch Challenge' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDuelModal;