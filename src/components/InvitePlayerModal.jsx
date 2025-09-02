import React, { useState } from 'react';
import { apiSearchPlayers, apiInviteToLeague } from '../api';
import './InvitePlayerModal.css';

const InvitePlayerModal = ({ leagueId, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    setIsLoading(true);
    setError('');
    try {
      const results = await apiSearchPlayers(searchTerm);
      setSearchResults(results);
    } catch (err) {
      setError(err.message || 'Failed to search for players.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedPlayer) return;
    setIsLoading(true);
    setError('');
    try {
      await apiInviteToLeague(leagueId, selectedPlayer.player_id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to invite player.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Invite Player to League</h2>
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="player-search">Search for Player</label>
            <input
              id="player-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter name or email"
            />
          </div>
          <button type="submit" disabled={isLoading}>{isLoading ? 'Searching...' : 'Search'}</button>
        </form>

        <div className="search-results">
          {searchResults.map(player => (
            <div
              key={player.player_id}
              className={`search-result-item ${selectedPlayer?.player_id === player.player_id ? 'selected' : ''}`}
              onClick={() => setSelectedPlayer(player)}
            >
              {player.name} ({player.email})
            </div>
          ))}
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button onClick={handleInvite} disabled={!selectedPlayer || isLoading}>
            {isLoading ? 'Inviting...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitePlayerModal;
