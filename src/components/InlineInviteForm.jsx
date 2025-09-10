import React, { useState, useEffect, useRef } from 'react';
import { apiSearchPlayers } from '../api.js';
import './InlineInviteForm.css';

// Email validation utility
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation utility (supports various formats)
const isValidPhoneNumber = (phone) => {
  // Remove all non-digit characters for validation
  const cleanPhone = phone.replace(/\D/g, '');
  // Valid phone number should have 10-15 digits
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
};

// Format phone number for display
const formatPhoneNumber = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
  }
  return phone; // Return as-is if not 10 digits
};

// Detect input type (username, email, or phone)
const detectInputType = (input) => {
  if (isValidEmail(input)) return 'email';
  if (isValidPhoneNumber(input)) return 'phone';
  return 'username';
};

const InlineInviteForm = ({ onInvite }) => {
  const [inviteeName, setInviteeName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedNewPlayer, setSelectedNewPlayer] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPlayerOption, setShowNewPlayerOption] = useState(false);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (inviteeName.length > 2 && !selectedPlayer) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await apiSearchPlayers(inviteeName);
          setSearchResults(results);
          
          // Determine if we should show "New Player Invite" option
          const inputType = detectInputType(inviteeName);
          const hasExactMatch = results.some(player => 
            player.name.toLowerCase() === inviteeName.toLowerCase() ||
            player.email?.toLowerCase() === inviteeName.toLowerCase()
          );
          
          // Show new player option for valid emails/phones or if no exact username match
          setShowNewPlayerOption((inputType === 'email' || inputType === 'phone') || 
            (inputType === 'username' && !hasExactMatch));
            
        } catch (err) {
          console.error("Error searching players:", err);
          setSearchResults([]);
          // Still show new player option for valid emails/phones even if search fails
          const inputType = detectInputType(inviteeName);
          setShowNewPlayerOption(inputType === 'email' || inputType === 'phone');
        }
      }, 300);
    } else if (inviteeName.length <= 2) {
      setSearchResults([]);
      setSelectedPlayer(null);
      setSelectedNewPlayer(null);
      setShowNewPlayerOption(false);
    }
  }, [inviteeName, selectedPlayer]);

  const handlePlayerNameChange = (e) => {
    setInviteeName(e.target.value);
    setSelectedPlayer(null);
    setSelectedNewPlayer(null);
  };

  const handleSelectPlayer = (player) => {
    setInviteeName(player.name);
    setSelectedPlayer(player);
    setSelectedNewPlayer(null);
    setSearchResults([]);
  };

  const handleSelectNewPlayer = () => {
    const inputType = detectInputType(inviteeName);
    const newPlayerData = {
      isNewPlayer: true,
      inputType,
      contact: inviteeName,
      displayName: inputType === 'email' ? inviteeName : 
                   inputType === 'phone' ? formatPhoneNumber(inviteeName) : inviteeName
    };
    setSelectedNewPlayer(newPlayerData);
    setSelectedPlayer(null);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPlayer || selectedNewPlayer) {
      setIsSubmitting(true);
      setError('');
      try {
        if (selectedPlayer) {
          // Existing player
          await onInvite(selectedPlayer.player_id);
        } else if (selectedNewPlayer) {
          // New player invite - pass the new player data
          await onInvite(null, selectedNewPlayer);
        }
        
        // Clear form on success
        setInviteeName('');
        setSelectedPlayer(null);
        setSelectedNewPlayer(null);
        setSearchResults([]);
        setShowNewPlayerOption(false);
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
          placeholder="Invite by username, email, or phone number" 
          className="inline-invite-input"
        />
        {(searchResults.length > 0 || showNewPlayerOption) && !selectedPlayer && !selectedNewPlayer && (
          <ul className="search-results">
            {searchResults.map(player => (
              <li key={player.player_id} onClick={() => handleSelectPlayer(player)}>
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
                className="new-player-invite"
              >
                <div className="new-player-info">
                  <span className="new-player-label">📧 New Player Invite</span>
                  <span className="new-player-contact">
                    {detectInputType(inviteeName) === 'email' ? `Email: ${inviteeName}` :
                     detectInputType(inviteeName) === 'phone' ? `Phone: ${formatPhoneNumber(inviteeName)}` :
                     `Username: ${inviteeName}`}
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

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
            Will be invited via {selectedNewPlayer.inputType === 'email' ? 'email' : 
                               selectedNewPlayer.inputType === 'phone' ? 'SMS' : 'username lookup'}
          </p>
        </div>
      )}

      <div className="invite-form-actions">
        <button 
          type="submit" 
          className="btn" 
          disabled={(!selectedPlayer && !selectedNewPlayer) || isSubmitting}
        >
          {isSubmitting ? '...' : 
           selectedNewPlayer ? 'Send New Player Invite' : 'Invite'}
        </button>
        {error && <p className="error-message inline-error">{error}</p>}
      </div>
    </form>
  );
};

export default InlineInviteForm;