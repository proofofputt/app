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
  const [allowLateJoiners, setAllowLateJoiners] = useState(true);
  const [allowCatchUpSubmissions, setAllowCatchUpSubmissions] = useState(true);
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
          allow_player_invites: allowPlayerInvites,
          allow_late_joiners: allowLateJoiners,
          allow_catch_up_submissions: allowCatchUpSubmissions,
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