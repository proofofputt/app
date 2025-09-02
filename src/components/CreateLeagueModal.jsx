import React, { useState } from 'react';
import { apiCreateLeague } from '../api';
import { useAuth } from '../context/AuthContext';

const CreateLeagueModal = ({ onClose, onLeagueCreated }) => {
  const { playerData } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [numRounds, setNumRounds] = useState(4);
  const [roundDuration, setRoundDuration] = useState(168);
  const [timeLimit, setTimeLimit] = useState(15);
  const [allowPlayerInvites, setAllowPlayerInvites] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:MM
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const leagueData = {
        creator_id: playerData.player_id,
        name,
        description,
        privacy_type: privacy,
        start_time: startDate, // Add start_time here
        settings: {
          num_rounds: parseInt(numRounds, 10),
          round_duration_hours: parseInt(roundDuration, 10),
          time_limit_minutes: parseInt(timeLimit, 10),
          allow_player_invites: privacy === 'private' ? allowPlayerInvites : false,
        },
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
    <div className="modal-backdrop">
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
            <div className="privacy-options">
              <label>
                <input
                  type="radio"
                  value="private"
                  checked={privacy === 'private'}
                  onChange={() => {
                    setPrivacy('private');
                    setAllowPlayerInvites(true); // Default to true for private
                  }}
                />
                Private
              </label>
              <label>
                <input
                  type="radio"
                  value="public"
                  checked={privacy === 'public'}
                  onChange={() => {
                    setPrivacy('public');
                    setAllowPlayerInvites(false); // Force false for public
                  }}
                />
                Public
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={allowPlayerInvites}
                onChange={(e) => setAllowPlayerInvites(e.target.checked)}
                disabled={privacy === 'public'}
              />
              Allow members to invite others (Private Leagues Only)
            </label>
          </div>
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
            <label htmlFor="time-limit">Time Limit (minutes)</label>
            <select id="time-limit" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)}>
              {[2, 5, 10, 15, 21].map(n => <option key={n} value={n}>{n} minutes</option>)}
            </select>
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
              <option value={24}>1 Day</option>
              <option value={48}>2 Days</option>
              <option value={96}>4 Days</option>
              <option value={168}>7 Days</option>
            </select>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLeagueModal;