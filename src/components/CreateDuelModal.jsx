import React, { useState } from 'react';
import { apiSearchPlayers, apiCreateDuel } from '../api';
import { useAuth } from '../context/AuthContext';

const CreateDuelModal = ({ onClose, onDuelCreated }) => {
  const { playerData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [duration, setDuration] = useState(5);
  const [inviteExpiration, setInviteExpiration] = useState(72); // Default to 72 hours
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    setIsLoading(true);
    setError('');
    try {
      const results = await apiSearchPlayers(searchTerm, playerData.player_id);
      setSearchResults(results);
    } catch (err) {
      setError(err.message || 'Failed to search for players.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPlayer) return;
    setIsLoading(true);
    setError('');
    try {
      const duelData = {
        creator_id: playerData.player_id,
        invited_player_id: selectedPlayer.player_id,
        settings: {
          session_duration_limit_minutes: duration,
          invitation_expiry_minutes: inviteExpiration * 60, // Convert hours to minutes
        },
      };
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
        <h2>Create a New Duel</h2>
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="player-search">Find Opponent</label>
            <input
              id="player-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map(player => (
              <li
                key={player.player_id}
                onClick={() => setSelectedPlayer(player)}
                className={selectedPlayer?.player_id === player.player_id ? 'selected' : ''}
              >
                {player.name}
              </li>
            ))}
          </ul>
        )}

        {selectedPlayer && <p>Selected: {selectedPlayer.name}</p>}

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

        <div className="form-group">
          <label htmlFor="invite-expiration">Invite Expiration</label>
          <select id="invite-expiration" value={inviteExpiration} onChange={(e) => setInviteExpiration(parseInt(e.target.value, 10))}>
            <option value={24}>24 Hours</option>
            <option value={48}>48 Hours</option>
            <option value={72}>72 Hours</option>
            <option value={168}>1 Week</option>
          </select>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            onClick={handleCreate}
            disabled={!selectedPlayer || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );;
};

export default CreateDuelModal;