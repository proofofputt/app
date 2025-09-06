import React, { useState, useCallback } from 'react';
import { apiSearchPlayersForFriends, apiSendFriendRequest } from '../api.js';
import './FriendSearchModal.css';

const FriendSearchModal = ({ isOpen, onClose, playerId, onFriendAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('auto');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [message, setMessage] = useState('');

  const detectSearchType = (query) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
    
    if (emailRegex.test(query)) return 'email';
    if (phoneRegex.test(query.replace(/[\s\-\(\)]/g, ''))) return 'phone';
    return 'username';
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setMessage('');

    try {
      const detectedType = searchType === 'auto' ? detectSearchType(searchQuery) : searchType;
      const results = await apiSearchPlayersForFriends(playerId, searchQuery, detectedType);
      
      if (results && results.length > 0) {
        setSearchResults(results);
        setMessage(`Found ${results.length} result(s)`);
      } else {
        setSearchResults([]);
        setMessage('No players found with that identifier.');
      }
    } catch (error) {
      setSearchResults([]);
      setMessage(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchType, playerId]);

  const handleAddFriend = async (result) => {
    setIsAddingFriend(true);
    setSelectedResult(result);

    try {
      const response = await apiSendFriendRequest(
        playerId, 
        searchQuery, // Use original search query as identifier
        searchType === 'auto' ? detectSearchType(searchQuery) : searchType
      );

      setMessage(`Friend request sent to ${result.display_name}!`);
      setSearchQuery('');
      setSearchResults([]);
      
      if (onFriendAdded) {
        onFriendAdded(result);
      }
    } catch (error) {
      setMessage(`Failed to send friend request: ${error.message}`);
    } finally {
      setIsAddingFriend(false);
      setSelectedResult(null);
    }
  };

  const getSearchTypeLabel = (type) => {
    switch (type) {
      case 'email': return 'Email Address';
      case 'phone': return 'Phone Number';
      case 'username': return 'Username';
      case 'auto': return 'Auto-detect';
      default: return type;
    }
  };

  const getResultDescription = (result) => {
    // Only show username and public info - never show email/phone
    const parts = [];
    
    if (result.display_name !== result.username) {
      parts.push(`@${result.username}`);
    }
    
    if (result.mutual_friends > 0) {
      parts.push(`${result.mutual_friends} mutual friends`);
    }
    
    if (result.last_active) {
      const lastActive = new Date(result.last_active);
      const now = new Date();
      const daysDiff = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        parts.push('Active today');
      } else if (daysDiff <= 7) {
        parts.push(`Active ${daysDiff}d ago`);
      }
    }
    
    return parts.join(' • ');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content friend-search-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Friend</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="search-section">
            <p className="search-instructions">
              Find friends by their email address, phone number, or username. 
              Only usernames will be visible in public areas.
            </p>

            <div className="search-controls">
              <div className="search-input-group">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter email, phone, or username..."
                  className="search-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <select 
                  value={searchType} 
                  onChange={(e) => setSearchType(e.target.value)}
                  className="search-type-select"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="username">Username</option>
                </select>
              </div>
              
              <button 
                className="btn btn-primary search-button"
                onClick={handleSearch}
                disabled={!searchQuery.trim() || isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {message && (
              <div className={`search-message ${message.includes('failed') || message.includes('No players') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
          </div>

          <div className="search-results">
            {searchResults.length > 0 && (
              <>
                <h3>Search Results</h3>
                <div className="results-list">
                  {searchResults.map((result) => (
                    <div key={result.player_id} className="result-item">
                      <div className="result-info">
                        <h4 className="result-name">{result.display_name}</h4>
                        <p className="result-description">{getResultDescription(result)}</p>
                        {result.is_friend && (
                          <span className="friend-status">Already friends</span>
                        )}
                        {result.pending_request && (
                          <span className="pending-status">Request pending</span>
                        )}
                      </div>
                      
                      <div className="result-actions">
                        {!result.is_friend && !result.pending_request && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleAddFriend(result)}
                            disabled={isAddingFriend && selectedResult?.player_id === result.player_id}
                          >
                            {isAddingFriend && selectedResult?.player_id === result.player_id 
                              ? 'Sending...' 
                              : 'Add Friend'
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="privacy-notice">
            <h4>Privacy Information</h4>
            <ul>
              <li><strong>Private:</strong> Email addresses and phone numbers are never shown publicly</li>
              <li><strong>Public:</strong> Only usernames appear in leaderboards, activity feeds, and game logs</li>
              <li><strong>Search:</strong> You can find friends using private info, but others only see usernames</li>
              <li><strong>Security:</strong> Your contact information remains private to you</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-tertiary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendSearchModal;