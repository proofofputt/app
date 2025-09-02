import React, { useState, useEffect, useRef } from 'react';
import { apiSearchPlayers } from '@/api.js';

const InlineInviteForm = ({ onInvite }) => {
  const [inviteeName, setInviteeName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (inviteeName.length > 2 && !selectedPlayerName) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await apiSearchPlayers(inviteeName);
          setSearchResults(results);
        } catch (err) {
          console.error("Error searching players:", err);
          setSearchResults([]);
        }
      }, 300);
    } else if (inviteeName.length <= 2) {
      setSearchResults([]);
      setSelectedPlayerId(null);
      setSelectedPlayerName('');
    }
  }, [inviteeName, selectedPlayerName]);

  const handlePlayerNameChange = (e) => {
    setInviteeName(e.target.value);
    setSelectedPlayerName('');
    setSelectedPlayerId(null);
  };

  const handleSelectPlayer = (player) => {
    setInviteeName(player.name);
    setSelectedPlayerId(player.player_id);
    setSelectedPlayerName(player.name);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPlayerId) {
      setIsSubmitting(true);
      setError('');
      try {
        await onInvite(inviteeName);
        // Clear form on success
        setInviteeName('');
        setSelectedPlayerId(null);
        setSelectedPlayerName('');
      } catch (err) {
        setError(err.message || 'Failed to send invite.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setError("Please select a player from the search results.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="inline-invite-form">
      <div className="search-input-wrapper">
        <input 
          type="text" 
          value={inviteeName} 
          onChange={handlePlayerNameChange} 
          placeholder="Invite player by name..." 
          className="inline-invite-input"
        />
        {searchResults.length > 0 && !selectedPlayerName && (
          <ul className="search-results">{searchResults.map(p => <li key={p.player_id} onClick={() => handleSelectPlayer(p)}>{p.name}</li>)}</ul>
        )}
      </div>
      <button type="submit" className="btn btn-secondary btn-small" disabled={!selectedPlayerId || isSubmitting}>
        {isSubmitting ? '...' : 'Invite'}
      </button>
      {error && <p className="error-message inline-error">{error}</p>}
    </form>
  );
};

export default InlineInviteForm;